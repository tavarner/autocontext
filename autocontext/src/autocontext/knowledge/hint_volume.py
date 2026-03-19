"""Hint volume control with impact ranking and rotation (AC-340).

Caps competitor hints at N, ranks by impact, rotates lowest-ranked
when cap is exceeded. Archived hints preserved for potential recall.

Key types:
- RankedHint: hint text with rank, generation, impact score
- HintVolumePolicy: max_hints, archive_rotated
- HintManager: add/rank/rotate/format hints with volume control
- apply_volume_cap(): simple cap for hint string lists
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class RankedHint:
    """A hint with impact ranking metadata."""

    text: str
    rank: int
    generation_added: int
    impact_score: float  # 0.0-1.0, higher = more effective
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "text": self.text,
            "rank": self.rank,
            "generation_added": self.generation_added,
            "impact_score": self.impact_score,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> RankedHint:
        return cls(
            text=data.get("text", ""),
            rank=data.get("rank", 0),
            generation_added=data.get("generation_added", 0),
            impact_score=data.get("impact_score", 0.0),
            metadata=data.get("metadata", {}),
        )


@dataclass(slots=True)
class HintVolumePolicy:
    """Configuration for hint volume control."""

    max_hints: int = 7
    archive_rotated: bool = True


class HintManager:
    """Manages ranked hints with volume control."""

    def __init__(self, policy: HintVolumePolicy) -> None:
        self._policy = policy
        self._active: list[RankedHint] = []
        self._archived: list[RankedHint] = []

    def add(
        self,
        text: str,
        generation: int,
        impact_score: float = 0.5,
    ) -> None:
        """Add a hint, rotating out the lowest-ranked if at capacity."""
        hint = RankedHint(
            text=text,
            rank=len(self._active) + 1,
            generation_added=generation,
            impact_score=impact_score,
        )
        self._active.append(hint)
        self._enforce_cap()

    def update_impact(self, text: str, new_score: float) -> None:
        """Update a hint's impact score."""
        for hint in self._active:
            if hint.text == text:
                hint.impact_score = new_score  # type: ignore[misc]
                break

    def active_hints(self) -> list[RankedHint]:
        """Return active hints sorted by impact (highest first)."""
        return sorted(self._active, key=lambda h: h.impact_score, reverse=True)

    def archived_hints(self) -> list[RankedHint]:
        return list(self._archived)

    def format_for_competitor(self) -> str:
        """Format active hints as competitor prompt context, ranked by impact."""
        ranked = self.active_hints()
        if not ranked:
            return ""
        lines = []
        for _i, hint in enumerate(ranked, 1):
            lines.append(f"- {hint.text}")
        return "\n".join(lines)

    def _enforce_cap(self) -> None:
        """Rotate out lowest-impact hints when over capacity."""
        while len(self._active) > self._policy.max_hints:
            # Sort by impact ascending — remove the lowest
            self._active.sort(key=lambda h: h.impact_score)
            removed = self._active.pop(0)
            if self._policy.archive_rotated:
                self._archived.append(removed)


def apply_volume_cap(
    hints: list[str],
    max_hints: int = 7,
) -> tuple[list[str], list[str]]:
    """Simple cap for hint string lists. Returns (active, archived)."""
    if len(hints) <= max_hints:
        return list(hints), []
    return hints[:max_hints], hints[max_hints:]
