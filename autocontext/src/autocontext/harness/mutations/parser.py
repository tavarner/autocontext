"""Parse harness mutations from architect output (AC-505)."""

from __future__ import annotations

import json
import logging

from autocontext.harness.mutations.spec import HarnessMutation, MutationType

logger = logging.getLogger(__name__)

_MUTATIONS_START = "<!-- MUTATIONS_START -->"
_MUTATIONS_END = "<!-- MUTATIONS_END -->"

_VALID_TYPES = {t.value for t in MutationType}


def parse_mutations(content: str) -> list[HarnessMutation]:
    """Extract mutation specs from architect output between delimited markers."""
    start = content.find(_MUTATIONS_START)
    end = content.find(_MUTATIONS_END)
    if start == -1 or end == -1 or end <= start:
        return []

    body = content[start + len(_MUTATIONS_START) : end].strip()
    try:
        decoded = json.loads(body)
    except json.JSONDecodeError:
        logger.debug("failed to parse mutations JSON")
        return []

    if not isinstance(decoded, dict):
        return []

    raw_mutations = decoded.get("mutations", [])
    if not isinstance(raw_mutations, list):
        return []

    mutations: list[HarnessMutation] = []
    for raw in raw_mutations:
        if not isinstance(raw, dict):
            continue
        mutation_type = raw.get("type", "")
        if mutation_type not in _VALID_TYPES:
            continue
        if not raw.get("content"):
            continue
        try:
            mutations.append(
                HarnessMutation(
                    mutation_type=MutationType(mutation_type),
                    content=raw.get("content", ""),
                    rationale=raw.get("rationale", ""),
                    target_role=raw.get("target_role", ""),
                    component=raw.get("component", ""),
                    tool_name=raw.get("tool_name", ""),
                )
            )
        except (ValueError, KeyError):
            continue

    return mutations
