# `_shared` — stability commitment (TS)

## Public surface

- `TraceSink` — interface with `add`/`flush`/`close`.
- `FileSink` — batched JSONL trace sink.
- `autocontextSession(ctx, fn)` — runs `fn` with `ctx` bound as the active AsyncLocalStorage session.
- `currentSession()` — read the active session; returns `{}` when unbound.

## Stability level

v1 — stable. SemVer with parent `autoctx` package.

## Semantic caveats

- `FileSink.close()` is explicit. No `process.on("beforeExit")` registration by default; opt in via `new FileSink(path, { registerBeforeExit: true })`.
- `autocontextSession` uses Node's `AsyncLocalStorage`; propagates across `await`, `setTimeout`, `Promise.all`, but NOT across raw `new Worker()` threads.
- Full per-provider semantic caveats: see the owning integration library's `STABILITY.md`.

## Breaking-change policy

SemVer. Breaking changes require a major-version bump of `autoctx`.
