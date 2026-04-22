# `_shared` — stability commitment

## Public surface

- `TraceSink` — runtime-checkable `Protocol` with `add`/`flush`/`close`.
- `FileSink` — batched JSONL trace sink.
- `autocontext_session(*, user_id, session_id)` — context manager binding session identity to every wrapped-client call within its scope.
- `current_session()` — read the active session dict; returns empty dict when unbound.

## Stability level

v1 — stable. SemVer with parent `autocontext` package.

## Semantic caveats

- `FileSink.close()` is explicit. No `atexit` registration by default; opt in via `FileSink(..., register_atexit=True)` for script-style use.
- `autocontext_session` contextvar propagates across `asyncio.to_thread` and `contextvars.copy_context()` but NOT across raw `threading.Thread` targets.
- Full semantic-caveat list (per-provider): see the owning integration library's `STABILITY.md`.

## Breaking-change policy

SemVer. Breaking changes require a major-version bump of `autocontext`.
