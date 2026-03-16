"""Tests for AC-267: research hub substrate — models, materialization, store.

Covers: ResearchSession, SharedPackage, ResearchResult, PromotionEvent,
materialize_result, HubStore.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------


def _make_session(**overrides: Any) -> Any:
    from autocontext.knowledge.research_hub import ResearchSession

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
        "best_generation": 5,
        "best_score": 0.78,
        "unresolved_questions": ["Does terrain affect optimal aggression?"],
        "operator_observations": ["Scores plateau around gen 4-5"],
        "follow_ups": ["Try balanced aggression=0.6"],
        "shared": True,
        "external_link": "",
    }
    defaults.update(overrides)
    return ResearchSession(**defaults)


def _make_package(**overrides: Any) -> Any:
    from autocontext.knowledge.research_hub import SharedPackage

    defaults: dict[str, Any] = {
        "package_id": "pkg-1",
        "scenario_name": "grid_ctf",
        "scenario_family": "game",
        "source_run_id": "run-42",
        "source_generation": 5,
        "title": "High-Aggression Grid CTF Strategy",
        "description": "Optimized for dense grids with high resource density.",
        "strategy": {"aggression": 0.8, "defense": 0.4},
        "provider_summary": "anthropic / claude-sonnet",
        "executor_summary": "local",
        "best_score": 0.78,
        "best_elo": 1200.0,
        "normalized_progress": "3 advances, 1 retry, 1 rollback over 5 generations",
        "weakness_summary": "Low defense makes flag loss likely in sparse grids",
        "result_summary": "Peaked at 0.78 with stable improvement trend",
        "notebook_hypotheses": ["High aggression works above 0.6 density"],
        "linked_artifacts": ["knowledge/grid_ctf/playbook.md"],
        "compatibility_tags": ["grid_ctf", "dense_grids", "anthropic"],
        "adoption_notes": "",
        "promotion_level": "experimental",
        "created_at": "2026-03-16T12:00:00Z",
    }
    defaults.update(overrides)
    return SharedPackage(**defaults)


def _make_result(**overrides: Any) -> Any:
    from autocontext.knowledge.research_hub import ResearchResult

    defaults: dict[str, Any] = {
        "result_id": "res-1",
        "scenario_name": "grid_ctf",
        "run_id": "run-42",
        "package_id": "pkg-1",
        "title": "Grid CTF Run 42 Results",
        "summary": "Peaked at 0.78 across 5 generations with stable trend.",
        "best_score": 0.78,
        "best_elo": 1200.0,
        "normalized_progress": "3 advances, 1 retry, 1 rollback",
        "cost_summary": "$0.15 total, 30k tokens",
        "weakness_summary": "Low defense in sparse grids",
        "consultation_summary": "",
        "friction_signals": ["validation_failure at gen 2"],
        "delight_signals": ["fast_advance at gen 1", "strong_improvement at gen 3"],
        "created_at": "2026-03-16T12:00:00Z",
        "tags": ["grid_ctf", "high_aggression"],
    }
    defaults.update(overrides)
    return ResearchResult(**defaults)


def _make_facet() -> Any:
    from autocontext.analytics.facets import (
        DelightSignal,
        FrictionSignal,
        RunFacet,
    )

    return RunFacet(
        run_id="run-42",
        scenario="grid_ctf",
        scenario_family="game",
        agent_provider="anthropic",
        executor_mode="local",
        total_generations=5,
        advances=3, retries=1, rollbacks=1,
        best_score=0.78, best_elo=1200.0,
        total_duration_seconds=120.0,
        total_tokens=30000, total_cost_usd=0.15,
        tool_invocations=10, validation_failures=2,
        consultation_count=0, consultation_cost_usd=0.0,
        friction_signals=[
            FrictionSignal(
                signal_type="validation_failure", severity="medium",
                generation_index=2, description="Parse failure",
                evidence=["ev-1"],
            ),
        ],
        delight_signals=[
            DelightSignal(
                signal_type="fast_advance", generation_index=1,
                description="Quick advance", evidence=["ev-2"],
            ),
            DelightSignal(
                signal_type="strong_improvement", generation_index=3,
                description="Big jump", evidence=["ev-3"],
            ),
        ],
        events=[], metadata={},
        created_at="2026-03-16T12:00:00Z",
    )


# ===========================================================================
# ResearchSession
# ===========================================================================


class TestResearchSession:
    def test_construction(self) -> None:
        session = _make_session()
        assert session.session_id == "sess-1"
        assert session.owner == "operator-alice"
        assert session.status == "active"
        assert session.shared is True

    def test_roundtrip(self) -> None:
        from autocontext.knowledge.research_hub import ResearchSession

        session = _make_session()
        d = session.to_dict()
        restored = ResearchSession.from_dict(d)
        assert restored.session_id == "sess-1"
        assert restored.owner == "operator-alice"
        assert restored.shared is True

    def test_from_notebook(self) -> None:
        from autocontext.knowledge.research_hub import ResearchSession
        from autocontext.notebook.types import SessionNotebook

        nb = SessionNotebook(
            session_id="sess-nb",
            scenario_name="grid_ctf",
            current_objective="Test objective",
            best_run_id="run-1",
            best_score=0.5,
        )
        session = ResearchSession.from_notebook(nb, owner="alice")
        assert session.session_id == "sess-nb"
        assert session.owner == "alice"
        assert session.current_objective == "Test objective"
        assert session.status == "active"


# ===========================================================================
# SharedPackage
# ===========================================================================


class TestSharedPackage:
    def test_construction(self) -> None:
        pkg = _make_package()
        assert pkg.package_id == "pkg-1"
        assert pkg.promotion_level == "experimental"
        assert pkg.best_score == 0.78

    def test_roundtrip(self) -> None:
        from autocontext.knowledge.research_hub import SharedPackage

        pkg = _make_package()
        d = pkg.to_dict()
        restored = SharedPackage.from_dict(d)
        assert restored.package_id == "pkg-1"
        assert restored.strategy == {"aggression": 0.8, "defense": 0.4}
        assert restored.compatibility_tags == ["grid_ctf", "dense_grids", "anthropic"]


# ===========================================================================
# ResearchResult
# ===========================================================================


class TestResearchResult:
    def test_construction(self) -> None:
        result = _make_result()
        assert result.result_id == "res-1"
        assert result.best_score == 0.78
        assert len(result.delight_signals) == 2

    def test_roundtrip(self) -> None:
        from autocontext.knowledge.research_hub import ResearchResult

        result = _make_result()
        d = result.to_dict()
        restored = ResearchResult.from_dict(d)
        assert restored.result_id == "res-1"
        assert restored.tags == ["grid_ctf", "high_aggression"]


# ===========================================================================
# PromotionEvent
# ===========================================================================


class TestPromotionEvent:
    def test_construction(self) -> None:
        from autocontext.knowledge.research_hub import PromotionEvent

        evt = PromotionEvent(
            event_id="promo-1",
            package_id="pkg-1",
            source_run_id="run-42",
            action="promote",
            actor="operator-alice",
            label="experimental",
            created_at="2026-03-16T12:00:00Z",
        )
        assert evt.action == "promote"
        assert evt.label == "experimental"

    def test_roundtrip(self) -> None:
        from autocontext.knowledge.research_hub import PromotionEvent

        evt = PromotionEvent(
            event_id="promo-2",
            package_id="pkg-1",
            source_run_id="run-42",
            action="adopt",
            actor="operator-bob",
            label=None,
            created_at="2026-03-16T13:00:00Z",
        )
        d = evt.to_dict()
        restored = PromotionEvent.from_dict(d)
        assert restored.action == "adopt"
        assert restored.label is None


# ===========================================================================
# materialize_result
# ===========================================================================


class TestMaterializeResult:
    def test_from_facet(self) -> None:
        from autocontext.knowledge.research_hub import materialize_result

        facet = _make_facet()
        result = materialize_result(facet, title="Run 42 Results")

        assert result.run_id == "run-42"
        assert result.scenario_name == "grid_ctf"
        assert result.best_score == 0.78
        assert result.best_elo == 1200.0
        assert "30000" in result.cost_summary or "30k" in result.cost_summary.lower()
        assert len(result.friction_signals) == 1
        assert len(result.delight_signals) == 2

    def test_includes_weakness_summary(self) -> None:
        from autocontext.knowledge.research_hub import materialize_result

        facet = _make_facet()
        result = materialize_result(
            facet,
            title="Test",
            weakness_summary="Defense is weak in sparse grids",
        )
        assert "Defense is weak" in result.weakness_summary

    def test_empty_facet(self) -> None:
        from autocontext.analytics.facets import RunFacet
        from autocontext.knowledge.research_hub import materialize_result

        facet = RunFacet(
            run_id="run-empty", scenario="test", scenario_family="",
            agent_provider="", executor_mode="",
            total_generations=0, advances=0, retries=0, rollbacks=0,
            best_score=0.0, best_elo=0.0,
            total_duration_seconds=0.0,
            total_tokens=0, total_cost_usd=0.0,
            tool_invocations=0, validation_failures=0,
            consultation_count=0, consultation_cost_usd=0.0,
            friction_signals=[], delight_signals=[],
            events=[], metadata={},
        )
        result = materialize_result(facet, title="Empty")
        assert result.best_score == 0.0
        assert result.friction_signals == []


# ===========================================================================
# HubStore
# ===========================================================================


class TestHubStore:
    def test_persist_and_load_session(self, tmp_path: Path) -> None:
        from autocontext.knowledge.research_hub import HubStore

        store = HubStore(tmp_path)
        session = _make_session()
        path = store.persist_session(session)
        assert path.exists()

        loaded = store.load_session("sess-1")
        assert loaded is not None
        assert loaded.owner == "operator-alice"

    def test_load_missing_session(self, tmp_path: Path) -> None:
        from autocontext.knowledge.research_hub import HubStore

        store = HubStore(tmp_path)
        assert store.load_session("nonexistent") is None

    def test_list_sessions(self, tmp_path: Path) -> None:
        from autocontext.knowledge.research_hub import HubStore

        store = HubStore(tmp_path)
        store.persist_session(_make_session(session_id="s1"))
        store.persist_session(_make_session(session_id="s2"))
        assert len(store.list_sessions()) == 2

    def test_persist_and_load_package(self, tmp_path: Path) -> None:
        from autocontext.knowledge.research_hub import HubStore

        store = HubStore(tmp_path)
        pkg = _make_package()
        path = store.persist_package(pkg)
        assert path.exists()

        loaded = store.load_package("pkg-1")
        assert loaded is not None
        assert loaded.promotion_level == "experimental"

    def test_load_missing_package(self, tmp_path: Path) -> None:
        from autocontext.knowledge.research_hub import HubStore

        store = HubStore(tmp_path)
        assert store.load_package("nonexistent") is None

    def test_list_packages(self, tmp_path: Path) -> None:
        from autocontext.knowledge.research_hub import HubStore

        store = HubStore(tmp_path)
        store.persist_package(_make_package(package_id="p1"))
        store.persist_package(_make_package(package_id="p2"))
        store.persist_package(_make_package(package_id="p3"))
        assert len(store.list_packages()) == 3

    def test_persist_and_load_result(self, tmp_path: Path) -> None:
        from autocontext.knowledge.research_hub import HubStore

        store = HubStore(tmp_path)
        result = _make_result()
        path = store.persist_result(result)
        assert path.exists()

        loaded = store.load_result("res-1")
        assert loaded is not None
        assert loaded.best_score == 0.78

    def test_load_missing_result(self, tmp_path: Path) -> None:
        from autocontext.knowledge.research_hub import HubStore

        store = HubStore(tmp_path)
        assert store.load_result("nonexistent") is None

    def test_persist_and_load_promotion(self, tmp_path: Path) -> None:
        from autocontext.knowledge.research_hub import HubStore, PromotionEvent

        store = HubStore(tmp_path)
        evt = PromotionEvent(
            event_id="promo-1", package_id="pkg-1",
            source_run_id="run-42", action="promote",
            actor="alice", label="experimental",
            created_at="2026-03-16T12:00:00Z",
        )
        path = store.persist_promotion(evt)
        assert path.exists()

        loaded = store.load_promotion("promo-1")
        assert loaded is not None
        assert loaded.action == "promote"

    def test_list_promotions(self, tmp_path: Path) -> None:
        from autocontext.knowledge.research_hub import HubStore, PromotionEvent

        store = HubStore(tmp_path)
        for i in range(2):
            store.persist_promotion(PromotionEvent(
                event_id=f"promo-{i}", package_id="pkg-1",
                source_run_id="run-42", action="promote",
                actor="alice", label="experimental",
                created_at="2026-03-16T12:00:00Z",
            ))
        assert len(store.list_promotions()) == 2
