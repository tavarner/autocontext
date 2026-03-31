"""Guard against reintroducing internal imports of the legacy backpressure shim."""

from __future__ import annotations

import ast
import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SRC_ROOT = PROJECT_ROOT / "src" / "autocontext"
TEST_ROOT = PROJECT_ROOT / "tests"
LEGACY_PREFIX = "autocontext.backpressure"


def _iter_python_files(root: Path) -> list[Path]:
    files: list[Path] = []
    for current_root, dirs, names in os.walk(root):
        dirs[:] = [name for name in dirs if name not in {".venv", "__pycache__"}]
        for name in names:
            if name.endswith(".py"):
                files.append(Path(current_root) / name)
    return files


def _legacy_import_lines(path: Path) -> list[int]:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    lines: list[int] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            if any(
                alias.name == LEGACY_PREFIX or alias.name.startswith(f"{LEGACY_PREFIX}.")
                for alias in node.names
            ):
                lines.append(node.lineno)
        elif isinstance(node, ast.ImportFrom) and node.module is not None:
            if node.module == LEGACY_PREFIX or node.module.startswith(f"{LEGACY_PREFIX}."):
                lines.append(node.lineno)
    return lines


def test_no_internal_imports_of_legacy_backpressure_shim() -> None:
    violations: list[str] = []
    candidates = _iter_python_files(SRC_ROOT) + _iter_python_files(TEST_ROOT)
    for path in candidates:
        if path.is_relative_to(SRC_ROOT / "backpressure"):
            continue
        lines = _legacy_import_lines(path)
        if lines:
            rel = path.relative_to(PROJECT_ROOT)
            violations.append(f"{rel}: {', '.join(str(line) for line in lines)}")

    assert violations == [], (
        "Internal code and tests should import directly from autocontext.harness.pipeline, "
        "not the legacy autocontext.backpressure shim:\n"
        + "\n".join(f"  {entry}" for entry in violations)
    )
