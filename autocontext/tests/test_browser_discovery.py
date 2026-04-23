from __future__ import annotations

import pytest

from autocontext.integrations.browser.chrome_cdp_discovery import (
    ChromeCdpDiscoveryError,
    ChromeCdpTarget,
    ChromeCdpTargetDiscovery,
    select_chrome_cdp_target,
)
from autocontext.integrations.browser.policy import build_default_browser_session_config


def test_select_target_prefers_exact_allowed_match() -> None:
    config = build_default_browser_session_config(allowed_domains=["example.com"])
    targets = [
        ChromeCdpTarget(
            target_id="target_1",
            target_type="page",
            title="Home",
            url="https://example.com/home",
            websocket_debugger_url="ws://127.0.0.1:9222/devtools/page/1",
        ),
        ChromeCdpTarget(
            target_id="target_2",
            target_type="page",
            title="Dashboard",
            url="https://example.com/dashboard",
            websocket_debugger_url="ws://127.0.0.1:9222/devtools/page/2",
        ),
    ]

    target = select_chrome_cdp_target(
        targets,
        config,
        preferred_url="https://example.com/dashboard",
    )

    assert target.target_id == "target_2"


def test_select_target_rejects_when_allowlist_does_not_match() -> None:
    config = build_default_browser_session_config(allowed_domains=["example.com"])
    targets = [
        ChromeCdpTarget(
            target_id="target_1",
            target_type="page",
            title="Blocked",
            url="https://blocked.example.net/home",
            websocket_debugger_url="ws://127.0.0.1:9222/devtools/page/1",
        ),
    ]

    with pytest.raises(ChromeCdpDiscoveryError, match="allowlist"):
        select_chrome_cdp_target(targets, config)


@pytest.mark.asyncio
async def test_target_discovery_fetches_json_list_and_resolves_websocket_url() -> None:
    seen_urls: list[str] = []

    async def fake_fetch_json(url: str) -> object:
        seen_urls.append(url)
        return [
            {
                "id": "target_1",
                "type": "page",
                "title": "Dashboard",
                "url": "https://example.com/dashboard",
                "webSocketDebuggerUrl": "ws://127.0.0.1:9222/devtools/page/1",
            }
        ]

    discovery = ChromeCdpTargetDiscovery(
        "http://127.0.0.1:9222/",
        fetch_json=fake_fetch_json,
    )
    config = build_default_browser_session_config(allowed_domains=["example.com"])

    websocket_url = await discovery.resolve_websocket_url(config)

    assert seen_urls == ["http://127.0.0.1:9222/json/list"]
    assert websocket_url == "ws://127.0.0.1:9222/devtools/page/1"
