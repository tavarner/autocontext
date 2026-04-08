"""Typed harness mutation specs (AC-505)."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any


class MutationType(StrEnum):
    PROMPT_FRAGMENT = "prompt_fragment"
    CONTEXT_POLICY = "context_policy"
    COMPLETION_CHECK = "completion_check"
    TOOL_INSTRUCTION = "tool_instruction"


@dataclass(slots=True)
class HarnessMutation:
    """A typed mutation to a harness component."""

    mutation_type: MutationType
    content: str = ""
    rationale: str = ""
    target_role: str = ""  # for prompt_fragment
    component: str = ""  # for context_policy
    tool_name: str = ""  # for tool_instruction
    mutation_id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    generation: int = 0
    active: bool = True

    def to_dict(self) -> dict[str, Any]:
        return {
            "mutation_id": self.mutation_id,
            "type": self.mutation_type.value,
            "content": self.content,
            "rationale": self.rationale,
            "target_role": self.target_role,
            "component": self.component,
            "tool_name": self.tool_name,
            "generation": self.generation,
            "active": self.active,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> HarnessMutation:
        return cls(
            mutation_type=MutationType(data["type"]),
            content=data.get("content", ""),
            rationale=data.get("rationale", ""),
            target_role=data.get("target_role", ""),
            component=data.get("component", ""),
            tool_name=data.get("tool_name", ""),
            mutation_id=data.get("mutation_id", uuid.uuid4().hex[:12]),
            generation=data.get("generation", 0),
            active=data.get("active", True),
        )
