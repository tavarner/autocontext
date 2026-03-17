"""Tests for AC-313 + AC-307 + AC-316: negotiation scenario type verification.

Verifies that 'negotiation' is properly registered across all layers:
- ScenarioInfo Literal accepts it
- Family registry has it
- get_valid_scenario_types() includes it
- CLI dispatch handles non-game families
"""

from __future__ import annotations

import pytest

# ===========================================================================
# AC-307/AC-316: get_valid_scenario_types utility
# ===========================================================================


class TestGetValidScenarioTypes:
    def test_returns_all_registered_markers(self) -> None:
        from autocontext.scenarios.families import list_families
        from autocontext.scenarios.type_registry import get_valid_scenario_types

        types = get_valid_scenario_types()
        family_markers = {f.scenario_type_marker for f in list_families()}

        for marker in family_markers:
            assert marker in types, f"Marker '{marker}' missing from valid scenario types"

    def test_includes_negotiation(self) -> None:
        from autocontext.scenarios.type_registry import get_valid_scenario_types

        assert "negotiation" in get_valid_scenario_types()

    def test_includes_all_known_families(self) -> None:
        from autocontext.scenarios.type_registry import get_valid_scenario_types

        types = get_valid_scenario_types()
        for expected in (
            "parametric", "agent_task", "simulation", "artifact_editing",
            "investigation", "workflow", "negotiation", "schema_evolution",
            "tool_fragility", "operator_loop", "coordination",
        ):
            assert expected in types, f"'{expected}' missing from valid scenario types"

    def test_returns_frozen_set(self) -> None:
        from autocontext.scenarios.type_registry import get_valid_scenario_types

        types = get_valid_scenario_types()
        assert isinstance(types, frozenset)


# ===========================================================================
# AC-313: ScenarioInfo accepts negotiation
# ===========================================================================


class TestNegotiationInScenarioInfo:
    def test_negotiation_accepted(self) -> None:
        from autocontext.openclaw.models import ScenarioInfo

        info = ScenarioInfo(
            name="consulting_negotiation",
            display_name="Consulting Negotiation",
            scenario_type="negotiation",
            description="A negotiation scenario",
        )
        assert info.scenario_type == "negotiation"

    def test_all_valid_types_accepted(self) -> None:
        """Every type from get_valid_scenario_types should be accepted by ScenarioInfo."""
        from pydantic import ValidationError

        from autocontext.openclaw.models import ScenarioInfo
        from autocontext.scenarios.type_registry import get_valid_scenario_types

        for stype in get_valid_scenario_types():
            try:
                ScenarioInfo(
                    name=f"test_{stype}",
                    display_name=f"Test {stype}",
                    scenario_type=stype,
                    description=f"Test {stype} scenario",
                )
            except ValidationError as exc:
                raise AssertionError(
                    f"ScenarioInfo rejected scenario_type='{stype}'"
                ) from exc

    def test_invalid_type_rejected(self) -> None:
        from pydantic import ValidationError

        from autocontext.openclaw.models import ScenarioInfo

        with pytest.raises(ValidationError):
            ScenarioInfo(
                name="bad",
                display_name="Bad",
                scenario_type="game",
                description="Old family name should not be accepted as a scenario marker",
            )


# ===========================================================================
# AC-313: Negotiation family is registered
# ===========================================================================


class TestNegotiationFamilyRegistered:
    def test_family_exists(self) -> None:
        from autocontext.scenarios.families import get_family

        family = get_family("negotiation")
        assert family.name == "negotiation"

    def test_family_has_interface(self) -> None:
        from autocontext.scenarios.families import get_family
        from autocontext.scenarios.negotiation import NegotiationInterface

        family = get_family("negotiation")
        assert family.interface_class is NegotiationInterface

    def test_family_has_type_marker(self) -> None:
        from autocontext.scenarios.families import get_family

        family = get_family("negotiation")
        assert family.scenario_type_marker == "negotiation"
