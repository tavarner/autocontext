"""Tests for AC-297 + AC-299: scenario family dispatch and type literals.

AC-297: CLI dispatch must route all non-game families (not just agent_task)
AC-299: ScenarioInfo.scenario_type must include all registered families
"""

from __future__ import annotations

# ===========================================================================
# AC-297: _is_judge_evaluated should detect all non-game families
# ===========================================================================


class TestIsJudgeEvaluated:
    def test_agent_task_is_judge_evaluated(self) -> None:
        from autocontext.cli import _is_judge_evaluated_family

        assert _is_judge_evaluated_family("agent_task") is True

    def test_negotiation_detected(self) -> None:
        from autocontext.cli import _is_judge_evaluated_family

        assert _is_judge_evaluated_family("negotiation") is True

    def test_investigation_detected(self) -> None:
        from autocontext.cli import _is_judge_evaluated_family

        assert _is_judge_evaluated_family("investigation") is True

    def test_workflow_detected(self) -> None:
        from autocontext.cli import _is_judge_evaluated_family

        assert _is_judge_evaluated_family("workflow") is True

    def test_simulation_detected(self) -> None:
        from autocontext.cli import _is_judge_evaluated_family

        assert _is_judge_evaluated_family("simulation") is True

    def test_game_is_not_judge_evaluated(self) -> None:
        from autocontext.cli import _is_judge_evaluated_family

        assert _is_judge_evaluated_family("game") is False

    def test_unknown_family_is_not_judge_evaluated(self) -> None:
        from autocontext.cli import _is_judge_evaluated_family

        assert _is_judge_evaluated_family("nonexistent") is False


# ===========================================================================
# AC-299: ScenarioInfo must accept all registered family types
# ===========================================================================


class TestScenarioInfoTypes:
    def test_negotiation_accepted(self) -> None:
        from autocontext.openclaw.models import ScenarioInfo

        info = ScenarioInfo(
            name="consulting_negotiation",
            display_name="Consulting Negotiation",
            scenario_type="negotiation",
            description="A negotiation scenario",
        )
        assert info.scenario_type == "negotiation"

    def test_schema_evolution_accepted(self) -> None:
        from autocontext.openclaw.models import ScenarioInfo

        info = ScenarioInfo(
            name="schema_evo",
            display_name="Schema Evolution",
            scenario_type="schema_evolution",
            description="A schema evolution scenario",
        )
        assert info.scenario_type == "schema_evolution"

    def test_tool_fragility_accepted(self) -> None:
        from autocontext.openclaw.models import ScenarioInfo

        info = ScenarioInfo(
            name="api_drift",
            display_name="API Drift",
            scenario_type="tool_fragility",
            description="A tool fragility scenario",
        )
        assert info.scenario_type == "tool_fragility"

    def test_operator_loop_accepted(self) -> None:
        from autocontext.openclaw.models import ScenarioInfo

        info = ScenarioInfo(
            name="ops_escalation",
            display_name="Ops Escalation",
            scenario_type="operator_loop",
            description="An operator loop scenario",
        )
        assert info.scenario_type == "operator_loop"

    def test_coordination_accepted(self) -> None:
        from autocontext.openclaw.models import ScenarioInfo

        info = ScenarioInfo(
            name="multi_agent",
            display_name="Multi-Agent",
            scenario_type="coordination",
            description="A coordination scenario",
        )
        assert info.scenario_type == "coordination"

    def test_all_registered_families_accepted(self) -> None:
        """Every registered family name should be a valid scenario_type."""
        from pydantic import ValidationError

        from autocontext.openclaw.models import ScenarioInfo
        from autocontext.scenarios.families import list_families

        for family in list_families():
            try:
                ScenarioInfo(
                    name=f"test_{family.name}",
                    display_name=f"Test {family.name}",
                    scenario_type=family.name,
                    description=f"Test {family.name} scenario",
                )
            except ValidationError as exc:
                raise AssertionError(
                    f"ScenarioInfo rejected scenario_type='{family.name}' "
                    f"but family '{family.name}' is registered"
                ) from exc
