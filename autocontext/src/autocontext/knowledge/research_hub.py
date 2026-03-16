"""Research hub substrate — shareable sessions, packages, and results (AC-267).

Phase 1 data models and store for the autocontext-side research hub.
Turns local knowledge objects into shareable, queryable, adoptable
research objects with clear provenance.

Key types:
- ResearchSession: session notebook extended with owner, status, lease
- SharedPackage: strategy package with provenance and evidence metadata
- ResearchResult: materialized evidence-backed result summary
- PromotionEvent: records promotion and adoption actions
- HubStore: JSON-file persistence for all hub objects
- materialize_result(): creates ResearchResult from RunFacet
"""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from autocontext.analytics.facets import RunFacet
from autocontext.notebook.types import SessionNotebook


def _uid() -> str:
    return uuid.uuid4().hex[:8]


@dataclass(slots=True)
class ResearchSession:
    """Session notebook extended with ownership, status, and sharing."""

    session_id: str
    scenario_name: str
    owner: str
    status: str  # active, blocked, stale, completed
    lease_expires_at: str
    last_heartbeat_at: str
    current_objective: str
    current_hypotheses: list[str]
    best_run_id: str | None
    best_generation: int | None
    best_score: float | None
    unresolved_questions: list[str]
    operator_observations: list[str]
    follow_ups: list[str]
    shared: bool
    external_link: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "session_id": self.session_id,
            "scenario_name": self.scenario_name,
            "owner": self.owner,
            "status": self.status,
            "lease_expires_at": self.lease_expires_at,
            "last_heartbeat_at": self.last_heartbeat_at,
            "current_objective": self.current_objective,
            "current_hypotheses": self.current_hypotheses,
            "best_run_id": self.best_run_id,
            "best_generation": self.best_generation,
            "best_score": self.best_score,
            "unresolved_questions": self.unresolved_questions,
            "operator_observations": self.operator_observations,
            "follow_ups": self.follow_ups,
            "shared": self.shared,
            "external_link": self.external_link,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ResearchSession:
        return cls(
            session_id=data["session_id"],
            scenario_name=data.get("scenario_name", ""),
            owner=data.get("owner", ""),
            status=data.get("status", "active"),
            lease_expires_at=data.get("lease_expires_at", ""),
            last_heartbeat_at=data.get("last_heartbeat_at", ""),
            current_objective=data.get("current_objective", ""),
            current_hypotheses=data.get("current_hypotheses", []),
            best_run_id=data.get("best_run_id"),
            best_generation=data.get("best_generation"),
            best_score=data.get("best_score"),
            unresolved_questions=data.get("unresolved_questions", []),
            operator_observations=data.get("operator_observations", []),
            follow_ups=data.get("follow_ups", []),
            shared=data.get("shared", False),
            external_link=data.get("external_link", ""),
            metadata=data.get("metadata", {}),
        )

    @classmethod
    def from_notebook(
        cls,
        notebook: SessionNotebook,
        owner: str = "",
        shared: bool = False,
    ) -> ResearchSession:
        now = datetime.now(UTC).isoformat()
        return cls(
            session_id=notebook.session_id,
            scenario_name=notebook.scenario_name,
            owner=owner,
            status="active",
            lease_expires_at="",
            last_heartbeat_at=now,
            current_objective=notebook.current_objective,
            current_hypotheses=list(notebook.current_hypotheses),
            best_run_id=notebook.best_run_id,
            best_generation=notebook.best_generation,
            best_score=notebook.best_score,
            unresolved_questions=list(notebook.unresolved_questions),
            operator_observations=list(notebook.operator_observations),
            follow_ups=list(notebook.follow_ups),
            shared=shared,
        )


