"""Runtime factory for Chrome CDP browser sessions."""

from __future__ import annotations

from collections.abc import Callable
from pathlib import Path
from typing import TypeAlias
from uuid import uuid4

from autocontext.integrations.browser.chrome_cdp import ChromeCdpSession, ChromeCdpTransport
from autocontext.integrations.browser.chrome_cdp_discovery import (
    ChromeCdpTargetDiscovery,
    ChromeCdpTargetDiscoveryPort,
)
from autocontext.integrations.browser.chrome_cdp_transport import ChromeCdpWebSocketTransport
from autocontext.integrations.browser.contract.models import BrowserSessionConfig
from autocontext.integrations.browser.evidence import BrowserEvidenceStore
from autocontext.integrations.browser.types import BrowserRuntimePort, BrowserSessionPort

TransportFactory: TypeAlias = Callable[[str], ChromeCdpTransport]
SessionIdFactory: TypeAlias = Callable[[], str]


class ChromeCdpRuntime(BrowserRuntimePort):
    """Create thin CDP browser sessions from a single debugger websocket URL."""

    def __init__(
        self,
        *,
        websocket_url: str | None = None,
        debugger_url: str | None = None,
        preferred_target_url: str | None = None,
        evidence_root: str | Path | None = None,
        target_discovery: ChromeCdpTargetDiscoveryPort | None = None,
        transport_factory: TransportFactory | None = None,
        session_id_factory: SessionIdFactory | None = None,
    ) -> None:
        if websocket_url is None and debugger_url is None and target_discovery is None:
            raise ValueError("ChromeCdpRuntime requires websocket_url, debugger_url, or target_discovery")
        self.websocket_url = websocket_url
        self.debugger_url = debugger_url
        self.preferred_target_url = preferred_target_url
        self.evidence_root = Path(evidence_root).resolve() if evidence_root is not None else None
        self.target_discovery = target_discovery
        self.transport_factory = transport_factory or (lambda url: ChromeCdpWebSocketTransport(url))
        self.session_id_factory = session_id_factory or _new_session_id

    async def create_session(self, config: BrowserSessionConfig) -> BrowserSessionPort:
        session_id = self.session_id_factory()
        evidence_store = BrowserEvidenceStore(self.evidence_root) if self.evidence_root is not None else None
        websocket_url = await self._resolve_websocket_url(config)
        return ChromeCdpSession(
            session_id=session_id,
            config=config,
            transport=self.transport_factory(websocket_url),
            evidence_store=evidence_store,
        )

    async def _resolve_websocket_url(self, config: BrowserSessionConfig) -> str:
        if self.websocket_url is not None:
            return self.websocket_url
        discovery = self.target_discovery
        if discovery is None:
            if self.debugger_url is None:
                raise RuntimeError("ChromeCdpRuntime cannot resolve a websocket URL without debugger_url")
            discovery = ChromeCdpTargetDiscovery(self.debugger_url)
        return await discovery.resolve_websocket_url(
            config,
            preferred_url=self.preferred_target_url or None,
        )


def _new_session_id() -> str:
    return f"browser_{uuid4().hex}"


__all__ = ["ChromeCdpRuntime"]
