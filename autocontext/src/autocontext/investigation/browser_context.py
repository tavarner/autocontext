"""Browser-backed investigation context capture."""

from __future__ import annotations

from dataclasses import dataclass

from autocontext.config.settings import AppSettings
from autocontext.integrations.browser.context_capture import (
    CapturedBrowserContext,
    capture_browser_context,
    render_captured_browser_context,
)


@dataclass(frozen=True, slots=True)
class InvestigationBrowserContext:
    """Stable browser-derived context folded into investigation inputs."""

    url: str
    title: str
    visible_text: str
    html_path: str | None = None
    screenshot_path: str | None = None


def render_investigation_browser_context(context: InvestigationBrowserContext) -> str:
    """Render browser context into prompt-friendly text."""
    return render_captured_browser_context(
        CapturedBrowserContext(
            url=context.url,
            title=context.title,
            visible_text=context.visible_text,
            html_path=context.html_path,
            screenshot_path=context.screenshot_path,
        )
    )


def build_browser_evidence_summary(context: InvestigationBrowserContext) -> str:
    """Condense browser context into a single evidence summary."""
    if context.title and context.visible_text:
        return f"{context.title}\n{context.visible_text}"
    return context.title or context.visible_text or context.url


def capture_investigation_browser_context(
    settings: AppSettings,
    *,
    browser_url: str,
    investigation_name: str,
) -> InvestigationBrowserContext:
    """Capture a single browser snapshot for an investigation."""
    context = capture_browser_context(
        settings,
        browser_url=browser_url,
        evidence_root=(settings.knowledge_root / "_investigations" / investigation_name),
    )
    return InvestigationBrowserContext(
        url=context.url,
        title=context.title,
        visible_text=context.visible_text,
        html_path=context.html_path,
        screenshot_path=context.screenshot_path,
    )


__all__ = [
    "InvestigationBrowserContext",
    "build_browser_evidence_summary",
    "capture_investigation_browser_context",
    "render_investigation_browser_context",
]
