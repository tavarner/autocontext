from __future__ import annotations


def test_compact_prompt_components_keeps_recent_experiment_sections() -> None:
    from autocontext.knowledge.compaction import compact_prompt_components

    components = {
        "experiment_log": (
            "## RLM Experiment Log\n\n"
            "### Generation 1\n"
            + ("noise line\n" * 120)
            + "\n### Generation 7\n"
            + "- Root cause: overfitting to stale hints\n"
            + "- Keep broader opening exploration\n"
        ),
    }

    compacted = compact_prompt_components(components)

    assert "Generation 7" in compacted["experiment_log"]
    assert "overfitting to stale hints" in compacted["experiment_log"]
    assert len(compacted["experiment_log"]) < len(components["experiment_log"])


def test_compact_prompt_components_extracts_key_session_report_lines() -> None:
    from autocontext.knowledge.compaction import compact_prompt_components

    components = {
        "session_reports": (
            "# Session Report: run_old\n"
            "Long narrative that meanders without much signal.\n"
            + ("filler paragraph\n" * 80)
            + "\n## Findings\n"
            "- Preserve the rollback guard after failed harness mutations.\n"
            "- Prefer notebook freshness filtering before prompt injection.\n"
        ),
    }

    compacted = compact_prompt_components(components)

    assert "rollback guard" in compacted["session_reports"]
    assert "freshness filtering" in compacted["session_reports"]
    assert len(compacted["session_reports"]) < len(components["session_reports"])
