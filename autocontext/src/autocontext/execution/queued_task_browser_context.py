"""Browser-backed reference-context enrichment for queued tasks."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from autocontext.config.settings import AppSettings
from autocontext.integrations.browser.context_capture import (
    capture_browser_context,
    render_captured_browser_context,
)


class QueuedTaskBrowserContextService(Protocol):
    """Build authoritative reference context from a browser snapshot."""

    def build_reference_context(
        self,
        *,
        task_id: str,
        browser_url: str,
        reference_context: str | None,
    ) -> str: ...


@dataclass(frozen=True, slots=True)
class SettingsBackedQueuedTaskBrowserContextService:
    """Capture browser context for queued tasks using AppSettings."""

    settings: AppSettings

    def build_reference_context(
        self,
        *,
        task_id: str,
        browser_url: str,
        reference_context: str | None,
    ) -> str:
        context = capture_browser_context(
            self.settings,
            browser_url=browser_url,
            evidence_root=(self.settings.runs_root / "task_queue" / task_id),
        )
        return merge_queued_task_reference_context(
            reference_context=reference_context,
            browser_context=render_captured_browser_context(context),
        )


def create_queued_task_browser_context_service(
    settings: AppSettings,
) -> QueuedTaskBrowserContextService:
    """Create a settings-backed queued-task browser context service."""
    return SettingsBackedQueuedTaskBrowserContextService(settings=settings)


def merge_queued_task_reference_context(
    *,
    reference_context: str | None,
    browser_context: str,
) -> str:
    """Merge queued-task reference context with browser-derived context."""
    parts = []
    trimmed_reference_context = (reference_context or "").strip()
    if trimmed_reference_context:
        parts.append(trimmed_reference_context)
    trimmed_browser_context = browser_context.strip()
    if trimmed_browser_context:
        parts.append(trimmed_browser_context)
    return "\n\n".join(parts)


__all__ = [
    "QueuedTaskBrowserContextService",
    "SettingsBackedQueuedTaskBrowserContextService",
    "create_queued_task_browser_context_service",
    "merge_queued_task_reference_context",
]
