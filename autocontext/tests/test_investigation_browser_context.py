from __future__ import annotations

from pathlib import Path

import pytest

from autocontext.config.settings import AppSettings
from autocontext.integrations.browser.context_capture import CapturedBrowserContext
from autocontext.investigation.browser_context import (
    InvestigationBrowserContext,
    capture_investigation_browser_context,
    render_investigation_browser_context,
)


def _make_settings(tmp_path: Path) -> AppSettings:
    return AppSettings(
        browser_enabled=True,
        browser_backend="chrome-cdp",
        browser_allowed_domains="example.com",
        browser_debugger_url="http://127.0.0.1:9333",
        runs_root=tmp_path / "runs",
        knowledge_root=tmp_path / "knowledge",
    )


def test_capture_investigation_browser_context_collects_snapshot_and_closes_session(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    context = CapturedBrowserContext(
        url="https://example.com/status",
        title="Example Status",
        visible_text=("Checkout is degraded due to upstream latency." * 40)[:1200],
        html_path="/tmp/status.html",
        screenshot_path="/tmp/status.png",
    )
    settings = _make_settings(tmp_path)
    expected_evidence_root = (tmp_path / "knowledge" / "_investigations" / "checkout_rca").resolve()

    def _fake_capture_browser_context(
        loaded_settings: AppSettings,
        *,
        browser_url: str,
        evidence_root: Path,
    ) -> CapturedBrowserContext:
        assert loaded_settings is settings
        assert browser_url == "https://example.com/status"
        assert evidence_root == expected_evidence_root
        return context

    monkeypatch.setattr(
        "autocontext.investigation.browser_context.capture_browser_context",
        _fake_capture_browser_context,
    )

    captured = capture_investigation_browser_context(
        settings,
        browser_url="https://example.com/status",
        investigation_name="checkout_rca",
    )

    assert captured == InvestigationBrowserContext(
        url="https://example.com/status",
        title="Example Status",
        visible_text=context.visible_text,
        html_path="/tmp/status.html",
        screenshot_path="/tmp/status.png",
    )


def test_capture_investigation_browser_context_requires_browser_to_be_enabled(
    tmp_path: Path,
) -> None:
    settings = AppSettings(
        browser_enabled=False,
        knowledge_root=tmp_path / "knowledge",
        runs_root=tmp_path / "runs",
    )

    with pytest.raises(ValueError, match="browser exploration is disabled"):
        capture_investigation_browser_context(
            settings,
            browser_url="https://example.com/status",
            investigation_name="checkout_rca",
        )


def test_render_investigation_browser_context_includes_artifact_paths() -> None:
    rendered = render_investigation_browser_context(
        InvestigationBrowserContext(
            url="https://example.com/status",
            title="Example Status",
            visible_text="Checkout is degraded due to upstream latency.",
            html_path="/tmp/status.html",
            screenshot_path="/tmp/status.png",
        )
    )

    assert "URL: https://example.com/status" in rendered
    assert "Title: Example Status" in rendered
    assert "Visible text: Checkout is degraded due to upstream latency." in rendered
    assert "HTML artifact: /tmp/status.html" in rendered
    assert "Screenshot artifact: /tmp/status.png" in rendered
