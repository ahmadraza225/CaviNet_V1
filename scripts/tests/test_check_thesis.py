"""scripts/check_thesis.py: the thesis pack check."""

import importlib.util
from pathlib import Path

SPEC = importlib.util.spec_from_file_location(
    "check_thesis", Path(__file__).resolve().parents[1] / "check_thesis.py"
)
check_thesis = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(check_thesis)


def make_pack(root: Path) -> None:
    diagrams = root / "docs" / "thesis" / "diagrams"
    diagrams.mkdir(parents=True)
    for name in ("architecture", "modules", "database", "sequence"):
        (diagrams / f"{name}.mmd").write_text("flowchart LR\n  A --> B\n")
        (diagrams / f"{name}.png").write_bytes(b"png")
    rows = "\n".join(f"| H{i} | claim | **Supported** | x |" for i in range(1, 6))
    (root / "docs" / "thesis" / "HYPOTHESES.md").write_text(
        f"# H\n\n{rows}\n\n[methods](METHODS.md#data)\n"
    )
    (root / "docs" / "thesis" / "METHODS.md").write_text("# M\n[web](https://example.org)\n")
    (root / "docs" / "VIVA_DEMO_SCRIPT.md").write_text("# Viva\n[pack](thesis/HYPOTHESES.md)\n")


def test_the_repository_pack_is_complete():
    assert check_thesis.problems() == []


def test_a_complete_pack_passes(tmp_path):
    make_pack(tmp_path)
    assert check_thesis.problems(tmp_path) == []


def test_missing_png_outcome_and_broken_link_are_reported(tmp_path):
    make_pack(tmp_path)
    thesis = tmp_path / "docs" / "thesis"
    (thesis / "diagrams" / "modules.png").unlink()
    table = thesis / "HYPOTHESES.md"
    text = table.read_text().replace("| H3 | claim | **Supported** |", "| H3 | claim | maybe |")
    table.write_text(text.replace("| H5 | claim | **Supported** | x |\n", "") + "[x](gone.md)\n")
    found = check_thesis.problems(tmp_path)
    assert any("no PNG export" in p and "modules" in p for p in found)
    assert "HYPOTHESES.md: H3 has no outcome (Supported, Not supported, Not attempted)" in found
    assert "HYPOTHESES.md has no row for H5" in found
    assert any("broken link gone.md" in p for p in found)
