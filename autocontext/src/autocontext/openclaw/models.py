"""Pydantic models for the ClawHub skill wrapper (AC-192)."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, field_validator

from autocontext.scenarios.type_registry import get_valid_scenario_types


class ScenarioInfo(BaseModel):
    """Metadata for a single scenario in the skill manifest."""

    name: str
    display_name: str
    scenario_type: str
    description: str
    strategy_interface: str = ""

    @field_validator("scenario_type")
    @classmethod
    def validate_scenario_type(cls, value: str) -> str:
        valid_types = get_valid_scenario_types()
        if value not in valid_types:
            valid_list = ", ".join(sorted(valid_types))
            raise ValueError(
                f"Invalid scenario_type '{value}'. Expected one of: {valid_list}"
            )
        return value


class SkillManifest(BaseModel):
    """Machine-readable descriptor for ClawHub skill registration."""

    name: str = Field(default="autocontext")
    version: str = Field(default="")
    description: str = Field(default="autocontext iterative strategy evolution and evaluation system")
    capabilities: list[str] = Field(default_factory=lambda: [
        "scenario_evaluation",
        "strategy_validation",
        "artifact_management",
        "knowledge_export",
        "strategy_search",
    ])
    scenarios: list[ScenarioInfo] = Field(default_factory=list)
    mcp_tools: list[str] = Field(default_factory=list)
    rest_base_path: str = Field(default="/api/openclaw")


class ScenarioRecommendation(BaseModel):
    """Result of select_scenario() — best match with alternatives."""

    scenario_name: str
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    reasoning: str = Field(default="")
    alternatives: list[ScenarioInfo] = Field(default_factory=list)


class EvaluationResult(BaseModel):
    """Combined validate + evaluate result."""

    scenario_name: str
    strategy: dict[str, Any] = Field(default_factory=dict)
    valid: bool = False
    validation_errors: list[str] = Field(default_factory=list)
    harness_passed: bool | None = None
    harness_errors: list[str] = Field(default_factory=list)
    scores: list[float] = Field(default_factory=list)
    mean_score: float = 0.0
    best_score: float = 0.0


class ArtifactSummary(BaseModel):
    """Enriched artifact listing for discovery."""

    id: str
    name: str
    artifact_type: str
    scenario: str
    version: int = 1
    tags: list[str] = Field(default_factory=list)
    created_at: str = Field(default="")
