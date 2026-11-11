"""scripts/verify_model.py against a fake CaviNet API (no Docker needed)."""

import csv
import importlib.util
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[1] / "verify_model.py"
spec = importlib.util.spec_from_file_location("verify_model", SCRIPT)
verify_model = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verify_model)


class FakeApi:
    """Just enough of the API: sign-in, model status, patients, upload, case, result."""

    def __init__(self, probabilities: dict[str, float], is_demo: bool = False):
        self.probabilities = probabilities  # by uploaded zip name
        self.is_demo = is_demo
        self.patients: dict[str, dict] = {}
        self.cases: dict[str, dict] = {}
        self.uploaded: dict[str, int] = {}

    def handler(self):
        api = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def reply(self, status: int, body=None):
                data = b"" if body is None else json.dumps(body).encode()
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)

            def body(self) -> bytes:
                return self.rfile.read(int(self.headers.get("Content-Length", 0)))

            def do_POST(self):
                data = self.body()
                if self.path == "/api/auth/login":
                    return self.reply(200, {"access_token": "token"})
                assert self.headers["Authorization"] == "Bearer token"
                if self.path == "/api/patients":
                    patient = json.loads(data) | {"id": f"p{len(api.patients)}"}
                    api.patients[patient["id"]] = patient
                    return self.reply(201, patient)
                name = data.split(b'filename="')[1].split(b'"')[0].decode()
                api.uploaded[name] = len(data)
                case_id = f"c{len(api.cases)}"
                api.cases[case_id] = {"name": name, "polls": 0}
                return self.reply(202, {"id": case_id, "status": "queued"})

            def do_GET(self):
                if self.path == "/api/model/status":
                    return self.reply(200, {"is_demo": api.is_demo})
                case_id = self.path.split("/")[3]
                case = api.cases[case_id]
                if self.path.endswith("/result"):
                    return self.reply(
                        200,
                        {
                            "probability_tb": api.probabilities[case["name"]],
                            "predicted_class": "TB",
                            "is_demo": api.is_demo,
                            "model": {"version": "model-v1"},
                            "processing_seconds": 95.0,
                        },
                    )
                case["polls"] += 1
                status = "completed" if case["polls"] > 1 else "analysing"
                return self.reply(
                    200, {"id": case_id, "status": status, "scan": {"num_slices": 301}}
                )

            def do_DELETE(self):
                patient_id = self.path.split("/")[3].split("?")[0]
                mr = api.patients.pop(patient_id)["mr_number"]
                assert self.path.endswith(f"?confirm={mr}")
                return self.reply(204)

        return Handler


@pytest.fixture
def run(tmp_path, monkeypatch):
    monkeypatch.setattr(verify_model, "POLL_SECONDS", 0)
    folder = tmp_path / "verification"
    folder.mkdir()
    rows = [("TB_0001", "TB", 0.81), ("Case_0002", "NTM", 0.22)]
    with (folder / "expected.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["case_id", "label", "toolkit_probability", "slices", "zip"])
        for case_id, label, probability in rows:
            (folder / f"{case_id}.zip").write_bytes(b"PK" + b"x" * 5000)
            writer.writerow([case_id, label, probability, 301, f"{case_id}.zip"])
    env = tmp_path / ".env"
    env.write_text("DEMO_DOCTOR_EMAIL=doctor@x.local\nDEMO_DOCTOR_PASSWORD=pw\n", encoding="utf-8")
    monkeypatch.setattr(verify_model, "ROOT", tmp_path)

    def go(app_probabilities: dict[str, float], is_demo: bool = False):
        api = FakeApi(app_probabilities, is_demo)
        server = ThreadingHTTPServer(("127.0.0.1", 0), api.handler())
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            url = f"http://127.0.0.1:{server.server_port}"
            code = verify_model.main([str(folder), "--url", url, "--out", str(tmp_path / "out")])
        finally:
            server.shutdown()
        return code, api, tmp_path / "out"

    return go


def test_agreeing_scans_pass_and_are_reported(run):
    code, api, out = run({"TB_0001.zip": 0.812, "Case_0002.zip": 0.215})
    assert code == 0
    assert api.patients == {}  # every verification patient was deleted
    assert all(size > 5000 for size in api.uploaded.values())  # the whole zip was sent
    report = (out / "MODEL_VERIFICATION.md").read_text(encoding="utf-8")
    assert "**2 of 2 scans agree.**" in report and "model-v1" in report
    assert "301 slices, analysed in 95 s" in report and "within the 180 s budget" in report
    with (out / "model_verification.csv").open(encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    assert [r["agrees"] for r in rows] == ["True", "True"]


def test_a_difference_above_the_tolerance_fails(run):
    code, _, out = run({"TB_0001.zip": 0.81, "Case_0002.zip": 0.25})
    assert code == 1
    assert "**1 of 2 scans agree.**" in (out / "MODEL_VERIFICATION.md").read_text(encoding="utf-8")


def test_the_demo_model_is_refused(run):
    code, api, out = run({}, is_demo=True)
    assert code == 1 and not api.uploaded and not out.exists()
