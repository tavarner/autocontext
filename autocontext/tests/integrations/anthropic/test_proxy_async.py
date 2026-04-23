"""ClientProxy async non-streaming test (TDD — RED phase)."""
from __future__ import annotations

import json

import httpx
import pytest

from autocontext.integrations.anthropic import FileSink, instrument_client

from .conftest import canned_anthropic_sse_chunks, canned_messages_response


def _handler_returning(payload):
    def handler(req: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=payload)
    return handler


@pytest.mark.asyncio
async def test_async_messages_create_captures_one_trace(tmp_path, make_async_anthropic_client) -> None:
    """AsyncAnthropic messages.create emits a trace with correct provider and outcome."""
    client = make_async_anthropic_client(_handler_returning(canned_messages_response()))
    sink = FileSink(path=tmp_path / "t.jsonl", batch_size=1)
    wrapped = instrument_client(client, sink=sink, app_id="test-app")

    resp = await wrapped.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=100,
        messages=[{"role": "user", "content": "hi"}],
    )

    assert resp.content[0].text == "hello world"
    sink.close()
    lines = (tmp_path / "t.jsonl").read_text().strip().splitlines()
    assert len(lines) == 1
    trace = json.loads(lines[0])
    assert trace["provider"]["name"] == "anthropic"
    assert trace["model"] == "claude-sonnet-4-5"
    assert trace["outcome"] == {"label": "success"}


def _sse_handler(chunks: list[bytes]):
    def handler(req: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            content=b"".join(chunks),
            headers={"content-type": "text/event-stream"},
        )

    return handler


@pytest.mark.asyncio
async def test_async_messages_stream_preserves_helper_final_message(
    tmp_path,
    make_async_anthropic_client,
) -> None:
    """Async `.messages.stream()` still supports get_final_message()."""
    chunks = canned_anthropic_sse_chunks(text_pieces=["async", " helper"])
    client = make_async_anthropic_client(_sse_handler(chunks))
    sink = FileSink(path=tmp_path / "t.jsonl", batch_size=1)
    wrapped = instrument_client(client, sink=sink, app_id="test-app")

    async with wrapped.messages.stream(
        model="claude-sonnet-4-5",
        max_tokens=100,
        messages=[{"role": "user", "content": "hi"}],
    ) as stream:
        final_message = await stream.get_final_message()

    assert final_message.content[0].text == "async helper"
    sink.close()
    lines = (tmp_path / "t.jsonl").read_text().strip().splitlines()
    assert len(lines) == 1
    trace = json.loads(lines[0])
    assistant_msgs = [m for m in trace["messages"] if m["role"] == "assistant"]
    assert assistant_msgs[-1]["content"] == "async helper"
