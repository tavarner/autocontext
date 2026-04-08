"""Mutation gate — evaluate before promotion (AC-505)."""

from __future__ import annotations

from dataclasses import dataclass

from autocontext.harness.mutations.spec import HarnessMutation

_MAX_CONTENT_LENGTH = 10_000


@dataclass(slots=True)
class GateResult:
    """Outcome of evaluating a mutation for promotion."""

    approved: bool
    reason: str


def evaluate_mutation(mutation: HarnessMutation) -> GateResult:
    """Evaluate whether a mutation should be promoted.

    Current rules (extensible):
    - Content must not be empty
    - Content must not exceed max length
    - Type must be valid (enforced by enum)
    """
    if not mutation.content.strip():
        return GateResult(approved=False, reason="Empty mutation content")

    if len(mutation.content) > _MAX_CONTENT_LENGTH:
        return GateResult(
            approved=False,
            reason=f"Content exceeds max length ({len(mutation.content)} > {_MAX_CONTENT_LENGTH})",
        )

    return GateResult(approved=True, reason=f"Approved: {mutation.mutation_type.value}")