@dataclass(slots=True)
class SharedPackage:
    """Strategy package with provenance and evidence metadata."""

    package_id: str
    scenario_name: str
    scenario_family: str
    source_run_id: str
    source_generation: int
    title: str
    description: str
    strategy: dict[str, Any]
    provider_summary: str
    executor_summary: str
    best_score: float
    best_elo: float
    normalized_progress: str
    weakness_summary: str
    result_summary: str
    notebook_hypotheses: list[str]
    linked_artifacts: list[str]
    compatibility_tags: list[str]
    adoption_notes: str
    promotion_level: str  # experimental, recommended, stable
    created_at: str
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "package_id": self.package_id,
            "scenario_name": self.scenario_name,
            "scenario_family": self.scenario_family,
            "source_run_id": self.source_run_id,
            "source_generation": self.source_generation,
            "title": self.title,
            "description": self.description,
            "strategy": self.strategy,
            "provider_summary": self.provider_summary,
            "executor_summary": self.executor_summary,
            "best_score": self.best_score,
            "best_elo": self.best_elo,
            "normalized_progress": self.normalized_progress,
            "weakness_summary": self.weakness_summary,
            "result_summary": self.result_summary,
            "notebook_hypotheses": self.notebook_hypotheses,
            "linked_artifacts": self.linked_artifacts,
            "compatibility_tags": self.compatibility_tags,
            "adoption_notes": self.adoption_notes,
            "promotion_level": self.promotion_level,
            "created_at": self.created_at,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> SharedPackage:
        return cls(
            package_id=data["package_id"],
            scenario_name=data.get("scenario_name", ""),
            scenario_family=data.get("scenario_family", ""),
            source_run_id=data.get("source_run_id", ""),
            source_generation=data.get("source_generation", 0),
            title=data.get("title", ""),
            description=data.get("description", ""),
            strategy=data.get("strategy", {}),
            provider_summary=data.get("provider_summary", ""),
            executor_summary=data.get("executor_summary", ""),
            best_score=data.get("best_score", 0.0),
            best_elo=data.get("best_elo", 0.0),
            normalized_progress=data.get("normalized_progress", ""),
            weakness_summary=data.get("weakness_summary", ""),
            result_summary=data.get("result_summary", ""),
            notebook_hypotheses=data.get("notebook_hypotheses", []),
            linked_artifacts=data.get("linked_artifacts", []),
            compatibility_tags=data.get("compatibility_tags", []),
            adoption_notes=data.get("adoption_notes", ""),
            promotion_level=data.get("promotion_level", "experimental"),
            created_at=data.get("created_at", ""),
            metadata=data.get("metadata", {}),
        )


@dataclass(slots=True)
class ResearchResult:
    """Materialized evidence-backed result summary."""

    result_id: str
    scenario_name: str
    run_id: str
    package_id: str | None
    title: str
    summary: str
    best_score: float
    best_elo: float
    normalized_progress: str
    cost_summary: str
    weakness_summary: str
    consultation_summary: str
    friction_signals: list[str]
    delight_signals: list[str]
    created_at: str
    tags: list[str]
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "result_id": self.result_id,
            "scenario_name": self.scenario_name,
            "run_id": self.run_id,
            "package_id": self.package_id,
            "title": self.title,
            "summary": self.summary,
            "best_score": self.best_score,
            "best_elo": self.best_elo,
            "normalized_progress": self.normalized_progress,
            "cost_summary": self.cost_summary,
            "weakness_summary": self.weakness_summary,
            "consultation_summary": self.consultation_summary,
            "friction_signals": self.friction_signals,
            "delight_signals": self.delight_signals,
            "created_at": self.created_at,
            "tags": self.tags,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ResearchResult:
        return cls(
            result_id=data["result_id"],
            scenario_name=data.get("scenario_name", ""),
            run_id=data.get("run_id", ""),
            package_id=data.get("package_id"),
            title=data.get("title", ""),
            summary=data.get("summary", ""),
            best_score=data.get("best_score", 0.0),
            best_elo=data.get("best_elo", 0.0),
            normalized_progress=data.get("normalized_progress", ""),
            cost_summary=data.get("cost_summary", ""),
            weakness_summary=data.get("weakness_summary", ""),
            consultation_summary=data.get("consultation_summary", ""),
            friction_signals=data.get("friction_signals", []),
            delight_signals=data.get("delight_signals", []),
            created_at=data.get("created_at", ""),
            tags=data.get("tags", []),
            metadata=data.get("metadata", {}),
        )


@dataclass(slots=True)
class PromotionEvent:
    """Records a promotion or adoption action."""

    event_id: str
    package_id: str
    source_run_id: str
    action: str  # promote, adopt, label
    actor: str
    label: str | None
    created_at: str
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "event_id": self.event_id,
            "package_id": self.package_id,
            "source_run_id": self.source_run_id,
            "action": self.action,
            "actor": self.actor,
            "label": self.label,
            "created_at": self.created_at,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> PromotionEvent:
        return cls(
            event_id=data["event_id"],
            package_id=data.get("package_id", ""),
            source_run_id=data.get("source_run_id", ""),
            action=data.get("action", ""),
            actor=data.get("actor", ""),
            label=data.get("label"),
            created_at=data.get("created_at", ""),
            metadata=data.get("metadata", {}),
        )


