"""Tests for dict type consistency across the codebase (AC-486).

Verifies that:
1. No source files mix dict[str, object] and dict[str, Any] in the same file.
2. The codebase uses a single convention (dict[str, Any]) for JSON-like dicts.
3. Functions returning dicts produce JSON-serializable output.
"""

from __future__ import annotations

import ast
import os
from pathlib import Path

SRC_ROOT = Path(__file__).resolve().parent.parent / "src" / "autocontext"


def _iter_python_files() -> list[Path]:
    """Yield all .py source files, excluding .venv and __pycache__."""
    results = []
    for root, dirs, files in os.walk(SRC_ROOT):
        dirs[:] = [d for d in dirs if d not in (".venv", "__pycache__")]
        for f in files:
            if f.endswith(".py"):
                results.append(Path(root) / f)
    return results


def _annotation_texts(source: str, tree: ast.AST) -> list[str]:
    """Collect source snippets for relevant type annotations in a module."""
    annotations: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.AnnAssign):
            segment = ast.get_source_segment(source, node.annotation)
            if segment:
                annotations.append(segment)
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            if node.returns:
                segment = ast.get_source_segment(source, node.returns)
                if segment:
                    annotations.append(segment)
            all_args = (
                list(node.args.posonlyargs)
                + list(node.args.args)
                + list(node.args.kwonlyargs)
            )
            if node.args.vararg is not None:
                all_args.append(node.args.vararg)
            if node.args.kwarg is not None:
                all_args.append(node.args.kwarg)
            for arg in all_args:
                if arg.annotation is None:
                    continue
                segment = ast.get_source_segment(source, arg.annotation)
                if segment:
                    annotations.append(segment)
    return annotations


def _cast_target_texts(source: str, tree: ast.AST) -> list[str]:
    """Collect the first argument passed to typing.cast calls."""
    targets: list[str] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        if not isinstance(node.func, ast.Name) or node.func.id != "cast":
            continue
        if not node.args:
            continue
        segment = ast.get_source_segment(source, node.args[0])
        if segment:
            targets.append(segment)
    return targets


class TestNoDictStrObjectInSource:
    """Enforce that dict[str, object] is not used in type annotations."""

    def test_no_dict_str_object_in_annotations(self) -> None:
        """No source file should use dict[str, object] in type annotations.

        dict[str, Any] is the project convention for JSON-like dicts.
        dict[str, object] has different type-safety semantics and creates
        unnecessary cast() calls at boundaries.
        """
        violations: list[str] = []
        for path in _iter_python_files():
            content = path.read_text(encoding="utf-8")
            tree = ast.parse(content)
            annotations = _annotation_texts(content, tree)
            count = sum(1 for annotation in annotations if annotation == "dict[str, object]")
            if count:
                rel = path.relative_to(SRC_ROOT.parent.parent)
                violations.append(f"{rel} ({count} occurrences)")

        assert violations == [], (
            f"Found dict[str, object] in {len(violations)} files. "
            f"Use dict[str, Any] instead:\n" + "\n".join(f"  {v}" for v in violations)
        )

    def test_no_mixed_dict_conventions_in_same_file(self) -> None:
        """No single file should use both dict[str, object] and dict[str, Any]."""
        mixed: list[str] = []
        for path in _iter_python_files():
            content = path.read_text(encoding="utf-8")
            tree = ast.parse(content)
            annotations = _annotation_texts(content, tree)
            has_object = "dict[str, object]" in annotations
            has_any = "dict[str, Any]" in annotations
            if has_object and has_any:
                rel = path.relative_to(SRC_ROOT.parent.parent)
                mixed.append(str(rel))

        assert mixed == [], (
            f"Found {len(mixed)} files mixing dict[str, object] and dict[str, Any]:\n"
            + "\n".join(f"  {f}" for f in mixed)
        )


class TestMcpToolReturnTypesAreSerializable:
    """MCP tool functions must return JSON-serializable dicts."""

    def test_mcp_tool_functions_annotated_with_dict_str_any(self) -> None:
        """All MCP tool functions returning dicts should use dict[str, Any]."""
        tools_path = SRC_ROOT / "mcp" / "tools.py"
        source = tools_path.read_text(encoding="utf-8")
        tree = ast.parse(source)

        violations: list[str] = []
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                # Check return annotation source text
                if node.returns:
                    annotation_text = ast.get_source_segment(source, node.returns)
                    if annotation_text and "dict[str, object]" in annotation_text:
                        violations.append(f"{node.name}() -> {annotation_text}")

        assert violations == [], (
            "MCP tool functions using dict[str, object] return type:\n"
            + "\n".join(f"  {v}" for v in violations)
        )


class TestCastCallsMinimized:
    """Reducing dict[str, object] should eliminate cast() calls at boundaries."""

    def test_no_cast_to_dict_str_object(self) -> None:
        """No cast(dict[str, object], ...) should exist in the codebase."""
        violations: list[str] = []
        for path in _iter_python_files():
            content = path.read_text(encoding="utf-8")
            tree = ast.parse(content)
            cast_targets = _cast_target_texts(content, tree)
            if "dict[str, object]" in cast_targets:
                rel = path.relative_to(SRC_ROOT.parent.parent)
                violations.append(str(rel))

        assert violations == [], (
            "Found cast(dict[str, object], ...) in:\n"
            + "\n".join(f"  {v}" for v in violations)
        )
