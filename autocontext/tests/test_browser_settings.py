from __future__ import annotations

from unittest.mock import patch

from autocontext.config.settings import AppSettings, load_settings
from autocontext.integrations.browser.policy import resolve_browser_session_config


def test_browser_settings_defaults_are_secure() -> None:
    settings = AppSettings()

    assert settings.browser_enabled is False
    assert settings.browser_backend == "chrome-cdp"
    assert settings.browser_profile_mode == "ephemeral"
    assert settings.browser_allowed_domains == ""
    assert settings.browser_allow_auth is False
    assert settings.browser_allow_uploads is False
    assert settings.browser_allow_downloads is False
    assert settings.browser_capture_screenshots is True
    assert settings.browser_headless is True
    assert settings.browser_debugger_url == "http://127.0.0.1:9222"
    assert settings.browser_preferred_target_url == ""


def test_load_settings_reads_browser_env_vars() -> None:
    with patch.dict("os.environ", {
        "AUTOCONTEXT_BROWSER_ENABLED": "true",
        "AUTOCONTEXT_BROWSER_ALLOWED_DOMAINS": "Example.com,*.Example.org,example.com",
        "AUTOCONTEXT_BROWSER_ALLOW_DOWNLOADS": "true",
        "AUTOCONTEXT_BROWSER_DOWNLOADS_ROOT": "/tmp/downloads",
        "AUTOCONTEXT_BROWSER_DEBUGGER_URL": "http://127.0.0.1:9333",
        "AUTOCONTEXT_BROWSER_PREFERRED_TARGET_URL": "https://example.com/dashboard",
    }):
        settings = load_settings()

    assert settings.browser_enabled is True
    assert settings.browser_allowed_domains == "Example.com,*.Example.org,example.com"
    assert settings.browser_allow_downloads is True
    assert settings.browser_downloads_root == "/tmp/downloads"
    assert settings.browser_debugger_url == "http://127.0.0.1:9333"
    assert settings.browser_preferred_target_url == "https://example.com/dashboard"


def test_resolve_browser_session_config_normalizes_domains() -> None:
    settings = AppSettings(
        browser_allowed_domains=" Example.com ,*.Example.org,example.com ",
        browser_allow_downloads=True,
        browser_downloads_root="/tmp/downloads",
    )

    config = resolve_browser_session_config(settings)

    assert config.allowedDomains == ["example.com", "*.example.org"]
    assert config.allowDownloads is True
    assert config.downloadsRoot == "/tmp/downloads"
