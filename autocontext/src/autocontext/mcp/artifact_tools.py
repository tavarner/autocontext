"""MCP tool implementations — artifact_tools (extracted from tools.py, AC-482)."""

from __future__ import annotations

import json
import logging
from typing import TYPE_CHECKING, Any

from autocontext.execution.harness_loader import HarnessLoader
from autocontext.mcp._base import MtsToolContext
from autocontext.scenarios import SCENARIO_REGISTRY
from autocontext.util.json_io import read_json

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    pass


def evaluate_strategy(
    scenario_name: str,
    strategy: dict[str, Any],
    num_matches: int = 3,
    seed_base: int = 42,
) -> dict[str, Any]:
    """Evaluate a candidate strategy against a scenario by running matches.

    Returns aggregate scores for the strategy across multiple seeds.
    """
    if scenario_name not in SCENARIO_REGISTRY:
        supported = ", ".join(sorted(SCENARIO_REGISTRY.keys()))
        return {"error": f"Unknown scenario '{scenario_name}'. Available: {supported}"}

    scenario = SCENARIO_REGISTRY[scenario_name]()
    if not hasattr(scenario, "execute_match"):
        return {
            "error": (
                f"'{scenario_name}' is an agent task scenario. "
                "Use evaluate_output() for judge-based evaluation."
            )
        }

    scores: list[float] = []
    for i in range(num_matches):
        result = scenario.execute_match(strategy, seed_base + i)
        scores.append(result.score)

    return {
        "scenario": scenario_name,
        "matches": num_matches,
        "scores": scores,
        "mean_score": sum(scores) / len(scores) if scores else 0.0,
        "best_score": max(scores) if scores else 0.0,
    }


def validate_strategy_against_harness(
    scenario_name: str,
    strategy: dict[str, Any],
    ctx: MtsToolContext | None = None,
) -> dict[str, Any]:
    """Validate a strategy against scenario constraints and any harness validators.

    Checks both built-in scenario validation and any published harness artifacts.
    """
    if scenario_name not in SCENARIO_REGISTRY:
        supported = ", ".join(sorted(SCENARIO_REGISTRY.keys()))
        return {"error": f"Unknown scenario '{scenario_name}'. Available: {supported}"}

    scenario = SCENARIO_REGISTRY[scenario_name]()
    if not hasattr(scenario, "validate_actions"):
        return {
            "valid": True,
            "reason": "Agent task scenarios use judge evaluation, not action validation",
        }

    state = scenario.initial_state(seed=42)
    valid, reason = scenario.validate_actions(state, "challenger", strategy)
    harness_loaded: list[str] = []
    harness_errors: list[str] = []
    harness_passed = True

    if valid and ctx is not None:
        harness_loaded = _sync_published_harness_artifacts(ctx, scenario_name)
        harness_loader = HarnessLoader(
            ctx.artifacts.harness_dir(scenario_name),
            timeout_seconds=ctx.settings.harness_timeout_seconds,
        )
        harness_loaded = harness_loader.load()
        harness_result = harness_loader.validate_strategy(dict(strategy), scenario)
        harness_passed = harness_result.passed
        harness_errors = harness_result.errors

    return {
        "valid": valid and harness_passed,
        "reason": reason,
        "scenario": scenario_name,
        "harness_loaded": harness_loaded,
        "harness_passed": harness_passed,
        "harness_errors": harness_errors,
    }


def _sync_published_harness_artifacts(ctx: MtsToolContext, scenario_name: str) -> list[str]:
    """Mirror published harness artifacts into the runtime harness directory."""
    artifacts_dir = ctx.settings.knowledge_root / "_openclaw_artifacts"
    if not artifacts_dir.exists():
        return []

    synced: list[str] = []
    for artifact_path in sorted(artifacts_dir.glob("*.json")):
        try:
            artifact_data = read_json(artifact_path)
        except json.JSONDecodeError:
            continue
        if artifact_data.get("artifact_type") != "harness" or artifact_data.get("scenario") != scenario_name:
            continue
        source_code = artifact_data.get("source_code")
        artifact_id = artifact_data.get("id", artifact_path.stem)
        if not isinstance(source_code, str) or not source_code.strip():
            continue
        module_name = f"openclaw_{str(artifact_id).replace('-', '_')}"
        ctx.artifacts.write_harness(scenario_name, module_name, source_code)
        synced.append(module_name)
    return synced


