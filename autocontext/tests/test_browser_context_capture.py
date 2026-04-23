from __future__ import annotations

from types import SimpleNamespace

import pytest

from autocontext.integrations.browser.context_capture import _capture_browser_context_async
from autocontext.integrations.browser.policy import build_default_browser_session_config


class _BlockedSession:
    closed = False

    async def navigate(self, _url: str):
        return SimpleNamespace(allowed=False, policyReason="domain_not_allowed")

    async def snapshot(self):
        raise AssertionError("snapshot should not run after blocked navigation")

    async def close(self) -> None:
        self.closed = True


class _Runtime:
    def __init__(self, session: _BlockedSession) -> None:
        self.session = session

    async def create_session(self, _config):
        return self.session


@pytest.mark.asyncio
async def test_capture_browser_context_fails_closed_on_blocked_navigation() -> None:
    session = _BlockedSession()

    with pytest.raises(ValueError, match="domain_not_allowed"):
        await _capture_browser_context_async(
            _Runtime(session),
            build_default_browser_session_config(allowed_domains=["example.com"]),
            browser_url="https://blocked.example.net",
        )

    assert session.closed is True
