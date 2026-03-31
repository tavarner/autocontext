"""Guards intentional removal of retired harness modules."""

from __future__ import annotations

import ast
import importlib
import os
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SRC_ROOT = PROJECT_ROOT / "src" / "autocontext"
TEST_ROOT = PROJECT_ROOT / "tests"

REMOVED_MODULES = (
    "autocontext.harness.identity",
    "autocontext.harness.identity.evolution",
    "autocontext.harness.identity.store",
    "autocontext.harness.identity.types",
    "autocontext.harness.trust",
    "autocontext.harness.trust.policy",
    "autocontext.harness.trust.tracker",
    "autocontext.harness.trust.types",
    "autocontext.harness.heartbeat",
    "autocontext.harness.heartbeat.monitor",
    "autocontext.harness.heartbeat.types",
    "autocontext.harness.pipeline.tiered_gate",
    "autocontext.harness.validation.strategy_validator",
)


def _iter_python_files(root: Path) -> list[Path]:
    files: list[Path] = []
    for current_root, dirs, names in os.walk(root):
        dirs[:] = [name for name in dirs if name not in {".venv", "__pycache__"}]
        for name in names:
            if name.endswith(".py"):
                files.append(Path(current_root) / name)
    return files


def _removed_import_lines(path: Path) -> list[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    hits: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                if alias.name in REMOVED_MODULES:
                    hits.append(f"{alias.name}:{node.lineno}")
        elif isinstance(node, ast.ImportFrom) and node.module is not None:
            if node.module in REMOVED_MODULES:
                hits.append(f"{node.module}:{node.lineno}")
    return hits


@pytest.mark.parametrize("module_name", REMOVED_MODULES)
def test_removed_harness_modules_are_not_importable(module_name: str) -> None:
    with pytest.raises(ModuleNotFoundError):
        importlib.import_module(module_name)


def test_no_internal_imports_of_removed_harness_modules() -> None:
    violations: list[str] = []
    for path in _iter_python_files(SRC_ROOT) + _iter_python_files(TEST_ROOT):
        lines = _removed_import_lines(path)
        if lines:
            rel = path.relative_to(PROJECT_ROOT)
            violations.append(f"{rel}: {', '.join(lines)}")

    assert violations == [], (
        "Deleted harness modules should not be imported anywhere in source or tests:\n"
        + "\n".join(f"  {entry}" for entry in violations)
    )
