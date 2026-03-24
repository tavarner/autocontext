"""Regression test for AC-378: multi-gen stall where gen 2 hangs in 'running' state.

The bug: `autoctx run --scenario grid_ctf --gens 2` completes gen 1 but gen 2
stays in "running" in the DB. This test verifies that multi-gen deterministic
runs complete all generations and mark them correctly.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

from autocontext.config.settings import AppSettings

MIGRATIONS_DIR = Path(__file__).resolve().parents[1] / "migrations"


def _make_runner(tmp_path: Path) -> object:
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


class TestMultiGenCompletion:
    """Verify multi-gen runs complete all generations without stalling."""

    def test_two_generations_both_complete(self, tmp_path: Path) -> None:
        """The core regression: 2-gen run must complete both generations."""
        runner = _make_runner(tmp_path)
        settings = runner.settings
        result = runner.run("grid_ctf", 2, run_id="stall-test")

        assert result.generations_executed == 2

        # Verify both generations are marked completed in SQLite
        db = sqlite3.connect(str(settings.db_path))
        db.row_factory = sqlite3.Row
        rows = db.execute(
            "SELECT generation_index, status, gate_decision FROM generations "
            "WHERE run_id = 'stall-test' ORDER BY generation_index"
        ).fetchall()
        db.close()

        assert len(rows) == 2
        assert rows[0]["generation_index"] == 1
        assert rows[0]["status"] == "completed"
        assert rows[1]["generation_index"] == 2
        assert rows[1]["status"] == "completed"
        # Neither should be stuck in "running"
        for row in rows:
            assert row["status"] != "running", (
                f"Generation {row['generation_index']} stuck in 'running' state"
            )

    def test_three_generations_all_complete(self, tmp_path: Path) -> None:
        """Verify 3-gen runs also complete correctly."""
        runner = _make_runner(tmp_path)
        settings = runner.settings
        result = runner.run("grid_ctf", 3, run_id="stall-test-3")

        assert result.generations_executed == 3

        db = sqlite3.connect(str(settings.db_path))
        db.row_factory = sqlite3.Row
        rows = db.execute(
            "SELECT generation_index, status FROM generations "
            "WHERE run_id = 'stall-test-3' ORDER BY generation_index"
        ).fetchall()
        db.close()

        assert len(rows) == 3
        for row in rows:
            assert row["status"] == "completed", (
                f"Generation {row['generation_index']} has status '{row['status']}' instead of 'completed'"
            )

    def test_run_status_is_completed(self, tmp_path: Path) -> None:
        """The run itself should be marked completed, not left in running."""
        runner = _make_runner(tmp_path)
        settings = runner.settings
        runner.run("grid_ctf", 2, run_id="status-test")

        db = sqlite3.connect(str(settings.db_path))
        db.row_factory = sqlite3.Row
        row = db.execute(
            "SELECT status FROM runs WHERE run_id = 'status-test'"
        ).fetchone()
        db.close()

        assert row is not None
        assert row["status"] == "completed"

    def test_score_progression_across_generations(self, tmp_path: Path) -> None:
        """Verify scores are tracked across generations (not reset)."""
        runner = _make_runner(tmp_path)
        result = runner.run("grid_ctf", 2, run_id="score-test")

        # Both generations should have non-zero scores
        assert result.best_score > 0
        assert result.current_elo != 1000.0  # Elo should have moved
