"""instrument_client factory tests (TDD — RED phase)."""
from __future__ import annotations

import httpx
import pytest

from autocontext.integrations.anthropic import FileSink, instrument_client


def _canned_handler(req: httpx.Request) -> httpx.Response:
    return httpx.Response(200, json={"id": "msg_fake", "type": "message", "role": "assistant",
                                     "content": [{"type": "text", "text": "hi"}],
                                     "model": "claude-sonnet-4-5", "stop_reason": "end_turn",
                                     "stop_sequence": None, "usage": {"input_tokens": 5, "output_tokens": 2}})


def test_instrument_client_wraps_sync_client(tmp_path, make_anthropic_client) -> None:
    """instrument_client returns a ClientProxy with the wrapped sentinel."""
    client = make_anthropic_client(_canned_handler)
    sink = FileSink(path=tmp_path / "t.jsonl")
    wrapped = instrument_client(client, sink=sink, app_id="test-app")
    assert getattr(wrapped, "__autocontext_wrapped__", False) is True
    sink.close()


def test_double_wrap_raises(tmp_path, make_anthropic_client) -> None:
    """Wrapping an already-wrapped client raises ValueError."""
    client = make_anthropic_client(_canned_handler)
    sink = FileSink(path=tmp_path / "t.jsonl")
    wrapped = instrument_client(client, sink=sink, app_id="test-app")
    with pytest.raises(ValueError, match="already wrapped"):
        instrument_client(wrapped, sink=sink, app_id="test-app")
    sink.close()


def test_missing_app_id_raises(tmp_path, make_anthropic_client, monkeypatch) -> None:
    """Missing app_id (no arg and no env var) raises ValueError."""
    monkeypatch.delenv("AUTOCONTEXT_APP_ID", raising=False)
    client = make_anthropic_client(_canned_handler)
    sink = FileSink(path=tmp_path / "t.jsonl")
    with pytest.raises(ValueError, match="app_id"):
        instrument_client(client, sink=sink)
    sink.close()
