"""Tests for AC-333: discovery path returns correct scenario_type for all families.

Verifies that _build_scenario_info returns scenario_type values that
match the type_registry, specifically for negotiation scenarios.
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import patch


class TestDiscoveryScenarioType:
    def test_negotiation_scenario_type(self) -> None:
        """Discovery path should return scenario_type='negotiation' for negotiation scenarios."""
        from autocontext.openclaw.skill import _build_scenario_info
        from autocontext.scenarios.negotiation import NegotiationInterface

        class MockNegotiation(NegotiationInterface):
            name = "test_negotiation"

            def describe_scenario(self) -> str:
                return "A test negotiation"

            def describe_environment(self):  # type: ignore[override]
                return SimpleNamespace(
                    name="test", description="test", available_actions=[],
                    initial_state_description="", success_criteria=[], failure_modes=[],
                )

            def initial_state(self, seed=None):  # type: ignore[override]
                return {}

            def get_available_actions(self, state):  # type: ignore[override]
                return []

            def execute_action(self, state, action):  # type: ignore[override]
                from autocontext.scenarios.simulation import ActionResult
                return ActionResult(success=True, output="", state_changes={}), state

            def is_terminal(self, state):  # type: ignore[override]
                return True

            def evaluate_trace(self, trace, final_state):  # type: ignore[override]
                from autocontext.scenarios.simulation import SimulationResult
                return SimulationResult(
                    score=0.5, reasoning="ok", dimension_scores={},
                    workflow_complete=True, actions_taken=0, actions_successful=0,
                )

            def get_rubric(self) -> str:
                return "test rubric"

            def get_hidden_preferences(self, state):  # type: ignore[override]
                from autocontext.scenarios.negotiation import HiddenPreferences
                return HiddenPreferences(priorities={}, reservation_value=0, aspiration_value=100)

            def get_rounds(self, state):  # type: ignore[override]
                return []

            def get_opponent_model(self, state):  # type: ignore[override]
                return None

            def update_opponent_model(self, state, model):  # type: ignore[override]
                return state

            def evaluate_negotiation(self, state):  # type: ignore[override]
                from autocontext.scenarios.negotiation import NegotiationResult
                return NegotiationResult(
                    score=0.5, reasoning="ok", dimension_scores={},
                    deal_value=0, rounds_used=0, max_rounds=5,
                    opponent_model_accuracy=0, value_claimed_ratio=0,
                )

        with patch.dict(
            "autocontext.openclaw.skill.SCENARIO_REGISTRY",
            {"test_negotiation": MockNegotiation},
        ):
            info = _build_scenario_info("test_negotiation")

        assert info.scenario_type == "negotiation"

    def test_all_families_produce_valid_scenario_type(self) -> None:
        """Every registered family's scenario_type_marker should be in get_valid_scenario_types."""
        from autocontext.scenarios.families import list_families
        from autocontext.scenarios.type_registry import get_valid_scenario_types

        valid_types = get_valid_scenario_types()
        for family in list_families():
            assert family.scenario_type_marker in valid_types, (
                f"Family '{family.name}' has scenario_type_marker='{family.scenario_type_marker}' "
                f"which is not in get_valid_scenario_types()"
            )

    def test_scenario_type_marker_matches_family_name(self) -> None:
        """For current families, scenario_type_marker should equal the family name."""
        from autocontext.scenarios.families import list_families

        for family in list_families():
            # All current families use name == marker. This test catches drift.
            if family.name == "game":
                # game uses "parametric" as marker
                assert family.scenario_type_marker == "parametric"
            else:
                assert family.scenario_type_marker == family.name, (
                    f"Family '{family.name}' has marker '{family.scenario_type_marker}' — "
                    f"expected '{family.name}'"
                )
