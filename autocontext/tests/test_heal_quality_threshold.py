"""AC-585 — heal_spec_quality_threshold clamps designer output into the valid range."""
from __future__ import annotations

import logging

from autocontext.scenarios.custom.agent_task_spec import AgentTaskSpec
from autocontext.scenarios.custom.spec_auto_heal import heal_spec_quality_threshold


def _spec(quality_threshold: float) -> AgentTaskSpec:
    return AgentTaskSpec(
        task_prompt="do the thing",
        judge_rubric="score 0-1",
        quality_threshold=quality_threshold,
    )


class TestHealSpecQualityThreshold:
    def test_clamps_above_one_to_one(self) -> None:
        # Designer hallucinated a >1.0 threshold (e.g. 1.5, 10); clamp to 1.0.
        healed = heal_spec_quality_threshold(_spec(1.5))
        assert healed.quality_threshold == 1.0

    def test_clamps_absurdly_large_to_one(self) -> None:
        healed = heal_spec_quality_threshold(_spec(10.0))
        assert healed.quality_threshold == 1.0

    def test_replaces_zero_with_default(self) -> None:
        # 0.0 is invalid (exclusive lower bound); fall back to the field default 0.9.
        healed = heal_spec_quality_threshold(_spec(0.0))
        assert healed.quality_threshold == 0.9

    def test_replaces_negative_with_default(self) -> None:
        healed = heal_spec_quality_threshold(_spec(-0.5))
        assert healed.quality_threshold == 0.9

    def test_preserves_valid_value(self) -> None:
        # Anything in (0.0, 1.0] passes through unchanged.
        healed = heal_spec_quality_threshold(_spec(0.7))
        assert healed.quality_threshold == 0.7

    def test_preserves_one_exactly(self) -> None:
        # 1.0 is valid (inclusive upper bound).
        healed = heal_spec_quality_threshold(_spec(1.0))
        assert healed.quality_threshold == 1.0

    def test_coerces_numeric_string_and_clamps(self) -> None:
        healed = heal_spec_quality_threshold(_spec("1.5"))  # type: ignore[arg-type]
        assert healed.quality_threshold == 1.0

    def test_invalid_string_falls_back_to_default(self) -> None:
        healed = heal_spec_quality_threshold(_spec("high"))  # type: ignore[arg-type]
        assert healed.quality_threshold == 0.9

    def test_logs_warning_when_clamping(self, caplog) -> None:
        with caplog.at_level(logging.WARNING, logger="autocontext.scenarios.custom.spec_auto_heal"):
            heal_spec_quality_threshold(_spec(1.5))
        assert any("quality_threshold" in rec.message for rec in caplog.records)

    def test_no_log_for_valid_value(self, caplog) -> None:
        with caplog.at_level(logging.WARNING, logger="autocontext.scenarios.custom.spec_auto_heal"):
            heal_spec_quality_threshold(_spec(0.7))
        assert not any("quality_threshold" in rec.message for rec in caplog.records)
