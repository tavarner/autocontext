"""Apply active mutations to prompt assembly (AC-505)."""

from __future__ import annotations

from autocontext.harness.mutations.spec import HarnessMutation, MutationType


def apply_mutations(
    prompts: dict[str, str],
    mutations: list[HarnessMutation],
) -> dict[str, str]:
    """Apply active prompt_fragment mutations to role prompts.

    Returns a new dict with modified prompts. Non-prompt mutation types
    (context_policy, completion_check, tool_instruction) are handled
    by their respective consumers, not here.
    """
    result = dict(prompts)

    for mutation in mutations:
        if not mutation.active:
            continue
        if mutation.mutation_type != MutationType.PROMPT_FRAGMENT:
            continue
        role = mutation.target_role
        if role and role in result:
            result[role] = f"{result[role]}\n\n{mutation.content}"

    return result


def get_active_completion_checks(mutations: list[HarnessMutation]) -> list[str]:
    """Extract active completion check content strings."""
    return [m.content for m in mutations if m.active and m.mutation_type == MutationType.COMPLETION_CHECK]
