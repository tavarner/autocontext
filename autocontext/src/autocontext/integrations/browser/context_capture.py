"""Reusable browser snapshot capture helpers."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from pathlib import Path

from autocontext.config.settings import AppSettings
from autocontext.integrations.browser.contract.models import BrowserSessionConfig
from autocontext.integrations.browser.factory import browser_runtime_from_settings
from autocontext.integrations.browser.types import BrowserRuntimePort

MAX_BROWSER_VISIBLE_TEXT_CHARS = 1200


@dataclass(frozen=True, slots=True)
class CapturedBrowserContext:
    """Stable browser-derived context that can be folded into prompts."""

    url: str
    title: str
    visible_text: str
    html_path: str | None = None
    screenshot_path: str | None = None


def capture_browser_context(
    settings: AppSettings,
    *,
    browser_url: str,
    evidence_root: Path,
) -> CapturedBrowserContext:
    """Capture a single browser snapshot and normalize its text payload."""
    configured = browser_runtime_from_settings(settings, evidence_root=evidence_root)
    if configured is None:
        raise ValueError("browser exploration is disabled")

    return asyncio.run(
        _capture_browser_context_async(
            configured.runtime,
            configured.session_config,
            browser_url=browser_url,
        )
    )


async def _capture_browser_context_async(
    runtime: BrowserRuntimePort,
    session_config: BrowserSessionConfig,
    *,
    browser_url: str,
) -> CapturedBrowserContext:
    session = await runtime.create_session(session_config)
    try:
        navigation = await session.navigate(browser_url)
        if not navigation.allowed:
            raise ValueError(f"browser navigation blocked by policy: {navigation.policyReason}")
        snapshot = await session.snapshot()
    finally:
        await session.close()

    return CapturedBrowserContext(
        url=snapshot.url,
        title=snapshot.title,
        visible_text=_trim_visible_text(snapshot.visibleText),
        html_path=snapshot.htmlPath,
        screenshot_path=snapshot.screenshotPath,
    )


def render_captured_browser_context(context: CapturedBrowserContext) -> str:
    """Render browser context into prompt-friendly lines."""
    lines = [
        "Live browser context:",
        f"URL: {context.url}",
        f"Title: {context.title}",
        f"Visible text: {context.visible_text}",
    ]
    if context.html_path:
        lines.append(f"HTML artifact: {context.html_path}")
    if context.screenshot_path:
        lines.append(f"Screenshot artifact: {context.screenshot_path}")
    return "\n".join(lines)


def _trim_visible_text(text: str) -> str:
    normalized = " ".join(text.split())
    if len(normalized) <= MAX_BROWSER_VISIBLE_TEXT_CHARS:
        return normalized
    return normalized[:MAX_BROWSER_VISIBLE_TEXT_CHARS].rstrip()


__all__ = [
    "CapturedBrowserContext",
    "capture_browser_context",
    "render_captured_browser_context",
]
