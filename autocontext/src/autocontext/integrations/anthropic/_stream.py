"""StreamProxy — block-aware accumulator for Anthropic SSE streams."""
from __future__ import annotations

import json
import traceback
import weakref
from collections.abc import AsyncGenerator, Callable, Generator
from typing import Any


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

    def __enter__(self) -> StreamProxy:
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

    def __iter__(self) -> StreamProxy:
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
    def text_stream(self) -> Generator[str, None, None]:
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

    async def __aenter__(self) -> AsyncStreamProxy:
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

    def __aiter__(self) -> AsyncStreamProxy:
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
    def text_stream(self) -> AsyncGenerator[str, None]:
        async def _gen() -> AsyncGenerator[str, None]:
            async for event in self:
                event_dict = event if isinstance(event, dict) else event.model_dump()
                if event_dict.get("type") == "content_block_delta":
                    delta = event_dict.get("delta", {})
                    if delta.get("type") == "text_delta":
                        yield delta.get("text", "")
        return _gen()

    def accumulated(self) -> _Accumulator:
        return self._accumulator


class HelperStreamProxy:
    """Wrap Anthropic's high-level MessageStream while preserving helper methods."""

    def __init__(
        self,
        *,
        inner_stream: Any,
        on_success: Callable[[Any], None],
        on_failure: Callable[[BaseException], None],
        on_partial: Callable[[Any], None],
    ) -> None:
        self._inner = inner_stream
        self._on_success = on_success
        self._on_failure = on_failure
        self._on_partial = on_partial
        self._state: dict[str, bool] = {"finalized": False}

    def _emit_success(self, message: Any) -> None:
        if self._state["finalized"]:
            return
        self._on_success(message)
        self._state["finalized"] = True

    def _emit_failure(self, exc: BaseException) -> None:
        if self._state["finalized"]:
            return
        self._on_failure(exc)
        self._state["finalized"] = True

    def _emit_partial(self) -> None:
        if self._state["finalized"]:
            return
        try:
            snapshot = self._inner.current_message_snapshot
        except Exception:
            return
        self._on_partial(snapshot)
        self._state["finalized"] = True

    def __iter__(self) -> HelperStreamProxy:
        return self

    def __next__(self) -> Any:
        try:
            event = next(self._inner)
        except StopIteration:
            try:
                self._emit_success(self._inner.current_message_snapshot)
            except Exception:
                pass
            raise
        except BaseException as exc:
            self._emit_failure(exc)
            raise

        event_dict = event if isinstance(event, dict) else event.model_dump()
        if event_dict.get("type") == "message_stop":
            self._emit_success(self._inner.current_message_snapshot)
        return event

    def __enter__(self) -> HelperStreamProxy:
        return self

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        if exc_val is not None and isinstance(exc_val, BaseException):
            self._emit_failure(exc_val)
        elif not self._state["finalized"]:
            self._emit_partial()
        self.close()

    def close(self) -> None:
        self._inner.close()

    def get_final_message(self) -> Any:
        try:
            message = self._inner.get_final_message()
        except BaseException as exc:
            self._emit_failure(exc)
            raise
        self._emit_success(message)
        return message

    def get_final_text(self) -> str:
        try:
            text = self._inner.get_final_text()
        except BaseException as exc:
            self._emit_failure(exc)
            raise
        self._emit_success(self._inner.current_message_snapshot)
        return str(text)

    def until_done(self) -> None:
        try:
            self._inner.until_done()
        except BaseException as exc:
            self._emit_failure(exc)
            raise
        self._emit_success(self._inner.current_message_snapshot)

    @property
    def current_message_snapshot(self) -> Any:
        return self._inner.current_message_snapshot

    @property
    def request_id(self) -> str | None:
        value = self._inner.request_id
        return str(value) if value is not None else None

    @property
    def response(self) -> Any:
        return self._inner.response

    @property
    def text_stream(self) -> Generator[str, None, None]:
        for event in self:
            event_dict = event if isinstance(event, dict) else event.model_dump()
            if event_dict.get("type") == "content_block_delta":
                delta = event_dict.get("delta", {})
                if delta.get("type") == "text_delta":
                    yield delta.get("text", "")


class HelperStreamManagerProxy:
    """Wrap Anthropic's MessageStreamManager and return HelperStreamProxy on enter."""

    def __init__(
        self,
        *,
        inner_manager: Any,
        on_success: Callable[[Any], None],
        on_failure: Callable[[BaseException], None],
        on_partial: Callable[[Any], None],
    ) -> None:
        self._inner = inner_manager
        self._on_success = on_success
        self._on_failure = on_failure
        self._on_partial = on_partial
        self._stream: HelperStreamProxy | None = None

    def __enter__(self) -> HelperStreamProxy:
        inner_stream = self._inner.__enter__()
        self._stream = HelperStreamProxy(
            inner_stream=inner_stream,
            on_success=self._on_success,
            on_failure=self._on_failure,
            on_partial=self._on_partial,
        )
        return self._stream

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        if self._stream is not None:
            self._stream.__exit__(exc_type, exc_val, exc_tb)
        self._inner.__exit__(exc_type, exc_val, exc_tb)


