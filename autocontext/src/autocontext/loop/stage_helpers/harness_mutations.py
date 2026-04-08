"""Helpers for wiring harness mutations into live generation stages."""

from __future__ import annotations

import dataclasses
from typing import TYPE_CHECKING

from autocontext.harness.mutations import (
    HarnessMutation,
    MutationType,
    apply_mutations,
    evaluate_mutation,
    get_active_completion_checks,
)
from autocontext.prompts.templates import PromptBundle

if TYPE_CHECKING:
    from autocontext.storage import ArtifactStore

_PROMPT_ROLES = ("competitor", "analyst", "coach", "architect")


def load_active_harness_mutations(
    artifacts: ArtifactStore,
    scenario_name: str,
) -> list[HarnessMutation]:
    """Load only active, typed mutations for a scenario."""
    loaded = artifacts.load_harness_mutations(scenario_name)
    if not isinstance(loaded, list):
        return []
    return [mutation for mutation in loaded if isinstance(mutation, HarnessMutation) and mutation.active]


def render_context_policy_block(mutations: list[HarnessMutation]) -> str:
    """Render prompt-facing context policy notes."""
    lines = [
        f"- {mutation.component}: {mutation.content}"
        for mutation in mutations
        if mutation.active
        and mutation.mutation_type == MutationType.CONTEXT_POLICY
        and mutation.component
        and mutation.content.strip()
    ]
    if not lines:
        return ""
    return "Active context policies:\n" + "\n".join(lines)


def render_tool_instruction_block(mutations: list[HarnessMutation]) -> str:
    """Render prompt-facing tool instructions."""
    lines = [
        f"- {mutation.tool_name}: {mutation.content}"
        for mutation in mutations
        if mutation.active
        and mutation.mutation_type == MutationType.TOOL_INSTRUCTION
        and mutation.tool_name
        and mutation.content.strip()
    ]
    if not lines:
        return ""
    return "Tool-specific instructions:\n" + "\n".join(lines)


def apply_harness_mutations_to_prompts(
    prompts: PromptBundle,
    mutations: list[HarnessMutation],
) -> PromptBundle:
    """Apply active prompt fragments and completion checks to the live prompt bundle."""
    prompt_map = {role: getattr(prompts, role) for role in _PROMPT_ROLES}
    prompt_map = apply_mutations(prompt_map, mutations)

    checks = get_active_completion_checks(mutations)
    if checks:
        checklist = "Active completion checks:\n" + "\n".join(f"- {check}" for check in checks)
        prompt_map["competitor"] = f"{prompt_map['competitor']}\n\n{checklist}"

    if dataclasses.is_dataclass(prompts):
        return dataclasses.replace(prompts, **prompt_map)

    for role, prompt in prompt_map.items():
        setattr(prompts, role, prompt)
    return prompts


def persist_approved_harness_mutations(
    artifacts: ArtifactStore,
    scenario_name: str,
    *,
    generation: int,
    run_id: str,
    proposed: list[HarnessMutation],
) -> list[HarnessMutation]:
    """Gate, deduplicate, and persist approved harness mutations."""
    if not proposed:
        return []

    existing = load_active_harness_mutations(artifacts, scenario_name)
    merged = list(existing)
    existing_keys = {_mutation_identity(mutation) for mutation in merged}
    approved_additions: list[HarnessMutation] = []

    for mutation in proposed:
        if not isinstance(mutation, HarnessMutation):
            continue
        result = evaluate_mutation(mutation)
        if not result.approved:
            continue
        mutation.generation = generation
        identity = _mutation_identity(mutation)
        if identity in existing_keys:
            continue
        merged.append(mutation)
        existing_keys.add(identity)
        approved_additions.append(mutation)

    if approved_additions:
        artifacts.save_harness_mutations(
            scenario_name,
            merged,
            generation=generation,
            run_id=run_id,
        )

    return approved_additions


def _mutation_identity(mutation: HarnessMutation) -> tuple[str, str, str, str, str]:
    return (
        mutation.mutation_type.value,
        mutation.content.strip(),
        mutation.target_role.strip(),
        mutation.component.strip(),
        mutation.tool_name.strip(),
    )
