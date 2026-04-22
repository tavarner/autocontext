"""Hypothesis property tests for Anthropic trace shape invariants."""
from __future__ import annotations

from typing import Any

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from autocontext.production_traces.hashing import initialize_install_salt


@pytest.fixture(autouse=True)
def _init_salt(tmp_path, monkeypatch) -> None:
    monkeypatch.chdir(tmp_path)
    initialize_install_salt(".")


# Strategy for valid role values accepted by the ProductionTrace schema
_role_strategy = st.sampled_from(["user", "assistant", "system"])
# Strategy for simple message content strings (no special chars that break schema)
_content_strategy = st.text(min_size=0, max_size=50).filter(lambda s: "\x00" not in s)

_message_strategy = st.fixed_dictionaries({
    "role": _role_strategy,
    "content": _content_strategy,
})


@given(messages=st.lists(_message_strategy, min_size=1, max_size=5))
@settings(max_examples=30, deadline=5000)
def test_build_success_trace_always_has_required_keys(messages: list[dict[str, Any]]) -> None:
    """build_success_trace always returns a dict with messages, outcome, and usage keys."""
    from autocontext.integrations.anthropic._trace_builder import build_success_trace

    trace = build_success_trace(
        request_snapshot={
            "model": "claude-sonnet-4-5",
            "messages": messages,
            "extra": {},
        },
        response_content=[{"type": "text", "text": "response"}],
        response_usage={"input_tokens": 5, "output_tokens": 3},
        response_stop_reason="end_turn",
        identity={},
        timing={"startedAt": "2024-01-01T00:00:00Z", "endedAt": "2024-01-01T00:00:01Z", "latencyMs": 100},
        env={"environmentTag": "production", "appId": "test-app"},
        source_info={"emitter": "sdk", "sdk": {"name": "autocontext-py", "version": "0.1.0"}},
        trace_id="01HZAAAAAAAAAAAAAAAAAAAAAA",
    )

    assert "messages" in trace, "trace must have messages"
    assert "outcome" in trace, "trace must have outcome"
    assert "usage" in trace, "trace must have usage"
    assert trace["provider"]["name"] == "anthropic"
    assert isinstance(trace["messages"], list)
    assert len(trace["messages"]) >= 1  # At least the assistant response


@given(
    input_tokens=st.integers(min_value=0, max_value=100000),
    cache_create=st.integers(min_value=0, max_value=50000),
    cache_read=st.integers(min_value=0, max_value=50000),
    output_tokens=st.integers(min_value=0, max_value=50000),
)
@settings(max_examples=50, deadline=5000)
def test_cache_aware_usage_tokensIn_always_sums_correctly(
    input_tokens: int,
    cache_create: int,
    cache_read: int,
    output_tokens: int,
) -> None:
    """tokensIn = input_tokens + cache_creation_input_tokens + cache_read_input_tokens."""
    from autocontext.integrations.anthropic._trace_builder import build_success_trace

    trace = build_success_trace(
        request_snapshot={
            "model": "claude-sonnet-4-5",
            "messages": [{"role": "user", "content": "hi"}],
            "extra": {},
        },
        response_content=[{"type": "text", "text": "ok"}],
        response_usage={
            "input_tokens": input_tokens,
            "cache_creation_input_tokens": cache_create,
            "cache_read_input_tokens": cache_read,
            "output_tokens": output_tokens,
        },
        response_stop_reason="end_turn",
        identity={},
        timing={"startedAt": "2024-01-01T00:00:00Z", "endedAt": "2024-01-01T00:00:01Z", "latencyMs": 10},
        env={"environmentTag": "production", "appId": "test-app"},
        source_info={"emitter": "sdk", "sdk": {"name": "autocontext-py", "version": "0.1.0"}},
        trace_id="01HZAAAAAAAAAAAAAAAAAAAAAA",
    )

    assert trace["usage"]["tokensIn"] == input_tokens + cache_create + cache_read
    assert trace["usage"]["tokensOut"] == output_tokens
