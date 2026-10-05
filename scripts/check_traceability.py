#!/usr/bin/env python3
"""Check docs/TRACEABILITY.md against the code (definition of done, section 14.3).

- Every core functional requirement (FR-01 to FR-10) is Implemented and names at least one test.
- Every test the table names exists: test files, and the test functions written as
  `file.py::test_name` (a trailing * matches a prefix). A bare `test_name` after such a
  reference is looked up in the same file.

Whether the tests pass is CI's job; this only catches a table that has drifted from the code.
Usage: python scripts/check_traceability.py
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TABLE = ROOT / "docs" / "TRACEABILITY.md"
CORE_MODULES = range(1, 11)  # M-01 to M-10
TEST_DIRS = ("backend/tests", "ml/tests", "frontend/src", "e2e/tests")
TEST_FILE = re.compile(r"(^test_.*\.py$)|(\.test\.tsx?$)|(\.spec\.ts$)")


def find_file(name: str, near: Path | None) -> Path | None:
    """A path from the repository root, or a bare file name next to `near` or in a test folder."""
    if "/" in name:
        matches = sorted(ROOT.glob(name)) if "*" in name else [ROOT / name]
        return matches[0] if matches and matches[0].exists() else None
    if near is not None and (near.parent / name).exists():
        return near.parent / name
    for folder in TEST_DIRS:
        found = sorted((ROOT / folder).rglob(name))
        if found:
            return found[0]
    return None


def has_test(path: Path, name: str) -> bool:
    pattern = re.escape(name.rstrip("*")) + (r"\w*" if name.endswith("*") else r"\b")
    return re.search(rf"^\s*(async\s+)?def {pattern}", path.read_text(), re.MULTILINE) is not None


def check_tests(cell: str) -> tuple[int, list[str]]:
    """(number of test references, problems) for one Tests cell."""
    count, problems, current = 0, [], None
    for ref in re.findall(r"`([^`]+)`", cell):
        if "::" in ref:
            file_part, test = ref.split("::", 1)
            current = find_file(file_part, current)
            if current is None:
                problems.append(f"missing test file {file_part}")
            elif not has_test(current, test):
                problems.append(f"no test {test} in {current.relative_to(ROOT)}")
            count += 1
        elif TEST_FILE.search(ref.split("/")[-1]) or ("*" in ref and "/" in ref):
            current = find_file(ref, current)
            if current is None:
                problems.append(f"missing test file {ref}")
            count += 1
        elif re.fullmatch(r"test_\w+\*?", ref):
            if current is None or current.suffix != ".py":
                problems.append(f"{ref}: no test file named before it")
            elif not has_test(current, ref):
                problems.append(f"no test {ref} in {current.relative_to(ROOT)}")
            count += 1
    return count, problems


def main() -> int:
    problems: list[str] = []
    seen: set[str] = set()
    for line in TABLE.read_text().splitlines():
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if not line.startswith("| ") or len(cells) < 4 or set(cells[0]) <= set("-: "):
            continue
        requirement = cells[0]
        # FR rows: ID | requirement | phase | implemented in | tests | status.
        # Other rows: item | implemented in | tests | status.
        tests, status = (cells[4], cells[5]) if requirement.startswith("FR-") else cells[-2:]
        count, cell_problems = check_tests(tests)
        problems += [f"{requirement[:40]}: {problem}" for problem in cell_problems]
        match = re.fullmatch(r"FR-(\d\d)\.\d+", requirement)
        if match and int(match.group(1)) in CORE_MODULES:
            seen.add(requirement)
            if not status.startswith("Implemented"):
                problems.append(f"{requirement}: core requirement is '{status}', not Implemented")
            if count == 0:
                problems.append(f"{requirement}: core requirement names no test")
    if not seen:
        problems.append("no core FR rows found")
    for problem in problems:
        print(f"TRACEABILITY.md: {problem}")
    if problems:
        return 1
    print(f"TRACEABILITY.md: {len(seen)} core requirements, every listed test exists.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
