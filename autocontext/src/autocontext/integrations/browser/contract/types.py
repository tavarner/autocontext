from __future__ import annotations

from typing import TypeAlias

from autocontext.integrations.browser.contract.models import (
    BrowserAction1,
    BrowserAction2,
    BrowserAction3,
    BrowserAction4,
    BrowserAction5,
    BrowserAction6,
    BrowserAuditEvent,
    BrowserContractBundle,
    BrowserSessionConfig,
    BrowserSnapshot,
)

BrowserAction: TypeAlias = (
    BrowserAction1
    | BrowserAction2
    | BrowserAction3
    | BrowserAction4
    | BrowserAction5
    | BrowserAction6
)

__all__ = [
    "BrowserAction",
    "BrowserAuditEvent",
    "BrowserContractBundle",
    "BrowserSessionConfig",
    "BrowserSnapshot",
]
