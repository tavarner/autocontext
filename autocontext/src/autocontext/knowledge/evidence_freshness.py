"""Evidence freshness and decay for hints, lessons, and notebook context (AC-326).

Tracks support count, last-validated generation, confidence for context
items. Decays or demotes stale guidance during prompt assembly.

Key types:
- EvidenceFreshness: per-item freshness metadata
- FreshnessPolicy: decay thresholds
- apply_freshness_decay(): partition items into active/stale
- detect_stale_context(): generate operator warnings
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from pydantic import BaseModel, Field


class EvidenceFreshness(BaseModel):
    """Freshness metadata for a hint, lesson, or context item."""

    item_id: str
    support_count: int
    last_validated_gen: int
    confidence: float
    created_at_gen: int
    metadata: dict[str, Any] = Field(default_factory=dict)

    def age(self, current_gen: int) -> int:
        return current_gen - self.last_validated_gen

    def to_dict(self) -> dict[str, Any]:
        return self.model_dump()

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> EvidenceFreshness:
        return cls.model_validate(data)


class FreshnessPolicy(BaseModel):
    """Configurable decay thresholds."""

    max_age_gens: int = 10
    min_confidence: float = 0.4
    min_support: int = 1


def apply_freshness_decay(
    items: Sequence[EvidenceFreshness],
    current_gen: int,
    policy: FreshnessPolicy,
) -> tuple[list[EvidenceFreshness], list[EvidenceFreshness]]:
    """Partition items into active and stale based on freshness policy."""
    active: list[EvidenceFreshness] = []
    stale: list[EvidenceFreshness] = []

    for item in items:
        is_stale = (
            item.age(current_gen) > policy.max_age_gens
            or item.confidence < policy.min_confidence
            or item.support_count < policy.min_support
        )
        if is_stale:
            stale.append(item)
        else:
            active.append(item)

    return active, stale


def detect_stale_context(
    items: Sequence[EvidenceFreshness],
    current_gen: int,
    policy: FreshnessPolicy,
) -> list[str]:
    """Generate operator warnings for stale context items."""
    _, stale = apply_freshness_decay(items, current_gen, policy)
    warnings: list[str] = []
    for item in stale:
        age = item.age(current_gen)
        warnings.append(
            f"{item.item_id}: stale (age={age} gens, confidence={item.confidence:.2f}, "
            f"support={item.support_count})"
        )
    return warnings
