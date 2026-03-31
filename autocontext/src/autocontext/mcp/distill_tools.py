"""MCP tool implementations — distill_tools (extracted from tools.py, AC-482)."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any, cast

from autocontext.mcp._base import MtsToolContext

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from autocontext.openclaw.distill import DistillJob


def distill_status(
    ctx: MtsToolContext,
    scenario: str | None = None,
) -> dict[str, Any]:
    """Return the status of distillation workflows.

    Uses DistillJobManager for structured job lifecycle tracking.
    Optionally filters by scenario name.
    """
    from autocontext.openclaw.distill import DistillJobManager

    mgr = DistillJobManager(ctx.settings.knowledge_root)
    jobs: list[DistillJob] = [_sync_distill_job(ctx, mgr, job) for job in mgr.list_jobs(scenario=scenario)]
    job_dicts: list[dict[str, Any]] = [
        j.model_dump() for j in jobs
    ]
    active = sum(1 for j in jobs if j.status in ("pending", "running"))
    return {"active_jobs": active, "jobs": job_dicts}


def trigger_distillation(
    ctx: MtsToolContext,
    scenario: str,
    source_artifact_ids: list[str] | None = None,
    training_config: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Trigger a distillation workflow for a scenario.

    Creates a job record and launches the configured distillation sidecar.
    """
    from autocontext.openclaw.distill import DistillJobError, DistillJobManager, load_distill_sidecar

    mgr = DistillJobManager(ctx.settings.knowledge_root)
    job = mgr.create_job(
        scenario=scenario,
        source_artifact_ids=source_artifact_ids,
        training_config=dict(training_config) if training_config else None,
    )
    sidecar = load_distill_sidecar(ctx.settings, cwd=ctx.settings.knowledge_root.parent)
    if sidecar is None:
        failed = mgr.transition(
            job.job_id,
            "failed",
            error_message=(
                "No distillation sidecar configured. Set "
                "AUTOCONTEXT_OPENCLAW_DISTILL_SIDECAR_FACTORY or AUTOCONTEXT_OPENCLAW_DISTILL_SIDECAR_COMMAND."
            ),
        )
        assert failed is not None
        return {
            "error": failed.error_message,
            "job_id": failed.job_id,
            "status": failed.status,
            "scenario": failed.scenario,
        }
    try:
        sidecar.launch(job.job_id, job.scenario, job.training_config)
        launched_job = mgr.transition(job.job_id, "running")
    except (DistillJobError, OSError, ValueError) as exc:
        failed = mgr.transition(job.job_id, "failed", error_message=str(exc))
        assert failed is not None
        return {
            "error": str(exc),
            "job_id": failed.job_id,
            "status": failed.status,
            "scenario": failed.scenario,
        }
    if launched_job is None:
        return {"error": f"Distillation job '{job.job_id}' not found after launch"}
    return launched_job.model_dump()  # type: ignore[return-value]


def get_distill_job(
    ctx: MtsToolContext,
    job_id: str,
) -> dict[str, Any]:
    """Fetch a single distillation job by ID."""
    from autocontext.openclaw.distill import DistillJobManager

    mgr = DistillJobManager(ctx.settings.knowledge_root)
    job = mgr.get_job(job_id)
    if job is None:
        return {"error": f"Distillation job '{job_id}' not found"}
    job = _sync_distill_job(ctx, mgr, job)
    return job.model_dump()  # type: ignore[return-value]


def update_distill_job(
    ctx: MtsToolContext,
    job_id: str,
    status: str,
    *,
    result_artifact_id: str | None = None,
    error_message: str | None = None,
    training_metrics: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Update a distillation job status with lifecycle validation."""
    from autocontext.openclaw.distill import DistillJobError, DistillJobManager

    mgr = DistillJobManager(ctx.settings.knowledge_root)
    try:
        job = mgr.transition(
            job_id,
            status,  # type: ignore[arg-type]
            result_artifact_id=result_artifact_id,
            error_message=error_message,
            training_metrics=dict(training_metrics) if training_metrics else None,
        )
    except DistillJobError as exc:
        return {"error": str(exc)}

    if job is None:
        return {"error": f"Distillation job '{job_id}' not found"}
    return job.model_dump()  # type: ignore[return-value]


def _sync_distill_job(
    ctx: MtsToolContext,
    mgr: object,
    job: object,
) -> DistillJob:
    """Poll the configured sidecar for an active job and persist any new state."""
    from autocontext.openclaw.distill import DistillJob, DistillJobError, DistillJobManager, load_distill_sidecar

    assert isinstance(mgr, DistillJobManager)
    assert isinstance(job, DistillJob)
    if job.status not in ("pending", "running"):
        return job
    sidecar = load_distill_sidecar(ctx.settings, cwd=ctx.settings.knowledge_root.parent)
    if sidecar is None:
        return job
    try:
        update = sidecar.poll(job.job_id)
    except Exception:
        logger.debug("mcp.tools: caught Exception", exc_info=True)
        return job
    status = update.get("status")
    if status not in ("pending", "running", "completed", "failed"):
        return job
    if status == job.status:
        return job
    try:
        synced = mgr.transition(
            job.job_id,
            status,
            result_artifact_id=cast(str | None, update.get("result_artifact_id")),
            error_message=cast(str | None, update.get("error_message")),
            training_metrics=cast(dict[str, Any] | None, update.get("training_metrics")),
        )
    except DistillJobError:
        return job
    return synced or job
