"""Tests for Anthropic trace-builder helpers (TDD — RED phase)."""
from __future__ import annotations

import pytest

from autocontext.production_traces.hashing import initialize_install_salt


@pytest.fixture(autouse=True)
def _init_salt(tmp_path, monkeypatch) -> None:
    monkeypatch.chdir(tmp_path)
    initialize_install_salt(".")


def test_build_success_trace_has_required_keys() -> None:
    """build_success_trace returns a dict with all required ProductionTrace keys."""
    from autocontext.integrations.anthropic._trace_builder import build_success_trace

    trace = build_success_trace(
        request_snapshot={
            "model": "claude-sonnet-4-5",
            "messages": [{"role": "user", "content": "Hello"}],
            "extra": {},
        },
        response_content=[{"type": "text", "text": "Hi there!"}],
        response_usage={"input_tokens": 10, "output_tokens": 5},
        response_stop_reason="end_turn",
        identity={},
        timing={"startedAt": "2024-01-01T00:00:00Z", "endedAt": "2024-01-01T00:00:01Z", "latencyMs": 1000},
        env={"environmentTag": "production", "appId": "test-app"},
        source_info={"emitter": "sdk", "sdk": {"name": "autocontext-py", "version": "0.1.0"}},
        trace_id="01HZAAAAAAAAAAAAAAAAAAAAAA",
    )
    assert "messages" in trace
    assert "outcome" in trace
    assert "usage" in trace
    assert trace["provider"]["name"] == "anthropic"
    assert trace["outcome"] == {"label": "success"}


def test_build_success_trace_flattens_content() -> None:
    """build_success_trace appends assistant message with flattened text content."""
    from autocontext.integrations.anthropic._trace_builder import build_success_trace

    trace = build_success_trace(
        request_snapshot={
            "model": "claude-sonnet-4-5",
            "messages": [{"role": "user", "content": "Hello"}],
            "extra": {},
        },
        response_content=[
            {"type": "text", "text": "Hi "},
            {"type": "text", "text": "there!"},
        ],
        response_usage={"input_tokens": 10, "output_tokens": 5},
        response_stop_reason="end_turn",
        identity={},
        timing={"startedAt": "2024-01-01T00:00:00Z", "endedAt": "2024-01-01T00:00:01Z", "latencyMs": 1000},
        env={"environmentTag": "production", "appId": "test-app"},
        source_info={"emitter": "sdk", "sdk": {"name": "autocontext-py", "version": "0.1.0"}},
        trace_id="01HZAAAAAAAAAAAAAAAAAAAAAA",
    )
    assistant_msg = trace["messages"][-1]
    assert assistant_msg["role"] == "assistant"
    assert assistant_msg["content"] == "Hi there!"


def test_build_success_trace_cache_aware_usage() -> None:
    """tokensIn = input_tokens + cache_creation_input_tokens + cache_read_input_tokens."""
    from autocontext.integrations.anthropic._trace_builder import build_success_trace

    trace = build_success_trace(
        request_snapshot={
            "model": "claude-sonnet-4-5",
            "messages": [{"role": "user", "content": "Hello"}],
            "extra": {},
        },
        response_content=[{"type": "text", "text": "Hi"}],
        response_usage={
            "input_tokens": 10,
            "cache_creation_input_tokens": 5,
            "cache_read_input_tokens": 3,
            "output_tokens": 7,
        },
        response_stop_reason="end_turn",
        identity={},
        timing={"startedAt": "2024-01-01T00:00:00Z", "endedAt": "2024-01-01T00:00:01Z", "latencyMs": 100},
        env={"environmentTag": "production", "appId": "test-app"},
        source_info={"emitter": "sdk", "sdk": {"name": "autocontext-py", "version": "0.1.0"}},
        trace_id="01HZAAAAAAAAAAAAAAAAAAAAAA",
    )
    assert trace["usage"]["tokensIn"] == 18  # 10 + 5 + 3
    assert trace["usage"]["tokensOut"] == 7
    assert trace["usage"]["providerUsage"]["cacheCreationInputTokens"] == 5
    assert trace["usage"]["providerUsage"]["cacheReadInputTokens"] == 3


def test_build_success_trace_stop_reason_in_metadata() -> None:
    """stop_reason is stored in metadata.anthropicStopReason."""
    from autocontext.integrations.anthropic._trace_builder import build_success_trace

    trace = build_success_trace(
        request_snapshot={
            "model": "claude-sonnet-4-5",
            "messages": [{"role": "user", "content": "Hello"}],
            "extra": {},
        },
        response_content=[{"type": "text", "text": "OK"}],
        response_usage={"input_tokens": 5, "output_tokens": 2},
        response_stop_reason="max_tokens",
        identity={},
        timing={"startedAt": "2024-01-01T00:00:00Z", "endedAt": "2024-01-01T00:00:01Z", "latencyMs": 100},
        env={"environmentTag": "production", "appId": "test-app"},
        source_info={"emitter": "sdk", "sdk": {"name": "autocontext-py", "version": "0.1.0"}},
        trace_id="01HZAAAAAAAAAAAAAAAAAAAAAA",
    )
    assert trace.get("metadata", {}).get("anthropicStopReason") == "max_tokens"


def test_build_failure_trace_has_error_outcome() -> None:
    """build_failure_trace returns a trace with failure outcome and error type."""
    from autocontext.integrations.anthropic._trace_builder import build_failure_trace

    trace = build_failure_trace(
        request_snapshot={
            "model": "claude-sonnet-4-5",
            "messages": [{"role": "user", "content": "Hello"}],
            "extra": {},
        },
        identity={},
        timing={"startedAt": "2024-01-01T00:00:00Z", "endedAt": "2024-01-01T00:00:01Z", "latencyMs": 500},
        env={"environmentTag": "production", "appId": "test-app"},
        source_info={"emitter": "sdk", "sdk": {"name": "autocontext-py", "version": "0.1.0"}},
        trace_id="01HZAAAAAAAAAAAAAAAAAAAAAA",
        reason_key="rateLimited",
        error_message="Too many requests",
        stack=None,
    )
    assert trace["outcome"]["label"] == "failure"
    assert trace["outcome"]["error"]["type"] == "rateLimited"
    assert trace["usage"]["tokensIn"] == 0
    assert trace["usage"]["tokensOut"] == 0


def test_finalize_streaming_trace_assembles_blocks() -> None:
    """finalize_streaming_trace collects text blocks into assistant message."""
    from autocontext.integrations.anthropic._trace_builder import finalize_streaming_trace

    accumulated_blocks = {
        0: {"type": "text", "buffer": "Hello world"},
    }
    trace = finalize_streaming_trace(
        request_snapshot={
            "model": "claude-sonnet-4-5",
            "messages": [{"role": "user", "content": "Hi"}],
            "extra": {},
        },
        identity={},
        timing={"startedAt": "2024-01-01T00:00:00Z", "endedAt": "2024-01-01T00:00:01Z", "latencyMs": 200},
        env={"environmentTag": "production", "appId": "test-app"},
        source_info={"emitter": "sdk", "sdk": {"name": "autocontext-py", "version": "0.1.0"}},
        trace_id="01HZAAAAAAAAAAAAAAAAAAAAAA",
        accumulated_content_blocks=accumulated_blocks,
        accumulated_usage={"input_tokens": 5, "output_tokens": 3},
        accumulated_stop_reason="end_turn",
        outcome={"label": "success"},
    )
    assistant_msg = trace["messages"][-1]
    assert assistant_msg["role"] == "assistant"
    assert assistant_msg["content"] == "Hello world"
    assert trace["outcome"] == {"label": "success"}
