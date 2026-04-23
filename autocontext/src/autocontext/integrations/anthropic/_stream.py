"""StreamProxy — block-aware accumulator for Anthropic SSE streams."""
from __future__ import annotations

import json
import traceback
import weakref
from typing import Any, Callable


class _Accumulator:
    def __init__(self) -> None:
        self.content_blocks: dict[int, dict[str, Any]] = {}
        self.usage: dict[str, Any] = {}
        self.stop_reason: str | None = None

    def on_message_start(self, ev: dict[str, Any]) -> None:
        msg = ev.get("message", {})
        if "usage" in msg:
            self.usage = dict(msg["usage"])

    def on_content_block_start(self, ev: dict[str, Any]) -> None:
        idx = int(ev["index"])
        block = dict(ev["content_block"])
        block["buffer"] = ""
        self.content_blocks[idx] = block

    def on_content_block_delta(self, ev: dict[str, Any]) -> None:
        idx = int(ev["index"])
        delta = ev.get("delta", {})
        dtype = delta.get("type")
        entry = self.content_blocks.setdefault(idx, {"type": "unknown", "buffer": ""})
        if dtype == "text_delta":
            entry["buffer"] += delta.get("text", "")
        elif dtype == "input_json_delta":
            entry["buffer"] += delta.get("partial_json", "")

    def on_content_block_stop(self, ev: dict[str, Any]) -> None:
        idx = int(ev["index"])
        entry = self.content_blocks.get(idx)
        if not entry:
            return
        if entry.get("type") == "tool_use":
            raw = entry.get("buffer", "")
            try:
                entry["finalized_input"] = json.loads(raw) if raw else {}
            except json.JSONDecodeError:
                entry["finalized_input"] = {"_rawJsonError": raw}

    def on_message_delta(self, ev: dict[str, Any]) -> None:
        delta = ev.get("delta", {})
        if "stop_reason" in delta:
            self.stop_reason = delta["stop_reason"]
        if "usage" in ev:
            # Only update non-None values so that message_start input_tokens
            # are not clobbered by message_delta's None-filled fields
            # (Anthropic SDK model_dump() includes None for absent fields).
            self.usage.update({k: v for k, v in ev["usage"].items() if v is not None})

    def handle_event(self, ev: dict[str, Any]) -> bool:
        """Returns True when message_stop is seen."""
        etype = ev.get("type")
        if etype == "message_start":
            self.on_message_start(ev)
        elif etype == "content_block_start":
            self.on_content_block_start(ev)
        elif etype == "content_block_delta":
            self.on_content_block_delta(ev)
        elif etype == "content_block_stop":
            self.on_content_block_stop(ev)
        elif etype == "message_delta":
            self.on_message_delta(ev)
        elif etype == "message_stop":
            return True
        return False


def _abandoned_callback(
    state: dict[str, bool],
    on_finalize: Callable[[_Accumulator, dict[str, Any]], None],
    acc: _Accumulator,
) -> None:
    if state.get("finalized"):
        return
    try:
        on_finalize(acc, {"label": "partial", "reasoning": "abandonedStream"})
    except Exception:
        pass
    state["finalized"] = True


class StreamProxy:
    """Wraps Anthropic sync stream. Acts as both context manager and iterator."""

    def __init__(
        self,
        *,
        inner_stream: Any,
        on_finalize: Callable[[_Accumulator, dict[str, Any]], None],
    ) -> None:
        self._inner = inner_stream
        self._on_finalize = on_finalize
        self._accumulator = _Accumulator()
        self._state: dict[str, bool] = {"finalized": False}
        acc = self._accumulator
        self._finalizer = weakref.finalize(self, _abandoned_callback, self._state, on_finalize, acc)

    def __enter__(self) -> "StreamProxy":
        return self

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        if self._state["finalized"]:
            return
        if exc_type is not None:
            from autocontext.integrations.anthropic._taxonomy import map_exception_to_reason  # noqa: PLC0415
            self._on_finalize(self._accumulator, {
                "label": "failure",
                "error": {
                    "type": map_exception_to_reason(exc_val),
                    "message": str(exc_val),
                    "stack": traceback.format_exc(),
                },
            })
        else:
            if not self._state["finalized"]:
                self._on_finalize(self._accumulator, {"label": "success"})
        self._state["finalized"] = True
        self._finalizer.detach()

    def __iter__(self) -> "StreamProxy":
        return self

    def __next__(self) -> Any:
        try:
            event = next(iter(self._inner))
        except StopIteration:
            if not self._state["finalized"]:
                self._on_finalize(self._accumulator, {"label": "success"})
                self._state["finalized"] = True
                self._finalizer.detach()
            raise
        event_dict = event if isinstance(event, dict) else event.model_dump()
        if self._accumulator.handle_event(event_dict):
            if not self._state["finalized"]:
                self._on_finalize(self._accumulator, {"label": "success"})
                self._state["finalized"] = True
                self._finalizer.detach()
        return event

    @property
    def text_stream(self):
        """Yields text pieces from text_delta events."""
        for event in self:
            event_dict = event if isinstance(event, dict) else event.model_dump()
            if event_dict.get("type") == "content_block_delta":
                delta = event_dict.get("delta", {})
                if delta.get("type") == "text_delta":
                    yield delta.get("text", "")

    def accumulated(self) -> _Accumulator:
        return self._accumulator


class AsyncStreamProxy:
    """Wraps Anthropic async stream."""

    def __init__(
        self,
        *,
        inner_stream: Any,
        on_finalize: Callable[[_Accumulator, dict[str, Any]], None],
    ) -> None:
        self._inner = inner_stream
        self._on_finalize = on_finalize
        self._accumulator = _Accumulator()
        self._state: dict[str, bool] = {"finalized": False}
        acc = self._accumulator
        self._finalizer = weakref.finalize(self, _abandoned_callback, self._state, on_finalize, acc)

    async def __aenter__(self) -> "AsyncStreamProxy":
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        if self._state["finalized"]:
            return
        if exc_type is not None:
            from autocontext.integrations.anthropic._taxonomy import map_exception_to_reason  # noqa: PLC0415
            self._on_finalize(self._accumulator, {
                "label": "failure",
                "error": {
                    "type": map_exception_to_reason(exc_val),
                    "message": str(exc_val),
                    "stack": traceback.format_exc(),
                },
            })
        else:
            if not self._state["finalized"]:
                self._on_finalize(self._accumulator, {"label": "success"})
        self._state["finalized"] = True
        self._finalizer.detach()

    def __aiter__(self) -> "AsyncStreamProxy":
        return self

    async def __anext__(self) -> Any:
        try:
            event = await self._inner.__anext__()
        except StopAsyncIteration:
            if not self._state["finalized"]:
                self._on_finalize(self._accumulator, {"label": "success"})
                self._state["finalized"] = True
                self._finalizer.detach()
            raise
        event_dict = event if isinstance(event, dict) else event.model_dump()
        if self._accumulator.handle_event(event_dict):
            if not self._state["finalized"]:
                self._on_finalize(self._accumulator, {"label": "success"})
                self._state["finalized"] = True
                self._finalizer.detach()
        return event

    @property
    def text_stream(self):
        async def _gen():
            async for event in self:
                event_dict = event if isinstance(event, dict) else event.model_dump()
                if event_dict.get("type") == "content_block_delta":
                    delta = event_dict.get("delta", {})
                    if delta.get("type") == "text_delta":
                        yield delta.get("text", "")
        return _gen()

    def accumulated(self) -> _Accumulator:
        return self._accumulator
