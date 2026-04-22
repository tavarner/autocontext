"""End-to-end tests: exception class → reason-key → trace outcome (TDD — RED phase)."""
from __future__ import annotations

import json

import httpx
import pytest

from autocontext.integrations.anthropic import FileSink, instrument_client


def _error_handler(status_code: int, error_type: str, error_message: str):
    def handler(req: httpx.Request) -> httpx.Response:
        return httpx.Response(
            status_code,
            json={"type": "error", "error": {"type": error_type, "message": error_message}},
            headers={"x-request-id": "req_test"},
        )
    return handler


def test_rate_limit_exception_maps_to_rate_limited_in_trace(tmp_path, make_anthropic_client) -> None:
    """RateLimitError (HTTP 429) → outcome.error.type == 'rateLimited'."""
    client = make_anthropic_client(_error_handler(429, "rate_limit_error", "Too many requests"))
    sink = FileSink(path=tmp_path / "t.jsonl", batch_size=1)
    wrapped = instrument_client(client, sink=sink, app_id="test-app")

    with pytest.raises(Exception):
        wrapped.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=100,
            messages=[{"role": "user", "content": "hi"}],
        )

    sink.close()
    trace = json.loads((tmp_path / "t.jsonl").read_text().strip())
    assert trace["outcome"]["label"] == "failure"
    assert trace["outcome"]["error"]["type"] == "rateLimited"


def test_overloaded_exception_maps_to_overloaded_in_trace(tmp_path, make_anthropic_client) -> None:
    """OverloadedError (HTTP 529) → outcome.error.type == 'overloaded'."""
    client = make_anthropic_client(_error_handler(529, "overloaded_error", "Server overloaded"))
    sink = FileSink(path=tmp_path / "t.jsonl", batch_size=1)
    wrapped = instrument_client(client, sink=sink, app_id="test-app")

    with pytest.raises(Exception):
        wrapped.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=100,
            messages=[{"role": "user", "content": "hi"}],
        )

    sink.close()
    trace = json.loads((tmp_path / "t.jsonl").read_text().strip())
    assert trace["outcome"]["label"] == "failure"
    # OverloadedError maps to "overloaded"
    assert trace["outcome"]["error"]["type"] == "overloaded"


def test_timeout_exception_maps_to_timeout_in_trace(tmp_path, make_anthropic_client) -> None:
    """APITimeoutError raised directly → outcome.error.type == 'timeout'.

    We test via the _proxy._invoke_non_streaming path by constructing the
    exception and verifying it is correctly categorized by map_exception_to_reason.
    An actual mock transport raises APIConnectionError rather than APITimeoutError
    when a Python exception is raised inside the transport, so we verify the
    taxonomy directly for the timeout case.
    """
    import anthropic
    from autocontext.integrations.anthropic._taxonomy import map_exception_to_reason

    exc = anthropic.APITimeoutError(
        request=httpx.Request("POST", "https://api.anthropic.com/v1/messages"),
    )
    assert map_exception_to_reason(exc) == "timeout"

    # Also verify APIConnectionError (what the transport emits) maps to apiConnection
    conn_exc = anthropic.APIConnectionError(
        request=httpx.Request("POST", "https://api.anthropic.com/v1/messages"),
        message="connection refused",
    )
    assert map_exception_to_reason(conn_exc) == "apiConnection"

    # Connection errors from transport become apiConnection in the trace
    def conn_error_handler(req: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("refused")

    client = make_anthropic_client(conn_error_handler)
    sink = FileSink(path=tmp_path / "t.jsonl", batch_size=1)
    wrapped = instrument_client(client, sink=sink, app_id="test-app")

    with pytest.raises(anthropic.APIConnectionError):
        wrapped.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=100,
            messages=[{"role": "user", "content": "hi"}],
        )

    sink.close()
    trace = json.loads((tmp_path / "t.jsonl").read_text().strip())
    assert trace["outcome"]["label"] == "failure"
    assert trace["outcome"]["error"]["type"] == "apiConnection"
