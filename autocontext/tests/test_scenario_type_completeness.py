"""Regression test for AC-377: ensure all scenario family types are registered.

Prevents the class of bug where hardcoded allowlists fall behind the
actual type registry. External test scripts should use
get_valid_scenario_types() instead of hardcoded tuples.
"""

from __future__ import annotations

from autocontext.scenarios.type_registry import get_valid_scenario_types


class TestScenarioTypeCompleteness:
    """Verify the type registry includes all expected scenario families."""

    def test_registry_includes_original_types(self) -> None:
        """The original types (parametric=game, agent_task, simulation, etc)."""
        types = get_valid_scenario_types()
        for expected in ("parametric", "agent_task", "simulation", "artifact_editing", "investigation", "workflow"):
            assert expected in types, f"Missing original type: {expected}"

    def test_registry_includes_new_family_types(self) -> None:
        """The types added in AC-313+ that caused the L9 test failure."""
        types = get_valid_scenario_types()
        for expected in ("negotiation", "schema_evolution", "tool_fragility", "operator_loop", "coordination"):
            assert expected in types, f"Missing new family type: {expected}"

    def test_registry_has_at_least_11_types(self) -> None:
        """Guard against accidental removals."""
        types = get_valid_scenario_types()
        assert len(types) >= 11, f"Expected >= 11 types, got {len(types)}: {sorted(types)}"

    def test_types_are_frozen(self) -> None:
        """Registry returns a frozenset (immutable)."""
        types = get_valid_scenario_types()
        assert isinstance(types, frozenset)

    def test_all_types_are_lowercase_strings(self) -> None:
        """Type names should be lowercase snake_case strings."""
        types = get_valid_scenario_types()
        for t in types:
            assert isinstance(t, str)
            assert t == t.lower(), f"Type '{t}' is not lowercase"
            assert " " not in t, f"Type '{t}' contains spaces"
