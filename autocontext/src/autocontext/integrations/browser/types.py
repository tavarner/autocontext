"""Runtime port types for browser exploration."""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from autocontext.integrations.browser.contract.models import (
    BrowserAuditEvent,
    BrowserSessionConfig,
    BrowserSnapshot,
)


@runtime_checkable
class BrowserSessionPort(Protocol):
    """Thin browser session contract shared by Python integrations."""

    config: BrowserSessionConfig

    async def navigate(self, url: str) -> BrowserAuditEvent: ...
    async def snapshot(self) -> BrowserSnapshot: ...
    async def click(self, ref: str) -> BrowserAuditEvent: ...
    async def fill(
        self,
        ref: str,
        text: str,
        *,
        field_kind: str | None = None,
    ) -> BrowserAuditEvent: ...
    async def press(self, key: str) -> BrowserAuditEvent: ...
    async def screenshot(self, name: str) -> BrowserAuditEvent: ...
    async def close(self) -> None: ...


@runtime_checkable
class BrowserRuntimePort(Protocol):
    """Factory for thin browser sessions."""

    async def create_session(self, config: BrowserSessionConfig) -> BrowserSessionPort: ...
