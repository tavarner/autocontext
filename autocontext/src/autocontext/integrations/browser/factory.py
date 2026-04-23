"""Factory helpers for building browser runtimes from app settings."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from autocontext.config.settings import AppSettings
from autocontext.integrations.browser.chrome_cdp_runtime import ChromeCdpRuntime
from autocontext.integrations.browser.contract.models import BrowserSessionConfig
from autocontext.integrations.browser.policy import resolve_browser_session_config
from autocontext.integrations.browser.types import BrowserRuntimePort


@dataclass(frozen=True, slots=True)
class ConfiguredBrowserRuntime:
    """Resolved browser session config plus the runtime that can create sessions."""

    session_config: BrowserSessionConfig
    runtime: BrowserRuntimePort


def browser_runtime_from_settings(
    settings: AppSettings,
    *,
    evidence_root: Path | None = None,
) -> ConfiguredBrowserRuntime | None:
    """Build a configured browser runtime from app settings.

    Returns ``None`` when browser exploration is disabled.
    """
    if not settings.browser_enabled:
        return None

    if settings.browser_backend != "chrome-cdp":
        raise ValueError(f"unsupported browser backend: {settings.browser_backend}")

    return ConfiguredBrowserRuntime(
        session_config=resolve_browser_session_config(settings),
        runtime=ChromeCdpRuntime(
            debugger_url=settings.browser_debugger_url or None,
            preferred_target_url=settings.browser_preferred_target_url or None,
            evidence_root=evidence_root or settings.runs_root,
        ),
    )


__all__ = ["ConfiguredBrowserRuntime", "browser_runtime_from_settings"]
