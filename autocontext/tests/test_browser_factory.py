from __future__ import annotations

from pathlib import Path

import pytest

from autocontext.config.settings import AppSettings
from autocontext.integrations.browser.chrome_cdp_runtime import ChromeCdpRuntime
from autocontext.integrations.browser.factory import (
    ConfiguredBrowserRuntime,
    browser_runtime_from_settings,
)


def test_browser_runtime_from_settings_returns_none_when_disabled(tmp_path: Path) -> None:
    settings = AppSettings(
        browser_enabled=False,
        runs_root=tmp_path / "runs",
    )

    assert browser_runtime_from_settings(settings) is None


def test_browser_runtime_from_settings_builds_chrome_cdp_runtime(tmp_path: Path) -> None:
    settings = AppSettings(
        browser_enabled=True,
        browser_backend="chrome-cdp",
        browser_allowed_domains="example.com",
        browser_debugger_url="http://127.0.0.1:9333",
        browser_preferred_target_url="https://example.com/dashboard",
        runs_root=tmp_path / "runs",
    )

    configured = browser_runtime_from_settings(settings)

    assert isinstance(configured, ConfiguredBrowserRuntime)
    assert configured.session_config.allowedDomains == ["example.com"]
    assert isinstance(configured.runtime, ChromeCdpRuntime)
    assert configured.runtime.debugger_url == "http://127.0.0.1:9333"
    assert configured.runtime.preferred_target_url == "https://example.com/dashboard"
    assert configured.runtime.evidence_root == (tmp_path / "runs").resolve()


def test_browser_runtime_from_settings_rejects_unknown_backend(tmp_path: Path) -> None:
    settings = AppSettings(
        browser_enabled=True,
        browser_backend="mystery",
        runs_root=tmp_path / "runs",
    )

    with pytest.raises(ValueError, match="unsupported browser backend"):
        browser_runtime_from_settings(settings)
