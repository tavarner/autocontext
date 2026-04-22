from __future__ import annotations

from autocontext.scenarios.base import Observation


def test_build_prompt_bundle_accepts_role_specific_evidence_manifests() -> None:
    from autocontext.prompts.templates import build_prompt_bundle

    bundle = build_prompt_bundle(
        scenario_rules="rules",
        strategy_interface="interface",
        evaluation_criteria="criteria",
        previous_summary="summary",
        observation=Observation(narrative="test", state={}, constraints=[]),
        current_playbook="playbook",
        available_tools="tools",
        evidence_manifests={
            "analyst": "## Prior-Run Evidence (Analyst)\nA1",
            "architect": "## Prior-Run Evidence (Architect)\nB1",
        },
    )

    assert "Prior-Run Evidence (Analyst)" in bundle.analyst
    assert "Prior-Run Evidence (Architect)" in bundle.architect
    assert "Prior-Run Evidence (Architect)" not in bundle.analyst