def _validate_and_persist_artifact(
    ctx: MtsToolContext,
    artifact_data: dict[str, Any],
    artifact_type: str,
) -> tuple[str, str]:
    """Validate artifact data and persist to disk. Returns (artifact_id, json_content)."""
    from autocontext.artifacts import DistilledModelArtifact, HarnessArtifact, PolicyArtifact

    validated: HarnessArtifact | PolicyArtifact | DistilledModelArtifact
    if artifact_type == "harness":
        validated = HarnessArtifact.model_validate(artifact_data)
    elif artifact_type == "policy":
        validated = PolicyArtifact.model_validate(artifact_data)
    else:
        validated = DistilledModelArtifact.model_validate(artifact_data)

    artifacts_dir = ctx.settings.knowledge_root / "_openclaw_artifacts"
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    artifact_path = artifacts_dir / f"{validated.id}.json"
    artifact_path.write_text(validated.model_dump_json(indent=2), encoding="utf-8")
    if isinstance(validated, HarnessArtifact):
        ctx.artifacts.write_harness(validated.scenario, f"openclaw_{validated.id}", validated.source_code)

    return validated.id, str(artifact_path)


def publish_artifact(
    ctx: MtsToolContext,
    artifact_data: dict[str, Any],
) -> dict[str, Any]:
    """Publish an artifact (harness, policy, or distilled model) to the local store.

    The artifact_data must be a valid serialized artifact dict with an artifact_type field.
    """
    artifact_type = artifact_data.get("artifact_type")
    if artifact_type not in ("harness", "policy", "distilled_model"):
        return {
            "error": (
                f"Invalid or missing artifact_type: {artifact_type!r}. "
                "Must be harness, policy, or distilled_model."
            )
        }

    try:
        artifact_id, artifact_path = _validate_and_persist_artifact(ctx, artifact_data, str(artifact_type))
    except Exception as exc:
        logger.debug("mcp.tools: caught Exception", exc_info=True)
        return {"error": f"Invalid artifact data: {exc}"}

    return {
        "status": "published",
        "artifact_id": artifact_id,
        "artifact_type": str(artifact_type),
        "path": artifact_path,
    }


def fetch_artifact(
    ctx: MtsToolContext,
    artifact_id: str,
) -> dict[str, Any]:
    """Fetch a published artifact by its ID."""

    artifacts_dir = ctx.settings.knowledge_root / "_openclaw_artifacts"
    artifact_path = artifacts_dir / f"{artifact_id}.json"
    if not artifact_path.exists():
        return {"error": f"Artifact '{artifact_id}' not found"}

    data: dict[str, Any] = read_json(artifact_path)
    return data


def list_artifacts(
    ctx: MtsToolContext,
    scenario: str | None = None,
    artifact_type: str | None = None,
) -> list[dict[str, Any]]:
    """List published artifacts, optionally filtered by scenario or type."""

    artifacts_dir = ctx.settings.knowledge_root / "_openclaw_artifacts"
    if not artifacts_dir.exists():
        return []

    results: list[dict[str, Any]] = []
    for path in sorted(artifacts_dir.glob("*.json")):
        try:
            data: dict[str, Any] = read_json(path)
        except Exception:
            logger.debug("mcp.tools: caught Exception", exc_info=True)
            continue
        if scenario and data.get("scenario") != scenario:
            continue
        if artifact_type and data.get("artifact_type") != artifact_type:
            continue
        results.append({
            "id": data.get("id", path.stem),
            "name": data.get("name", ""),
            "artifact_type": data.get("artifact_type", ""),
            "scenario": data.get("scenario", ""),
            "version": data.get("version", 0),
        })
    return results
