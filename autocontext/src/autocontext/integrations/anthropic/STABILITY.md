# Stability — `autocontext.integrations.anthropic`

**Stability level: stable** (API frozen until the next major version).

## Public surface

Symbols re-exported from `__all__`:

| Symbol | Kind | Stability |
|--------|------|-----------|
| `instrument_client` | function | stable |
| `FileSink` | class | stable |
| `TraceSink` | Protocol | stable |
| `autocontext_session` | context manager | stable |

All names prefixed with `_` (e.g., `_proxy`, `_stream`, `_taxonomy`,
`_trace_builder`, `_wrap`, `_content`) are **private** and may change without
notice.

## SDK version range

```
anthropic >=0.18,<2.0
```

The integration is tested against the three most-recent patch releases within
the 0.x line. Compatibility with 2.x is not guaranteed and requires a new spec.

## Semantic caveats

1. **`isinstance` check**: `isinstance(wrapped, Anthropic)` returns `False`.
   `instrument_client` returns a proxy object, not a subclass of `Anthropic`.
   Code that type-narrows on `isinstance(client, Anthropic)` will not recognise
   the wrapped client. Use duck-typing or check
   `hasattr(client, "_autocontext_instrumented")` instead.

2. **`FileSink.close()` is explicit**: `FileSink` does **not** register an
   `atexit` hook by default. Callers must call `sink.close()` (or use it as a
   context manager) to flush pending traces. Pass `register_atexit=True` to
   `FileSink(path, register_atexit=True)` for script-style use where the process
   may exit without an explicit close.

3. **Contextvar propagation**: `autocontext_session` stores its value in a
   `contextvars.ContextVar`. This propagates naturally across `asyncio.to_thread`
   and `contextvars.copy_context()` boundaries but does **NOT** propagate across
   raw `threading.Thread` targets. Copy the context explicitly if needed:
   ```python
   import contextvars, threading
   ctx = contextvars.copy_context()
   t = threading.Thread(target=lambda: ctx.run(your_fn))
   ```

4. **Streaming via `client.messages.stream`**: When the caller uses the SDK's
   streaming context manager (`with client.messages.stream(...) as stream`), the
   integration intercepts the stream and emits a trace on `get_final_message()`.
   Token usage is captured from the accumulated `MessageStreamEvent` sequence.

5. **AnthropicBedrock and AnthropicVertex**: These SDK variants are **not**
   handled by this integration. Pass their instances to the a2-iii-bedrock or
   a2-iii-vertex sub-specs respectively. The control-plane detector emits a
   `deferred-sdk-variant` advisory for these constructors.

## Cross-runtime parity

This module maintains byte-identical trace output with
`autoctx/integrations/anthropic` (TypeScript). Deviations are bugs. See
`ts/tests/integrations/anthropic/parity/` for the parity test corpus.

## Breaking-change policy

This module follows **SemVer**. Any change to the public API surface (symbol
removal, signature change, protocol extension that breaks existing
implementations) requires a **major version bump** of the `autocontext`
package. Additions to the public API (new optional parameters, new symbols)
are minor bumps. Bug fixes and internal refactors are patch bumps.
