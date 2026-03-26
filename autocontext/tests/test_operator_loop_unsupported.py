"""AC-432: operator_loop must be explicitly unsupported with clear guidance.

Tests verify that operator_loop is detected by the family classifier but
always fails with actionable guidance at the codegen/creator boundary.
"""

import pytest


def test_family_classifier_detects_operator_loop():
    """Classifier should recognize operator_loop signals."""
    from autocontext.scenarios.custom.family_classifier import classify_scenario_family

    result = classify_scenario_family(
        "Build a scenario that tests when an agent should escalate to a human "
        "operator versus acting autonomously, including clarification requests"
    )
    # Should detect operator_loop due to "escalate", "operator", "clarification"
    assert result.family_name == "operator_loop"


def test_operator_loop_codegen_raises():
    """Codegen must raise NotImplementedError with guidance."""
    from autocontext.scenarios.custom.operator_loop_codegen import (
        OPERATOR_LOOP_SCAFFOLDING_UNSUPPORTED,
        generate_operator_loop_class,
    )
    from autocontext.scenarios.custom.operator_loop_spec import OperatorLoopSpec

    spec = OperatorLoopSpec(
        description="test",
        environment_description="test env",
        initial_state_description="initial",
        escalation_policy={"threshold": 0.7},
        success_criteria=["correct judgment"],
        failure_modes=["over-escalation"],
        actions=[],
    )
    with pytest.raises(NotImplementedError, match="intentionally not scaffolded"):
        generate_operator_loop_class(spec, "test_op")

    assert "intentionally" in OPERATOR_LOOP_SCAFFOLDING_UNSUPPORTED


def test_operator_loop_creator_raises():
    """Creator must raise NotImplementedError with guidance."""
    from autocontext.scenarios.custom.operator_loop_creator import OperatorLoopCreator

    creator = OperatorLoopCreator(
        llm_fn=lambda s, u: "",
        knowledge_root=__import__("pathlib").Path("/tmp/test"),
    )
    with pytest.raises(NotImplementedError, match="intentionally not scaffolded"):
        creator.create("test", "test_op")


def test_operator_loop_family_registered():
    """Family metadata should exist — it's the runtime that's unsupported, not the concept."""
    from autocontext.scenarios.families import get_family

    family = get_family("operator_loop")
    assert family.name == "operator_loop"
    assert family.evaluation_mode == "judgment_evaluation"


def test_operator_loop_pipeline_registered():
    """Pipeline should exist for spec validation."""
    from autocontext.scenarios.custom.family_pipeline import has_pipeline

    assert has_pipeline("operator_loop")


def test_operator_loop_error_message_contains_alternatives():
    """Error message must suggest alternatives (AC-432 core requirement)."""
    from autocontext.scenarios.custom.operator_loop_codegen import (
        OPERATOR_LOOP_SCAFFOLDING_UNSUPPORTED,
    )

    msg = OPERATOR_LOOP_SCAFFOLDING_UNSUPPORTED
    # Must mention what to use instead
    assert "family metadata" in msg or "metadata" in msg
    assert "live-agent" in msg or "live" in msg
