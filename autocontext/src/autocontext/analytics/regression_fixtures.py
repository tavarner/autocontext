"""Friction analytics → regression fixtures and prevalidation (AC-328).

Converts recurring friction clusters into reusable regression fixtures
that can participate in holdout or prevalidation evaluation.

Key types:
- RegressionFixture: a generated test fixture from friction evidence
- generate_fixtures_from_friction(): converts clusters into fixtures
- FixtureStore: JSON-file persistence with scenario filtering
"""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass(slots=True)
class RegressionFixture:
    """A generated regression test fixture from friction evidence."""

    fixture_id: str
    scenario: str
    description: str
    seed: int
    strategy: dict[str, Any]
    expected_min_score: float
    source_evidence: list[str]
    confidence: float
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "fixture_id": self.fixture_id,
            "scenario": self.scenario,
            "description": self.description,
            "seed": self.seed,
            "strategy": self.strategy,
            "expected_min_score": self.expected_min_score,
            "source_evidence": self.source_evidence,
            "confidence": self.confidence,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> RegressionFixture:
        return cls(
            fixture_id=data["fixture_id"],
            scenario=data.get("scenario", ""),
            description=data.get("description", ""),
            seed=data.get("seed", 0),
            strategy=data.get("strategy", {}),
            expected_min_score=data.get("expected_min_score", 0.0),
            source_evidence=data.get("source_evidence", []),
            confidence=data.get("confidence", 0.0),
            metadata=data.get("metadata", {}),
        )


def generate_fixtures_from_friction(
    clusters: list[dict[str, Any]],
    scenario: str,
    min_occurrences: int = 2,
) -> list[RegressionFixture]:
    """Convert recurring friction clusters into regression fixtures."""
    if not clusters:
        return []

    fixtures: list[RegressionFixture] = []
    for cluster in clusters:
        count = cluster.get("count", 0)
        if count < min_occurrences:
            continue

        generations = cluster.get("generations", [])
        pattern = cluster.get("pattern", "unknown")
        description = cluster.get("description", f"Recurring {pattern}")

        fixture = RegressionFixture(
            fixture_id=f"fix-{uuid.uuid4().hex[:8]}",
            scenario=scenario,
            description=description,
            seed=generations[0] * 100 if generations else 42,
            strategy={},
            expected_min_score=0.5,
            source_evidence=[
                f"friction:{pattern}:gen{g}" for g in generations
            ],
            confidence=min(1.0, count / 5.0),
        )
        fixtures.append(fixture)

    return fixtures


class FixtureStore:
    """JSON-file persistence for regression fixtures."""

    def __init__(self, root: Path) -> None:
        self._dir = root / "regression_fixtures"
        self._dir.mkdir(parents=True, exist_ok=True)

    def persist(self, fixture: RegressionFixture) -> Path:
        path = self._dir / f"{fixture.fixture_id}.json"
        path.write_text(json.dumps(fixture.to_dict(), indent=2), encoding="utf-8")
        return path

    def load(self, fixture_id: str) -> RegressionFixture | None:
        path = self._dir / f"{fixture_id}.json"
        if not path.exists():
            return None
        return RegressionFixture.from_dict(json.loads(path.read_text(encoding="utf-8")))

    def list_for_scenario(self, scenario: str) -> list[RegressionFixture]:
        results: list[RegressionFixture] = []
        for path in sorted(self._dir.glob("*.json")):
            fix = RegressionFixture.from_dict(json.loads(path.read_text(encoding="utf-8")))
            if fix.scenario == scenario:
                results.append(fix)
        return results