class AsyncHelperStreamProxy:
    """Wrap Anthropic's AsyncMessageStream while preserving helper methods."""

    def __init__(
        self,
        *,
        inner_stream: Any,
        on_success: Callable[[Any], None],
        on_failure: Callable[[BaseException], None],
        on_partial: Callable[[Any], None],
    ) -> None:
        self._inner = inner_stream
        self._on_success = on_success
        self._on_failure = on_failure
        self._on_partial = on_partial
        self._state: dict[str, bool] = {"finalized": False}

    def _emit_success(self, message: Any) -> None:
        if self._state["finalized"]:
            return
        self._on_success(message)
        self._state["finalized"] = True

    def _emit_failure(self, exc: BaseException) -> None:
        if self._state["finalized"]:
            return
        self._on_failure(exc)
        self._state["finalized"] = True

    def _emit_partial(self) -> None:
        if self._state["finalized"]:
            return
        try:
            snapshot = self._inner.current_message_snapshot
        except Exception:
            return
        self._on_partial(snapshot)
        self._state["finalized"] = True

    def __aiter__(self) -> AsyncHelperStreamProxy:
        return self

    async def __anext__(self) -> Any:
        try:
            event = await self._inner.__anext__()
        except StopAsyncIteration:
            try:
                self._emit_success(self._inner.current_message_snapshot)
            except Exception:
                pass
            raise
        except BaseException as exc:
            self._emit_failure(exc)
            raise

        event_dict = event if isinstance(event, dict) else event.model_dump()
        if event_dict.get("type") == "message_stop":
            self._emit_success(self._inner.current_message_snapshot)
        return event

    async def __aenter__(self) -> AsyncHelperStreamProxy:
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        if exc_val is not None and isinstance(exc_val, BaseException):
            self._emit_failure(exc_val)
        elif not self._state["finalized"]:
            self._emit_partial()
        await self.close()

    async def close(self) -> None:
        await self._inner.close()

    async def get_final_message(self) -> Any:
        try:
            message = await self._inner.get_final_message()
        except BaseException as exc:
            self._emit_failure(exc)
            raise
        self._emit_success(message)
        return message

    async def get_final_text(self) -> str:
        try:
            text = await self._inner.get_final_text()
        except BaseException as exc:
            self._emit_failure(exc)
            raise
        self._emit_success(self._inner.current_message_snapshot)
        return str(text)

    async def until_done(self) -> None:
        try:
            await self._inner.until_done()
        except BaseException as exc:
            self._emit_failure(exc)
            raise
        self._emit_success(self._inner.current_message_snapshot)

    @property
    def current_message_snapshot(self) -> Any:
        return self._inner.current_message_snapshot

    @property
    def request_id(self) -> str | None:
        value = self._inner.request_id
        return str(value) if value is not None else None

    @property
    def response(self) -> Any:
        return self._inner.response

    @property
    def text_stream(self) -> AsyncGenerator[str, None]:
        async def _gen() -> AsyncGenerator[str, None]:
            async for event in self:
                event_dict = event if isinstance(event, dict) else event.model_dump()
                if event_dict.get("type") == "content_block_delta":
                    delta = event_dict.get("delta", {})
                    if delta.get("type") == "text_delta":
                        yield delta.get("text", "")

        return _gen()


class AsyncHelperStreamManagerProxy:
    """Wrap Anthropic's AsyncMessageStreamManager and preserve helper surface."""

    def __init__(
        self,
        *,
        inner_manager: Any,
        on_success: Callable[[Any], None],
        on_failure: Callable[[BaseException], None],
        on_partial: Callable[[Any], None],
    ) -> None:
        self._inner = inner_manager
        self._on_success = on_success
        self._on_failure = on_failure
        self._on_partial = on_partial
        self._stream: AsyncHelperStreamProxy | None = None

    async def __aenter__(self) -> AsyncHelperStreamProxy:
        inner_stream = await self._inner.__aenter__()
        self._stream = AsyncHelperStreamProxy(
            inner_stream=inner_stream,
            on_success=self._on_success,
            on_failure=self._on_failure,
            on_partial=self._on_partial,
        )
        return self._stream

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        if self._stream is not None:
            await self._stream.__aexit__(exc_type, exc_val, exc_tb)
        await self._inner.__aexit__(exc_type, exc_val, exc_tb)
