"""Tests for the generic scenario creator (AC-471).

Verifies that GenericScenarioCreator replaces per-family creator classes
with a single parameterized implementation.
"""

from __future__ import annotations

import ast
import os
from pathlib import Path

import pytest

SRC_ROOT = Path(__file__).resolve().parent.parent / "src" / "autocontext"


class TestGenericCreatorExists:
    """The generic creator module should exist and be importable."""

    def test_generic_creator_importable(self) -> None:
        from autocontext.scenarios.custom.generic_creator import GenericScenarioCreator

        assert GenericScenarioCreator is not None

    def test_generic_creator_has_create_method(self) -> None:
        from autocontext.scenarios.custom.generic_creator import GenericScenarioCreator

        assert hasattr(GenericScenarioCreator, "create")


class TestPerFamilyCreatorsRemoved:
    """Per-family creator files should be replaced by the generic creator."""

    FAMILY_CREATORS = [
        "artifact_editing_creator.py",
        "coordination_creator.py",
        "investigation_creator.py",
        "negotiation_creator.py",
        "operator_loop_creator.py",
        "schema_evolution_creator.py",
        "simulation_creator.py",
        "tool_fragility_creator.py",
        "workflow_creator.py",
    ]

    def test_per_family_creators_removed(self) -> None:
        custom_dir = SRC_ROOT / "scenarios" / "custom"
        remaining = [
            f for f in self.FAMILY_CREATORS
            if (custom_dir / f).exists()
        ]
        assert remaining == [], (
            f"Per-family creator files should be replaced by GenericScenarioCreator:\n"
            + "\n".join(f"  {f}" for f in remaining)
        )


class TestGenericCreatorReducesFiles:
    """The custom scenarios directory should have fewer files after genericization."""

    def test_custom_dir_file_count_reduced(self) -> None:
        custom_dir = SRC_ROOT / "scenarios" / "custom"
        py_files = [f for f in custom_dir.glob("*.py") if f.name != "__init__.py"]
        # Before: 54 files. After removing 9 creators: 45.
        # Target: under 46 files.
        assert len(py_files) <= 46, (
            f"scenarios/custom/ has {len(py_files)} .py files (target: ≤46). "
            f"Replace per-family creators with GenericScenarioCreator."
        )
