#!/usr/bin/env python3
"""Check the installed model through the running application (Phase 9, section 15.10).

Uploads each scan of a verification set (made with `cavinet-ml verification-set`) through the
API as the demo doctor, waits for the analysis, and compares the application's probability of TB
with the training toolkit's for the same patient. They must agree within 0.01. Also records how
long each analysis took on this computer (target: at most 3 minutes for a 300-slice scan).

    make up && make seed
    python3 scripts/verify_model.py verification/

Writes docs/verification/MODEL_VERIFICATION.md and model_verification.csv (patient IDs of the
public dataset and numbers only). Every verification patient is deleted afterwards.
Exit code 0 when every scan agrees, 1 otherwise. Needs only the Python standard library.
"""

from __future__ import annotations  # runs on the Python 3.9 that macOS ships

import argparse
import csv
import json
import platform
import sys
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path

TOLERANCE = 0.01
BUDGET_SECONDS = 180
POLL_SECONDS = 3
TIMEOUT_SECONDS = 20 * 60
ROOT = Path(__file__).resolve().parent.parent


class ApiError(Exception):
    pass


class Api:
    def __init__(self, base: str):
        self.base = base.rstrip("/")
        self.token: str | None = None

    def request(self, method: str, path: str, body=None, headers=None, length=None):
        headers = dict(headers or {})
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        if isinstance(body, dict):
            body = json.dumps(body).encode()
            headers["Content-Type"] = "application/json"
        if length is not None:
            headers["Content-Length"] = str(length)
        request = urllib.request.Request(
            f"{self.base}{path}", data=body, method=method, headers=headers
        )
        try:
            with urllib.request.urlopen(request, timeout=600) as response:
                data = response.read()
        except urllib.error.HTTPError as error:
            detail = error.read().decode(errors="replace")[:300]
            raise ApiError(f"{method} {path}: HTTP {error.code} {detail}") from error
        return json.loads(data) if data else None

    def login(self, email: str, password: str) -> None:
        answer = self.request("POST", "/api/auth/login", {"email": email, "password": password})
        self.token = answer["access_token"]

    def upload(self, patient_id: str, archive: Path) -> dict:
        boundary = uuid.uuid4().hex
        head = (
            f'--{boundary}\r\nContent-Disposition: form-data; name="files"; '
            f'filename="{archive.name}"\r\nContent-Type: application/zip\r\n\r\n'
        ).encode()
        tail = f"\r\n--{boundary}--\r\n".encode()

        def chunks():
            yield head
            with archive.open("rb") as handle:
                while block := handle.read(1024 * 1024):
                    yield block
            yield tail

        return self.request(
            "POST",
            f"/api/patients/{patient_id}/cases",
            chunks(),
            {"Content-Type": f"multipart/form-data; boundary={boundary}"},
            length=len(head) + archive.stat().st_size + len(tail),
        )


def read_env(path: Path) -> dict[str, str]:
    values = {}
    if path.is_file():
        for line in path.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                key, value = line.split("=", 1)
                values[key.strip()] = value.strip()
    return values


def read_expected(folder: Path) -> list[dict[str, str]]:
    path = folder / "expected.csv"
    if not path.is_file():
        raise SystemExit(f"{path} not found; make the set with `cavinet-ml verification-set`.")
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def analyse(api: Api, row: dict[str, str], folder: Path, log=print) -> dict:
    mr = f"VERIFY-{row['case_id']}".upper().replace("_", "-")
    patient = api.request(
        "POST",
        "/api/patients",
        {
            "full_name": f"Verification {row['case_id'].replace('_', ' ')}",
            "mr_number": mr,
            "date_of_birth": "1970-01-01",
            "sex": "male",
        },
    )
    try:
        case = api.upload(patient["id"], folder / row["zip"])
        deadline = time.monotonic() + TIMEOUT_SECONDS
        while True:
            case = api.request("GET", f"/api/cases/{case['id']}")
            if case["status"] in ("completed", "failed"):
                break
            if time.monotonic() > deadline:
                raise ApiError(f"{row['case_id']}: no result after {TIMEOUT_SECONDS // 60} min")
            time.sleep(POLL_SECONDS)
        if case["status"] == "failed":
            return {"error": case.get("failure_reason") or "failed"}
        result = api.request("GET", f"/api/cases/{case['id']}/result")
        return {
            "app_probability": result["probability_tb"],
            "predicted_class": result["predicted_class"],
            "is_demo": result["is_demo"],
            "model_version": result["model"]["version"],
            "seconds": result["processing_seconds"],
            "slices": (case.get("scan") or {}).get("num_slices"),
        }
    finally:
        api.request("DELETE", f"/api/patients/{patient['id']}?confirm={mr}")


