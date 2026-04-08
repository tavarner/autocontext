"""Harness mutation surface (AC-505)."""

from autocontext.harness.mutations.applier import apply_mutations, get_active_completion_checks
from autocontext.harness.mutations.gate import GateResult, evaluate_mutation
from autocontext.harness.mutations.parser import parse_mutations
from autocontext.harness.mutations.spec import HarnessMutation, MutationType
from autocontext.harness.mutations.store import MutationStore

__all__ = [
    "GateResult",
    "HarnessMutation",
    "MutationStore",
    "MutationType",
    "apply_mutations",
    "evaluate_mutation",
    "get_active_completion_checks",
    "parse_mutations",
]
