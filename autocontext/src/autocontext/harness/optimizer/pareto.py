"""GEPA-inspired ASI/Pareto optimizer surface (AC-266).

Compact optimization layer for improving prompts, policies, and
artifacts against multi-objective metrics with actionable side
information from failures and near-misses.

Key types:
- ActionableSideInfo (ASI): per-example failure/near-miss diagnosis
- OptimizationObjective: named metric with direction
- Candidate: artifact version with multi-objective scores
- ParetoFrontier: maintains non-dominated candidates
- merge_candidates(): combine complementary improvements
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class ActionableSideInfo:
    """Structured per-example failure/near-miss information."""

    example_id: str
    outcome: str  # success, failure, near_miss
    diagnosis: str
    suggested_fix: str
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "example_id": self.example_id,
            "outcome": self.outcome,
            "diagnosis": self.diagnosis,
            "suggested_fix": self.suggested_fix,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ActionableSideInfo:
        return cls(
            example_id=data.get("example_id", ""),
            outcome=data.get("outcome", ""),
            diagnosis=data.get("diagnosis", ""),
            suggested_fix=data.get("suggested_fix", ""),
            metadata=data.get("metadata", {}),
        )


@dataclass(slots=True)
class OptimizationObjective:
    """A named metric with optimization direction."""

    name: str
    direction: str  # maximize or minimize

    def is_better(self, a: float, b: float) -> bool:
        """Return True if a is strictly better than b."""
        if self.direction == "maximize":
            return a > b
        return a < b


@dataclass(slots=True)
class Candidate:
    """An artifact version with multi-objective scores and ASI."""

    candidate_id: str
    artifact: str
    scores: dict[str, float]
    asi: list[ActionableSideInfo]
    metadata: dict[str, Any] = field(default_factory=dict)

    def dominates(
        self, other: Candidate, objectives: list[OptimizationObjective],
    ) -> bool:
        """Return True if self dominates other on all objectives."""
        dominated = True
        strictly_better = False

        for obj in objectives:
            my_score = self.scores.get(obj.name, 0.0)
            their_score = other.scores.get(obj.name, 0.0)

            if obj.is_better(my_score, their_score):
                strictly_better = True
            elif obj.is_better(their_score, my_score):
                dominated = False
                break

        return dominated and strictly_better


class ParetoFrontier:
    """Maintains non-dominated candidates on a Pareto frontier."""

    def __init__(self, objectives: list[OptimizationObjective]) -> None:
        self._objectives = objectives
        self._candidates: list[Candidate] = []

    def add(self, candidate: Candidate) -> bool:
        """Add candidate if non-dominated. Returns True if added."""
        # Check if new candidate is dominated by any existing
        for existing in self._candidates:
            if existing.dominates(candidate, self._objectives):
                return False

        # Remove any existing candidates dominated by the new one
        self._candidates = [
            c for c in self._candidates
            if not candidate.dominates(c, self._objectives)
        ]
        self._candidates.append(candidate)
        return True

    @property
    def candidates(self) -> list[Candidate]:
        return list(self._candidates)

    def best_for(self, objective_name: str) -> Candidate | None:
        """Return the candidate with the best score for a specific objective."""
        if not self._candidates:
            return None

        obj = next(
            (o for o in self._objectives if o.name == objective_name),
            None,
        )
        if obj is None:
            return None

        return max(
            self._candidates,
            key=lambda c: c.scores.get(objective_name, 0.0)
            if obj.direction == "maximize"
            else -c.scores.get(objective_name, 0.0),
        )


def merge_candidates(a: Candidate, b: Candidate) -> Candidate:
    """Merge two complementary candidates into a combined artifact."""
    merged_artifact = f"{a.artifact}\n\n{b.artifact}"

    # Average scores where both have values
    merged_scores: dict[str, float] = {}
    all_keys = set(a.scores) | set(b.scores)
    for key in all_keys:
        vals = [s for s in [a.scores.get(key), b.scores.get(key)] if s is not None]
        merged_scores[key] = sum(vals) / len(vals)

    return Candidate(
        candidate_id=f"merged-{uuid.uuid4().hex[:8]}",
        artifact=merged_artifact,
        scores=merged_scores,
        asi=[*a.asi, *b.asi],
        metadata={"merged_from": [a.candidate_id, b.candidate_id]},
    )
