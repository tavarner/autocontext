"""Default long-run presets with anti-stall safeguards (AC-329).

Named presets that bundle safe default configurations for different
run durations. Long runs enable all available safeguards.

Key types:
- RunPreset: named preset with settings overrides
- LONG_RUN_PRESET / SHORT_RUN_PRESET: builtin presets
- apply_preset(): merge preset settings into a base config
- get_preset(): look up preset by name
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class RunPreset:
    """Named preset with settings overrides."""

    name: str
    description: str
    settings: dict[str, Any]
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "settings": self.settings,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> RunPreset:
        return cls(
            name=data["name"],
            description=data.get("description", ""),
            settings=data.get("settings", {}),
            metadata=data.get("metadata", {}),
        )


LONG_RUN_PRESET = RunPreset(
    name="long_run",
    description="Safe defaults for 10+ generation runs with all anti-stall safeguards",
    settings={
        "stagnation_reset_enabled": True,
        "dead_end_tracking_enabled": True,
        "curator_enabled": True,
        "two_tier_gating_enabled": True,
        "max_retries": 3,
        "stagnation_rollback_threshold": 5,
        "stagnation_plateau_window": 3,
        "cross_run_inheritance": True,
    },
)

SHORT_RUN_PRESET = RunPreset(
    name="short_run",
    description="Lightweight defaults for 1-5 generation runs",
    settings={
        "stagnation_reset_enabled": False,
        "dead_end_tracking_enabled": False,
        "curator_enabled": False,
        "two_tier_gating_enabled": False,
        "max_retries": 2,
    },
)

_PRESET_REGISTRY: dict[str, RunPreset] = {
    "long_run": LONG_RUN_PRESET,
    "short_run": SHORT_RUN_PRESET,
}


def get_preset(name: str) -> RunPreset | None:
    """Look up a preset by name."""
    return _PRESET_REGISTRY.get(name)


def apply_preset(
    base: dict[str, Any],
    preset: RunPreset | None,
) -> dict[str, Any]:
    """Merge preset settings into a base config dict."""
    if preset is None:
        return dict(base)
    result = dict(base)
    result.update(preset.settings)
    return result
