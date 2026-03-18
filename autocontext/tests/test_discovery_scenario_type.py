"""Tests for AC-333: discovery path returns correct scenario_type for all families.

Verifies that _build_scenario_info returns scenario_type values that
match the type_registry, specifically for negotiation scenarios.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any
from unittest.mock import patch

from autocontext.scenarios.agent_task import AgentTaskInterface, AgentTaskResult
from autocontext.scenarios.base import ScenarioInterface
from autocontext.scenarios.simulation import SimulationInterface, SimulationResult


class _MockGameScenario(ScenarioInterface):
    name = "test_game"

    def describe_rules(self) -> str:
        return "A test game"

    def describe_strategy_interface(self) -> str:
        return '{"move": "string"}'

    def describe_evaluation_criteria(self) -> str:
        return "Win the game"

    def initial_state(self, seed: int | None = None) -> dict[str, Any]:
        return {}

    def get_observation(self, state: Any, player_id: str) -> Any:
        return {}

    def validate_actions(self, state: Any, player_id: str, actions: Any) -> tuple[bool, str]:
        return True, ""

    def step(self, state: Any, actions: Any) -> dict[str, Any]:
        return {}

    def is_terminal(self, state: Any) -> bool:
        return True

    def get_result(self, state: Any) -> Any:
        return {"winner": "player_1"}

    def replay_to_narrative(self, replay: list[dict[str, Any]]) -> str:
        return ""

    def render_frame(self, state: Any) -> dict[str, Any]:
        return {}


class _MockAgentTask(AgentTaskInterface):
    def get_task_prompt(self, state: dict) -> str:
        return "Do the task"

    def evaluate_output(self, output: str, state: dict, **kwargs: Any) -> AgentTaskResult:
        return AgentTaskResult(score=0.5, reasoning="ok")

    def get_rubric(self) -> str:
        return "Rubric"

    def initial_state(self, seed: int | None = None) -> dict:
        return {}

    def describe_task(self) -> str:
        return "An agent task"


class _MockSimulation(SimulationInterface):
    name = "test_simulation"

    def describe_scenario(self) -> str:
        return "A test simulation"

    def describe_environment(self):  # type: ignore[override]
        return SimpleNamespace(
            name="test",
            description="test",
            available_actions=[],
            initial_state_description="",
            success_criteria=[],
            failure_modes=[],
        )

    def initial_state(self, seed: int | None = None) -> dict[str, Any]:
        return {}

    def get_available_actions(self, state: dict[str, Any]) -> list[Any]:
        return []

    def execute_action(self, state: dict[str, Any], action: Any):  # type: ignore[override]
        from autocontext.scenarios.simulation import ActionResult

        return ActionResult(success=True, output="", state_changes={}), state

    def is_terminal(self, state: Any) -> bool:
        return True

    def evaluate_trace(self, trace: Any, final_state: dict[str, Any]) -> SimulationResult:
        return SimulationResult(
            score=0.5,
            reasoning="ok",
            dimension_scores={},
            workflow_complete=True,
            actions_taken=0,
            actions_successful=0,
        )

    def get_rubric(self) -> str:
        return "Rubric"


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

    def test_build_scenario_info_uses_family_marker_for_multiple_families(self) -> None:
        """Discovery should emit family markers for representative scenario families."""
        from autocontext.openclaw.skill import _build_scenario_info
        from autocontext.scenarios.type_registry import get_valid_scenario_types

        valid_types = get_valid_scenario_types()
        with patch.dict(
            "autocontext.openclaw.skill.SCENARIO_REGISTRY",
            {
                "test_game": _MockGameScenario,
                "test_agent_task": _MockAgentTask,
                "test_simulation": _MockSimulation,
            },
        ):
            expected_markers = {
                "test_game": "parametric",
                "test_agent_task": "agent_task",
                "test_simulation": "simulation",
            }
            for scenario_name, expected_marker in expected_markers.items():
                info = _build_scenario_info(scenario_name)
                assert info.scenario_type == expected_marker
                assert info.scenario_type in valid_types

    def test_family_markers_are_unique_and_round_trip(self) -> None:
        """Registry markers should be unique and resolve back to the same family."""
        from autocontext.scenarios.families import get_family_by_marker, list_families

        families = list_families()
        markers = [family.scenario_type_marker for family in families]

        assert len(markers) == len(set(markers))
        for family in families:
            resolved = get_family_by_marker(family.scenario_type_marker)
            assert resolved.name == family.name
            assert resolved.scenario_type_marker == family.scenario_type_marker