def compare(rows: list[dict[str, str]], results: list[dict]) -> list[dict]:
    table = []
    for row, result in zip(rows, results):  # noqa: B905 - strict= needs Python 3.10
        expected = float(row["toolkit_probability"])
        app = result.get("app_probability")
        difference = None if app is None else abs(app - expected)
        table.append(
            {
                "case_id": row["case_id"],
                "label": row["label"],
                "slices": result.get("slices") or row.get("slices"),
                "toolkit_probability": expected,
                "app_probability": app,
                "difference": difference,
                "agrees": difference is not None and difference <= TOLERANCE,
                "seconds": result.get("seconds"),
                "error": result.get("error", ""),
            }
        )
    return table


def timing_row(table: list[dict]) -> dict | None:
    timed = [r for r in table if r["seconds"] is not None and r["slices"]]
    return min(timed, key=lambda r: abs(int(r["slices"]) - 300)) if timed else None


def write_report(table: list[dict], out: Path, model: str, computer: str) -> Path:
    out.mkdir(parents=True, exist_ok=True)
    columns = list(table[0])
    with (out / "model_verification.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, columns, lineterminator="\n")
        writer.writeheader()
        writer.writerows(table)
    agree = sum(r["agrees"] for r in table)
    timing = timing_row(table)
    fmt = lambda v, d=4: "–" if v is None else f"{v:.{d}f}"  # noqa: E731
    lines = [
        "# Model verification",
        "",
        f"Model {model}, checked on {datetime.now(timezone.utc):%Y-%m-%d} on {computer} with "  # noqa: UP017
        "`scripts/verify_model.py`: each scan was uploaded through the application's API and "
        f"its probability of TB compared with the training toolkit's (tolerance {TOLERANCE}).",
        "",
        f"**{agree} of {len(table)} scans agree.**",
        "",
        "| Patient | Class | Slices | Toolkit | Application | Difference | Agrees | Analysis (s) |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for r in table:
        lines.append(
            f"| {r['case_id']} | {r['label']} | {r['slices']} | {fmt(r['toolkit_probability'])} | "
            f"{fmt(r['app_probability'])} | {fmt(r['difference'])} | "
            f"{'yes' if r['agrees'] else 'NO ' + r['error']} | {fmt(r['seconds'], 0)} |"
        )
    if timing:
        within = "within" if timing["seconds"] <= BUDGET_SECONDS else "OVER"
        lines += [
            "",
            f"Timing (NFR-1): {timing['case_id']}, {timing['slices']} slices, analysed in "
            f"{timing['seconds']:.0f} s on this computer's CPU: {within} the "
            f"{BUDGET_SECONDS} s budget.",
        ]
    report = out / "MODEL_VERIFICATION.md"
    report.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return report


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("folder", type=Path, help="the verification set (zips + expected.csv)")
    parser.add_argument("--url", default=None, help="default: http://localhost:<CAVINET_HTTP_PORT>")
    parser.add_argument("--out", type=Path, default=ROOT / "docs" / "verification")
    parser.add_argument("--computer", default=platform.node(), help="named in the report")
    args = parser.parse_args(argv)
    env = read_env(ROOT / ".env")
    api = Api(args.url or f"http://localhost:{env.get('CAVINET_HTTP_PORT', '8080')}")
    rows = read_expected(args.folder)
    try:
        api.login(env["DEMO_DOCTOR_EMAIL"], env["DEMO_DOCTOR_PASSWORD"])
    except (KeyError, ApiError) as error:
        print(f"Cannot sign in as the demo doctor ({error}); run `make seed` first.")
        return 1
    if api.request("GET", "/api/model/status").get("is_demo"):
        print("The demo model is installed: install the real model first (make fetch-model).")
        return 1
    results = []
    for number, row in enumerate(rows, 1):
        print(f"[{number}/{len(rows)}] {row['case_id']} ({row['label']}) …", flush=True)
        try:
            results.append(analyse(api, row, args.folder))
        except ApiError as error:
            results.append({"error": str(error)})
        print(f"    {results[-1]}", flush=True)
    table = compare(rows, results)
    versions = {r.get("model_version") for r in results if r.get("model_version")}
    report = write_report(table, args.out, ", ".join(sorted(versions)) or "unknown", args.computer)
    agree = sum(r["agrees"] for r in table)
    print(f"{agree} of {len(table)} scans agree within {TOLERANCE}. Report: {report}")
    return 0 if agree == len(table) else 1


if __name__ == "__main__":
    sys.exit(main())
