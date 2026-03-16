"""Tests for AC-267 research hub storage and materialization."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest

from autocontext.analytics.facets import DelightSignal, FrictionSignal, RunFacet
from autocontext.analytics.store import FacetStore
from autocontext.knowledge.normalized_metrics import (
    CostEfficiency,
    NormalizedProgress,
    RunProgressReport,
)
from autocontext.knowledge.package import ConflictPolicy
from autocontext.knowledge.research_hub import (
    HubStore,
    ResearchResult,
    ResearchSession,
    materialize_result,
)
from autocontext.knowledge.weakness import Weakness, WeaknessReport
from autocontext.storage.artifacts import ArtifactStore
from autocontext.storage.sqlite_store import SQLiteStore


def _make_session(**overrides: Any) -> ResearchSession:
    defaults: dict[str, Any] = {
        "session_id": "sess-1",
        "scenario_name": "grid_ctf",
        "owner": "operator-alice",
        "status": "active",
        "lease_expires_at": "2026-03-16T14:00:00Z",
        "last_heartbeat_at": "2026-03-16T12:00:00Z",
        "current_objective": "Maximize flag captures",
        "current_hypotheses": ["High aggression works above 0.6 density"],
        "best_run_id": "run-42",
        "best_generation": 2,
        "best_score": 0.78,
        "unresolved_questions": ["Does terrain affect optimal aggression?"],
        "operator_observations": ["Scores plateau around gen 2"],
        "follow_ups": ["Try balanced aggression=0.6"],
        "shared": True,
        "external_link": "",
        "metadata": {"owner_team": "ops"},
    }
    defaults.update(overrides)
    return ResearchSession(**defaults)


def _make_facet() -> RunFacet:
    return RunFacet(
        run_id="run-42",
        scenario="grid_ctf",
        scenario_family="game",
        agent_provider="anthropic",
        executor_mode="local",
        total_generations=2,
        advances=1,
        retries=0,
        rollbacks=1,
        best_score=0.78,
        best_elo=1200.0,
        total_duration_seconds=120.0,
        total_tokens=30000,
        total_cost_usd=0.15,
        tool_invocations=10,
        validation_failures=2,
        consultation_count=0,
        consultation_cost_usd=0.0,
        friction_signals=[
            FrictionSignal(
                signal_type="validation_failure",
                severity="medium",
                generation_index=1,
                description="Parse failure",
                evidence=["ev-1"],
            )
        ],
        delight_signals=[
            DelightSignal(
                signal_type="strong_improvement",
                generation_index=2,
                description="Big jump",
                evidence=["ev-2"],
            )
        ],
        events=[],
        metadata={},
        created_at="2026-03-16T12:00:00Z",
    )


@pytest.fixture()
def hub_env(tmp_path: Path) -> dict[str, Any]:
    db = SQLiteStore(tmp_path / "test.db")
    migrations = Path(__file__).resolve().parents[1] / "migrations"
    db.migrate(migrations)
    artifacts = ArtifactStore(
        runs_root=tmp_path / "runs",
        knowledge_root=tmp_path / "knowledge",
        skills_root=tmp_path / "skills",
        claude_skills_path=tmp_path / ".claude" / "skills",
    )
    hub = HubStore(db, artifacts, analytics_root=tmp_path / "knowledge" / "analytics")
    return {
        "sqlite": db,
        "artifacts": artifacts,
        "hub": hub,
        "tmp_path": tmp_path,
    }


def _seed_run(hub_env: dict[str, Any]) -> None:
    sqlite: SQLiteStore = hub_env["sqlite"]
    artifacts: ArtifactStore = hub_env["artifacts"]

    sqlite.create_run("run-42", "grid_ctf", 2, "local", agent_provider="anthropic")
    sqlite.upsert_generation(
        run_id="run-42",
        generation_index=1,
        mean_score=0.55,
        best_score=0.55,
        elo=1100.0,
        wins=3,
        losses=1,
        gate_decision="accepted",
        status="completed",
    )
    sqlite.upsert_generation(
        run_id="run-42",
        generation_index=2,
        mean_score=0.78,
        best_score=0.78,
        elo=1200.0,
        wins=4,
        losses=0,
        gate_decision="accepted",
        status="completed",
    )
    sqlite.append_agent_output("run-42", 1, "competitor", '{"aggression": 0.7, "defense": 0.4}')
    sqlite.append_agent_output("run-42", 2, "competitor", '{"aggression": 0.8, "defense": 0.4}')
    sqlite.mark_run_completed("run-42")

    sqlite.upsert_notebook(
        session_id="sess-1",
        scenario_name="grid_ctf",
        current_objective="Maximize flag captures",
        current_hypotheses=["High aggression works above 0.6 density"],
        best_run_id="run-42",
        best_generation=2,
        best_score=0.78,
    )

    FacetStore(artifacts.knowledge_root).persist(_make_facet())
    artifacts.write_progress_report(
        "grid_ctf",
        "run-42",
        RunProgressReport(
            run_id="run-42",
            scenario="grid_ctf",
            total_generations=2,
            advances=1,
            rollbacks=1,
            retries=0,
            progress=NormalizedProgress(
                raw_score=0.78,
                normalized_score=0.78,
                score_floor=0.0,
                score_ceiling=1.0,
                pct_of_ceiling=78.0,
            ),
            cost=CostEfficiency(
                total_input_tokens=20000,
                total_output_tokens=10000,
                total_tokens=30000,
                total_cost_usd=0.15,
            ),
        ),
    )
    artifacts.write_weakness_report(
        "grid_ctf",
        "run-42",
        WeaknessReport(
            run_id="run-42",
            scenario="grid_ctf",
            total_generations=2,
            weaknesses=[
                Weakness(
                    category="validation_failure",
                    severity="medium",
                    affected_generations=[1],
                    description="Parse failure on generation 1",
                    evidence={"count": 1},
                    frequency=1,
                )
            ],
        ),
    )


class TestResearchSessionModel:
    def test_from_notebook(self) -> None:
        from autocontext.notebook.types import SessionNotebook

        notebook = SessionNotebook(
            session_id="sess-nb",
            scenario_name="grid_ctf",
            current_objective="Test objective",
            best_run_id="run-1",
            best_score=0.5,
        )
        session = ResearchSession.from_notebook(notebook, owner="alice")
        assert session.session_id == "sess-nb"
        assert session.owner == "alice"
        assert session.current_objective == "Test objective"
        assert session.status == "active"

    def test_roundtrip(self) -> None:
        session = _make_session()
        restored = ResearchSession.from_dict(session.to_dict())
        assert restored.session_id == "sess-1"
        assert restored.metadata["owner_team"] == "ops"
        assert restored.shared is True


class TestMaterializeResult:
    def test_from_facet(self) -> None:
        result = materialize_result(_make_facet(), title="Run 42 Results")
        assert result.run_id == "run-42"
        assert result.best_score == 0.78
        assert len(result.friction_signals) == 1
        assert len(result.delight_signals) == 1


class TestHubStore:
    def test_persist_and_load_session_uses_notebook_and_sqlite(self, hub_env: dict[str, Any]) -> None:
        hub: HubStore = hub_env["hub"]
        session = _make_session()

        path = hub.persist_session(session)
        loaded = hub.load_session("sess-1")

        assert path.exists()
        assert loaded is not None
        assert loaded.owner == "operator-alice"
        assert loaded.shared is True

    def test_promote_run_to_package_persists_metadata_and_payload(self, hub_env: dict[str, Any]) -> None:
        hub: HubStore = hub_env["hub"]
        _seed_run(hub_env)
        hub.persist_session(_make_session())

        package = hub.promote_run_to_package("run-42", session_id="sess-1", actor="alice")
        loaded = hub.load_package(package.package_id)
        strategy_package = hub.load_strategy_package(package.package_id)

        assert loaded is not None
        assert loaded.source_run_id == "run-42"
        assert "grid_ctf" in loaded.compatibility_tags
        assert strategy_package is not None
        assert strategy_package.metadata.source_run_id == "run-42"
        assert any(p.action == "promote" for p in hub.list_promotions())

    def test_materialize_result_for_run_uses_reports_and_facets(self, hub_env: dict[str, Any]) -> None:
        hub: HubStore = hub_env["hub"]
        _seed_run(hub_env)

        result = hub.materialize_result_for_run("run-42")
        loaded = hub.load_result(result.result_id)

        assert isinstance(result, ResearchResult)
        assert loaded is not None
        assert "78.00% of ceiling" in loaded.normalized_progress
        assert "Parse failure" in loaded.weakness_summary
        assert loaded.metadata["scenario_family"] == "game"

    def test_adopt_package_records_promotion(self, hub_env: dict[str, Any]) -> None:
        hub: HubStore = hub_env["hub"]
        _seed_run(hub_env)
        package = hub.promote_run_to_package("run-42", actor="alice")

        adoption = hub.adopt_package(package.package_id, actor="bob", conflict_policy=ConflictPolicy.MERGE)

        assert adoption["import_result"]["scenario_name"] == "grid_ctf"
        assert any(event.action == "adopt" for event in hub.list_promotions())