def materialize_result(
    facet: RunFacet,
    title: str = "",
    weakness_summary: str = "",
    consultation_summary: str = "",
    package_id: str | None = None,
) -> ResearchResult:
    """Create a ResearchResult from a RunFacet and optional report data."""
    now = datetime.now(UTC).isoformat()

    progress_parts = []
    if facet.advances:
        progress_parts.append(f"{facet.advances} advance(s)")
    if facet.retries:
        progress_parts.append(f"{facet.retries} retry(ies)")
    if facet.rollbacks:
        progress_parts.append(f"{facet.rollbacks} rollback(s)")
    normalized_progress = ", ".join(progress_parts) if progress_parts else "No generations"

    cost_summary = f"${facet.total_cost_usd:.2f} total, {facet.total_tokens} tokens"

    friction_strs = [s.description for s in facet.friction_signals]
    delight_strs = [s.description for s in facet.delight_signals]

    summary = (
        f"Run {facet.run_id} on {facet.scenario}: "
        f"best score {facet.best_score:.2f}, "
        f"{facet.total_generations} generation(s), "
        f"{normalized_progress}."
    )

    return ResearchResult(
        result_id=f"res-{_uid()}",
        scenario_name=facet.scenario,
        run_id=facet.run_id,
        package_id=package_id,
        title=title or f"{facet.scenario} Run {facet.run_id}",
        summary=summary,
        best_score=facet.best_score,
        best_elo=facet.best_elo,
        normalized_progress=normalized_progress,
        cost_summary=cost_summary,
        weakness_summary=weakness_summary,
        consultation_summary=consultation_summary,
        friction_signals=friction_strs,
        delight_signals=delight_strs,
        created_at=now,
        tags=[facet.scenario, facet.scenario_family, facet.agent_provider],
    )


class HubStore:
    """JSON-file persistence for research hub objects."""

    def __init__(self, root: Path) -> None:
        self._sessions_dir = root / "hub_sessions"
        self._packages_dir = root / "hub_packages"
        self._results_dir = root / "hub_results"
        self._promotions_dir = root / "hub_promotions"
        for d in (self._sessions_dir, self._packages_dir, self._results_dir, self._promotions_dir):
            d.mkdir(parents=True, exist_ok=True)

    # --- Sessions ---

    def persist_session(self, session: ResearchSession) -> Path:
        path = self._sessions_dir / f"{session.session_id}.json"
        path.write_text(json.dumps(session.to_dict(), indent=2), encoding="utf-8")
        return path

    def load_session(self, session_id: str) -> ResearchSession | None:
        path = self._sessions_dir / f"{session_id}.json"
        if not path.exists():
            return None
        return ResearchSession.from_dict(json.loads(path.read_text(encoding="utf-8")))

    def list_sessions(self) -> list[ResearchSession]:
        return [
            ResearchSession.from_dict(json.loads(p.read_text(encoding="utf-8")))
            for p in sorted(self._sessions_dir.glob("*.json"))
        ]

    # --- Packages ---

    def persist_package(self, package: SharedPackage) -> Path:
        path = self._packages_dir / f"{package.package_id}.json"
        path.write_text(json.dumps(package.to_dict(), indent=2), encoding="utf-8")
        return path

    def load_package(self, package_id: str) -> SharedPackage | None:
        path = self._packages_dir / f"{package_id}.json"
        if not path.exists():
            return None
        return SharedPackage.from_dict(json.loads(path.read_text(encoding="utf-8")))

    def list_packages(self) -> list[SharedPackage]:
        return [
            SharedPackage.from_dict(json.loads(p.read_text(encoding="utf-8")))
            for p in sorted(self._packages_dir.glob("*.json"))
        ]

    # --- Results ---

    def persist_result(self, result: ResearchResult) -> Path:
        path = self._results_dir / f"{result.result_id}.json"
        path.write_text(json.dumps(result.to_dict(), indent=2), encoding="utf-8")
        return path

    def load_result(self, result_id: str) -> ResearchResult | None:
        path = self._results_dir / f"{result_id}.json"
        if not path.exists():
            return None
        return ResearchResult.from_dict(json.loads(path.read_text(encoding="utf-8")))

    def list_results(self) -> list[ResearchResult]:
        return [
            ResearchResult.from_dict(json.loads(p.read_text(encoding="utf-8")))
            for p in sorted(self._results_dir.glob("*.json"))
        ]

    # --- Promotions ---

    def persist_promotion(self, event: PromotionEvent) -> Path:
        path = self._promotions_dir / f"{event.event_id}.json"
        path.write_text(json.dumps(event.to_dict(), indent=2), encoding="utf-8")
        return path

    def load_promotion(self, event_id: str) -> PromotionEvent | None:
        path = self._promotions_dir / f"{event_id}.json"
        if not path.exists():
            return None
        return PromotionEvent.from_dict(json.loads(path.read_text(encoding="utf-8")))

    def list_promotions(self) -> list[PromotionEvent]:
        return [
            PromotionEvent.from_dict(json.loads(p.read_text(encoding="utf-8")))
            for p in sorted(self._promotions_dir.glob("*.json"))
        ]
