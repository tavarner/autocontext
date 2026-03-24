"""Regression tests for AC-378 stale-running generation recovery."""

from __future__ import annotations

from pathlib import Path

import pytest

from autocontext.config.settings import AppSettings
from autocontext.harness.scoring.backends import get_backend

MIGRATIONS_DIR = Path(__file__).resolve().parents[1] / "migrations"


def _make_runner(tmp_path: Path):
    """Build a deterministic runner pointing at tmp_path."""
    from autocontext.loop.generation_runner import GenerationRunner

    settings = AppSettings(
        agent_provider="deterministic",
        db_path=tmp_path / "runs" / "autocontext.sqlite3",
        runs_root=tmp_path / "runs",
        knowledge_root=tmp_path / "knowledge",
        skills_root=tmp_path / "skills",
        claude_skills_path=tmp_path / ".claude" / "skills",
        event_stream_path=tmp_path / "runs" / "events.ndjson",
        matches_per_generation=2,
        max_retries=0,
        backpressure_min_delta=0.0,  # Always advance
        curator_enabled=False,
        cross_run_inheritance=False,
        coherence_check_enabled=False,
        session_reports_enabled=False,
    )
    runner = GenerationRunner(settings)
    runner.migrate(MIGRATIONS_DIR)
    return runner


def test_two_generations_both_complete(tmp_path: Path) -> None:
    """Normal multi-generation deterministic runs still complete cleanly."""
    runner = _make_runner(tmp_path)
    result = runner.run("grid_ctf", 2, run_id="stall-test")

    assert result.generations_executed == 2

    rows = runner.sqlite.get_generation_metrics("stall-test")
    assert len(rows) == 2
    assert [row["status"] for row in rows] == ["completed", "completed"]
    assert runner.sqlite.get_run("stall-test")["status"] == "completed"


def test_resume_recovers_stale_running_generation_before_retry(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A stale `running` row from a prior interrupted process is recovered and retried."""
    from autocontext.loop.generation_pipeline import GenerationPipeline

    runner = _make_runner(tmp_path)
    default_uncertainty = get_backend(runner.settings.scoring_backend).default_uncertainty
    runner.sqlite.create_run("resume-stale", "grid_ctf", 2, "local", agent_provider="deterministic")
    runner.sqlite.upsert_generation(
        "resume-stale",
        1,
        mean_score=0.55,
        best_score=0.55,
        elo=1042.0,
        wins=2,
        losses=0,
        gate_decision="advance",
        status="completed",
        scoring_backend=runner.settings.scoring_backend,
        rating_uncertainty=default_uncertainty,
    )
    runner.sqlite.upsert_generation(
        "resume-stale",
        2,
        mean_score=0.0,
        best_score=0.55,
        elo=1042.0,
        wins=0,
        losses=0,
        gate_decision="running",
        status="running",
        scoring_backend=runner.settings.scoring_backend,
        rating_uncertainty=default_uncertainty,
    )

    def fake_run_generation(self: GenerationPipeline, ctx):
        assert ctx.generation == 2
        assert ctx.previous_best == pytest.approx(0.55)
        assert ctx.challenger_elo == pytest.approx(1042.0)
        self._sqlite.upsert_generation(
            ctx.run_id,
            ctx.generation,
            mean_score=0.72,
            best_score=0.72,
            elo=1055.0,
            wins=2,
            losses=0,
            gate_decision="advance",
            status="completed",
            scoring_backend=ctx.settings.scoring_backend,
            rating_uncertainty=ctx.challenger_uncertainty,
        )
        ctx.previous_best = 0.72
        ctx.challenger_elo = 1055.0
        ctx.gate_decision = "advance"
        return ctx

    monkeypatch.setattr(GenerationPipeline, "run_generation", fake_run_generation)

    summary = runner.run("grid_ctf", 2, run_id="resume-stale")

    assert summary.generations_executed == 1
    assert runner.sqlite.get_run("resume-stale")["status"] == "completed"
    rows = runner.sqlite.get_generation_metrics("resume-stale")
    assert [row["status"] for row in rows] == ["completed", "completed"]
    assert rows[1]["best_score"] == pytest.approx(0.72)
    markers = runner.sqlite.get_recovery_markers_for_run("resume-stale")
    assert len(markers) == 1
    assert markers[0]["generation_index"] == 2


def test_interrupt_marks_run_and_generation_failed(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Interrupted generations are not left behind in `running` state."""
    from autocontext.loop.generation_pipeline import GenerationPipeline

    runner = _make_runner(tmp_path)

    def interrupted_run_generation(self: GenerationPipeline, ctx):
        raise KeyboardInterrupt("simulated interrupt")

    monkeypatch.setattr(GenerationPipeline, "run_generation", interrupted_run_generation)

    with pytest.raises(KeyboardInterrupt):
        runner.run("grid_ctf", 1, run_id="interrupt-test")

    run_row = runner.sqlite.get_run("interrupt-test")
    gen_row = runner.sqlite.get_generation("interrupt-test", 1)
    assert run_row is not None
    assert gen_row is not None
    assert run_row["status"] == "failed"
    assert gen_row["status"] == "failed"
    assert gen_row["gate_decision"] == "stalled"
