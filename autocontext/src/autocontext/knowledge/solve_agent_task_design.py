"""Solve-specific AgentTask design helpers."""

from __future__ import annotations

import re

from autocontext.scenarios.custom.agent_task_designer import (
    RETRY_SOLVE_AGENT_TASK_DESIGNER_SYSTEM,  # noqa: F401 - re-exported through solver
    SOLVE_AGENT_TASK_DESIGNER_SYSTEM,  # noqa: F401 - re-exported through solver
)
from autocontext.scenarios.custom.agent_task_spec import AgentTaskSpec
from autocontext.scenarios.custom.classifier_input import build_family_classification_brief

_SOLVE_AGENT_TASK_DESIGN_KEEP_SECTIONS = frozenset(
    {
        "Objective",
        "Description",
        "Scenario Design",
        "Evaluation Dimensions",
        "Success Criteria",
    }
)
_SOLVE_AGENT_TASK_DESIGN_MAX_CHARS = 1000
_SOLVE_AGENT_TASK_DESIGN_MAX_SECTION_LINES = 5
_SOLVE_RUNTIME_HEAVY_TASK_PROMPT_RE = re.compile(
    r"\b(run|execute|inspect)\b.*\b(provider|repository|scenario|generations?|command|file|artifact)\b",
    re.IGNORECASE,
)


def _build_solve_description_brief(description: str) -> str:
    return build_family_classification_brief(description)


def _build_solve_agent_task_design_brief(description: str) -> str:
    brief = _build_solve_description_brief(description)
    if len(brief) <= _SOLVE_AGENT_TASK_DESIGN_MAX_CHARS:
        return brief

    lines: list[str] = []
    current_section: str | None = None
    current_section_lines = 0
    title_captured = False
    kept_structured_section = False

    for raw_line in brief.splitlines():
        heading_match = re.match(r"^\s*#{2,6}\s+(.+?)\s*$", raw_line)
        if heading_match is not None:
            title = heading_match.group(1).strip()
            if title in _SOLVE_AGENT_TASK_DESIGN_KEEP_SECTIONS:
                current_section = title
                current_section_lines = 0
                kept_structured_section = True
                if lines and lines[-1] != "":
                    lines.append("")
                lines.append(raw_line)
                lines.append("")
            else:
                current_section = None
            continue

        stripped = raw_line.strip()
        if not title_captured and stripped:
            lines.append(raw_line)
            title_captured = True
            continue
        if current_section is None:
            continue
        if not stripped:
            if lines and lines[-1] != "":
                lines.append("")
            continue
        if stripped.startswith("```"):
            continue
        if current_section_lines >= _SOLVE_AGENT_TASK_DESIGN_MAX_SECTION_LINES:
            continue
        lines.append(raw_line)
        current_section_lines += 1

    if not kept_structured_section:
        return _truncate_to_line_boundary(brief, _SOLVE_AGENT_TASK_DESIGN_MAX_CHARS)

    compact = "\n".join(lines).strip()
    compact = re.sub(r"\n{3,}", "\n\n", compact)
    while len(compact) > _SOLVE_AGENT_TASK_DESIGN_MAX_CHARS and "\n\n" in compact:
        compact = compact.rsplit("\n\n", 1)[0].strip()
    if len(compact) > _SOLVE_AGENT_TASK_DESIGN_MAX_CHARS:
        compact = _truncate_to_line_boundary(compact, _SOLVE_AGENT_TASK_DESIGN_MAX_CHARS)
    return compact or _truncate_to_line_boundary(brief, _SOLVE_AGENT_TASK_DESIGN_MAX_CHARS)


def _solve_task_spec_needs_compact_retry(spec: AgentTaskSpec) -> bool:
    if spec.output_format != "json_schema":
        return False
    if spec.sample_input not in {None, ""}:
        return False
    prompt = spec.task_prompt.strip()
    if "if available" in prompt.lower():
        return True
    return bool(_SOLVE_RUNTIME_HEAVY_TASK_PROMPT_RE.search(prompt))


def _truncate_to_line_boundary(text: str, max_chars: int) -> str:
    if len(text) <= max_chars:
        return text.strip()
    truncated = text[:max_chars].rsplit("\n", 1)[0].strip()
    return truncated or text[:max_chars].strip()
