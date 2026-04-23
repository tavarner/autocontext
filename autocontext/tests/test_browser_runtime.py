from __future__ import annotations

from pathlib import Path

import pytest

from autocontext.integrations.browser.chrome_cdp import ChromeCdpSession
from autocontext.integrations.browser.chrome_cdp_runtime import ChromeCdpRuntime
from autocontext.integrations.browser.policy import build_default_browser_session_config


class FakeTransport:
    async def send(self, method: str, params: dict | None = None) -> dict:
        return {}

    async def close(self) -> None:
        return None


class FakeDiscovery:
    def __init__(self, websocket_url: str) -> None:
        self.websocket_url = websocket_url
        self.calls: list[tuple[object, str | None]] = []

    async def resolve_websocket_url(self, config: object, *, preferred_url: str | None = None) -> str:
        self.calls.append((config, preferred_url))
        return self.websocket_url


@pytest.mark.asyncio
async def test_runtime_creates_session_with_transport_and_evidence(tmp_path: Path) -> None:
    created_urls: list[str] = []
    transport = FakeTransport()
    runtime = ChromeCdpRuntime(
        websocket_url="ws://127.0.0.1:9222/devtools/page/1",
        evidence_root=tmp_path,
        transport_factory=lambda url: created_urls.append(url) or transport,
        session_id_factory=lambda: "session_fixed",
    )

    session = await runtime.create_session(
        build_default_browser_session_config(allowed_domains=["example.com"]),
    )

    assert isinstance(session, ChromeCdpSession)
    assert created_urls == ["ws://127.0.0.1:9222/devtools/page/1"]
    assert session.session_id == "session_fixed"
    assert session.transport is transport
    assert session.evidence_store is not None
    assert session.evidence_store.root_dir == tmp_path.resolve()


@pytest.mark.asyncio
async def test_runtime_resolves_transport_url_from_discovery(tmp_path: Path) -> None:
    created_urls: list[str] = []
    transport = FakeTransport()
    discovery = FakeDiscovery("ws://127.0.0.1:9222/devtools/page/discovered")
    runtime = ChromeCdpRuntime(
        debugger_url="http://127.0.0.1:9222",
        preferred_target_url="https://example.com/dashboard",
        evidence_root=tmp_path,
        target_discovery=discovery,
        transport_factory=lambda url: created_urls.append(url) or transport,
        session_id_factory=lambda: "session_fixed",
    )
    config = build_default_browser_session_config(allowed_domains=["example.com"])

    session = await runtime.create_session(config)

    assert isinstance(session, ChromeCdpSession)
    assert created_urls == ["ws://127.0.0.1:9222/devtools/page/discovered"]
    assert discovery.calls == [(config, "https://example.com/dashboard")]
