"""Scenario type registry — single source of truth for valid scenario types (AC-307/AC-316).

Provides get_valid_scenario_types() so external tests and validation code
can derive the allowlist from the family registry instead of hardcoding.
"""

from __future__ import annotations

from autocontext.scenarios.families import list_families


def get_valid_scenario_types() -> frozenset[str]:
    """Return all valid scenario type names from the family registry.

    Use this instead of hardcoding allowlists in tests or validation code.
    """
    return frozenset(f.name for f in list_families())
