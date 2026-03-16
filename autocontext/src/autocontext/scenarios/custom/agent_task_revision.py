"""Revision prompt builder for generated agent tasks (AC-280).

Pure function that constructs a revision prompt from judge feedback,
weak dimensions, and the original task prompt. Used by generated
revise_output() methods to request substantive LLM-based revisions.
"""

from __future__ import annotations

from autocontext.scenarios.agent_task import AgentTaskResult


def build_revision_prompt(
    *,
    original_output: str,
    judge_result: AgentTaskResult,
    task_prompt: str,
    revision_prompt: str | None = None,
    rubric: str = "",
) -> str:
    """Build a revision prompt from judge feedback for LLM-based revision.

    Args:
        original_output: The current agent output to revise.
        judge_result: Judge evaluation result with score, reasoning, dimensions.
        task_prompt: The original task prompt for context.
        revision_prompt: Optional task-specific revision instructions.
        rubric: Optional rubric for context.

    Returns:
        A complete prompt string for requesting a revision from the LLM.
    """
    # Identify weak dimensions (score < 0.7)
    weak_dims = {
        dim: score
        for dim, score in judge_result.dimension_scores.items()
        if score < 0.7
    }

    sections: list[str] = []

    sections.append("You are revising your previous output based on judge feedback.")
    sections.append(f"\n## Current Score\n{judge_result.score:.2f}")
    sections.append(f"\n## Judge Reasoning\n{judge_result.reasoning}")

    if weak_dims:
        dim_lines = "\n".join(f"- {dim}: {score:.2f}" for dim, score in sorted(weak_dims.items(), key=lambda x: x[1]))
        sections.append(f"\n## Weak Dimensions (need improvement)\n{dim_lines}")

    sections.append(f"\n## Original Output\n{original_output}")

    if revision_prompt:
        sections.append(f"\n## Revision Instructions\n{revision_prompt}")
    else:
        sections.append(f"\n## Original Task\n{task_prompt}")

    sections.append(
        "\n## Your Task\n"
        "Produce a revised, improved version of the output that addresses "
        "the judge's feedback and improves on the weak dimensions. "
        "Return ONLY the revised output, not commentary about the changes."
    )

    return "\n".join(sections)
