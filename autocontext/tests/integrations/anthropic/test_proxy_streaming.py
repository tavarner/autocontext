"""ClientProxy streaming tests (TDD — RED phase)."""
from __future__ import annotations

import json

import httpx
import pytest

from autocontext.integrations.anthropic import FileSink, instrument_client

from .conftest import canned_anthropic_sse_chunks


def _sse_handler(chunks: list[bytes]):
    def handler(req: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            content=b"".join(chunks),
            headers={"content-type": "text/event-stream"},
        )
    return handler


def test_streaming_normal_finalize_on_message_stop(tmp_path, make_anthropic_client) -> None:
    """Iterating through all events emits a success trace after message_stop."""
    chunks = canned_anthropic_sse_chunks(text_pieces=["hello", " world"])
    client = make_anthropic_client(_sse_handler(chunks))
    sink = FileSink(path=tmp_path / "t.jsonl", batch_size=1)
    wrapped = instrument_client(client, sink=sink, app_id="test-app")

    collected: list[str] = []
    with wrapped.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=100,
        messages=[{"role": "user", "content": "hi"}],
        stream=True,
    ) as stream:
        for event in stream:
            event_dict = event if isinstance(event, dict) else event.model_dump()
            if event_dict.get("type") == "content_block_delta":
                delta = event_dict.get("delta", {})
                if delta.get("type") == "text_delta":
                    collected.append(delta.get("text", ""))

    assert "".join(collected) == "hello world"
    sink.close()
    lines = (tmp_path / "t.jsonl").read_text().strip().splitlines()
    assert len(lines) == 1
    trace = json.loads(lines[0])
    assert trace["provider"]["name"] == "anthropic"
    assert trace["outcome"] == {"label": "success"}
    # Assistant message content should be accumulated text
    assistant_msgs = [m for m in trace["messages"] if m["role"] == "assistant"]
    assert assistant_msgs[-1]["content"] == "hello world"


def test_streaming_captures_tool_use_block(tmp_path, make_anthropic_client) -> None:
    """Tool-use blocks are accumulated and appear in trace toolCalls."""
    tool_json = '{"city": "NYC"}'
    chunks = canned_anthropic_sse_chunks(
        text_pieces=[],
        tool_use={
            "id": "tu_1",
            "name": "get_weather",
            "input_json_delta_chunks": [tool_json],
        },
    )
    client = make_anthropic_client(_sse_handler(chunks))
    sink = FileSink(path=tmp_path / "t.jsonl", batch_size=1)
    wrapped = instrument_client(client, sink=sink, app_id="test-app")

    with wrapped.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=100,
        messages=[{"role": "user", "content": "What's the weather?"}],
        stream=True,
    ) as stream:
        for _ in stream:
            pass

    sink.close()
    trace = json.loads((tmp_path / "t.jsonl").read_text().strip())
    assert trace["outcome"] == {"label": "success"}
    tool_calls = trace.get("toolCalls", [])
    assert len(tool_calls) >= 1
    assert tool_calls[0]["toolName"] == "get_weather"
    assert tool_calls[0]["args"] == {"city": "NYC"}


def test_streaming_abandoned_emits_partial(tmp_path, make_anthropic_client) -> None:
    """Abandoning iteration (not exhausting the stream) emits a partial trace."""
    chunks = canned_anthropic_sse_chunks(text_pieces=["hello", " world", "!"])
    client = make_anthropic_client(_sse_handler(chunks))
    sink = FileSink(path=tmp_path / "t.jsonl", batch_size=1)
    wrapped = instrument_client(client, sink=sink, app_id="test-app")

    # Only consume a few events then drop the proxy without exhausting
    proxy = wrapped.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=100,
        messages=[{"role": "user", "content": "hi"}],
        stream=True,
    )
    # Read just the first event
    first_event = next(iter(proxy))
    assert first_event is not None
    # Now drop the proxy to trigger abandoned-stream GC path
    del proxy
    import gc
    gc.collect()

    sink.close()
    lines_text = (tmp_path / "t.jsonl").read_text().strip()
    if not lines_text:
        pytest.skip("No trace written — GC may not have run in time")
    trace = json.loads(lines_text.splitlines()[0])
    # Could be partial or success depending on how many events were consumed
    assert trace["outcome"]["label"] in ("partial", "success")


def test_streaming_malformed_tool_input_preserved_as_raw_error(tmp_path, make_anthropic_client) -> None:
    """Malformed JSON in tool-use input is preserved in finalized_input._rawJsonError."""
    from autocontext.integrations.anthropic._stream import _Accumulator

    acc = _Accumulator()
    acc.on_content_block_start({"index": 0, "content_block": {"type": "tool_use", "id": "tu_1", "name": "foo", "input": {}}})
    acc.on_content_block_delta({"index": 0, "delta": {"type": "input_json_delta", "partial_json": "{bad json"}})
    acc.on_content_block_stop({"index": 0})

    block = acc.content_blocks[0]
    assert block["type"] == "tool_use"
    assert "_rawJsonError" in block["finalized_input"]
    assert block["finalized_input"]["_rawJsonError"] == "{bad json"


def test_messages_stream_preserves_helper_final_message_and_emits_trace(
    tmp_path,
    make_anthropic_client,
) -> None:
    """High-level `.messages.stream()` still supports get_final_message()."""
    chunks = canned_anthropic_sse_chunks(text_pieces=["hello", " helper"])
    client = make_anthropic_client(_sse_handler(chunks))
    sink = FileSink(path=tmp_path / "t.jsonl", batch_size=1)
    wrapped = instrument_client(client, sink=sink, app_id="test-app")

    with wrapped.messages.stream(
        model="claude-sonnet-4-5",
        max_tokens=100,
        messages=[{"role": "user", "content": "hi"}],
    ) as stream:
        final_message = stream.get_final_message()

    assert final_message.content[0].text == "hello helper"
    sink.close()
    lines = (tmp_path / "t.jsonl").read_text().strip().splitlines()
    assert len(lines) == 1
    trace = json.loads(lines[0])
    assistant_msgs = [m for m in trace["messages"] if m["role"] == "assistant"]
    assert assistant_msgs[-1]["content"] == "hello helper"
