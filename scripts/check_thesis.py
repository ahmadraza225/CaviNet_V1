"""Check the Phase 12 thesis pack (docs/thesis/ and docs/VIVA_DEMO_SCRIPT.md).

- every Mermaid source in docs/thesis/diagrams/ has its PNG export;
- the hypothesis table states an outcome for each of H1 to H5;
- every relative link in the pack points to a file that exists.

Exit code 1 lists what is wrong. Run: python scripts/check_thesis.py
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
THESIS = ROOT / "docs" / "thesis"
PACK = [*sorted(THESIS.glob("*.md")), ROOT / "docs" / "VIVA_DEMO_SCRIPT.md"]
OUTCOMES = ("Supported", "Not supported", "Not attempted")
LINK = re.compile(r"\]\(([^)#\s]+)(?:#[^)]*)?\)")


def problems(root: Path = ROOT) -> list[str]:
    thesis = root / "docs" / "thesis"
    pack = [*sorted(thesis.glob("*.md")), root / "docs" / "VIVA_DEMO_SCRIPT.md"]
    found: list[str] = []
    for doc in pack:
        if not doc.is_file():
            found.append(f"missing {doc.relative_to(root)}")
    sources = sorted((thesis / "diagrams").glob("*.mmd"))
    if len(sources) < 4:
        found.append("docs/thesis/diagrams/ needs the 4 diagrams (architecture, modules, ...)")
    for source in sources:
        if not source.with_suffix(".png").is_file():
            found.append(f"no PNG export for {source.relative_to(root)}")
    table = thesis / "HYPOTHESES.md"
    if table.is_file():
        rows = {
            line.split("|")[1].strip(): line
            for line in table.read_text(encoding="utf-8").splitlines()
            if re.match(r"\| H[1-5] \|", line)
        }
        for h in ("H1", "H2", "H3", "H4", "H5"):
            row = rows.get(h)
            if row is None:
                found.append(f"HYPOTHESES.md has no row for {h}")
            elif not any(f"**{o}**" in row for o in OUTCOMES):
                found.append(f"HYPOTHESES.md: {h} has no outcome ({', '.join(OUTCOMES)})")
    for doc in pack:
        if not doc.is_file():
            continue
        for target in LINK.findall(doc.read_text(encoding="utf-8")):
            if "://" in target or target.startswith("mailto:"):
                continue
            if not (doc.parent / target).exists():
                found.append(f"{doc.relative_to(root)}: broken link {target}")
    return found


def main() -> int:
    found = problems()
    for problem in found:
        print(problem, file=sys.stderr)
    if found:
        return 1
    print(f"Thesis pack: {len(PACK)} documents, diagrams exported, H1-H5 stated, links valid.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
