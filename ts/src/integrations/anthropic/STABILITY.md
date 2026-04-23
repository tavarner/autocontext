# Stability — `autoctx/integrations/anthropic`

**Stability level: stable** (API frozen until the next major version).

## Public surface

Symbols re-exported from `index.ts`:

| Symbol | Kind | Stability |
|--------|------|-----------|
| `instrumentClient` | function | stable |
| `FileSink` | class | stable |
| `TraceSink` | interface | stable |
| `autocontextSession` | function | stable |
| `currentSession` | function | stable |
| `FileSinkOpts` | type | stable |

All files not re-exported from `index.ts` (e.g., `taxonomy.ts`,
`trace-builder.ts`, `proxy.ts`, `stream-proxy.ts`, `wrap.ts`) are **private**
and may change without notice. Import only from the subpath export
`autoctx/integrations/anthropic`.

## SDK version range

```
@anthropic-ai/sdk >=0.18,<2.0
```

The integration is tested against the three most-recent patch releases within
the 0.x line. Compatibility with 2.x is not guaranteed and requires a new spec.

## Semantic caveats

1. **`instanceof` check**: `wrapped instanceof Anthropic` returns `false`.
   `instrumentClient` returns a `Proxy` object, not an actual `Anthropic`
   instance. Code that type-narrows on `instanceof Anthropic` will not recognise
   the wrapped client. Use duck-typing or check
   `(client as any)._autocontextInstrumented` instead.

2. **`FileSink.close()` is explicit**: `FileSink` does **not** register a
   `process.on('beforeExit')` hook by default. Callers must call
   `await sink.close()` (or use it as an `AsyncDisposable`/`using` resource)
   to flush pending traces. Script-style callers should add their own
   `beforeExit` handler or wrap in a try/finally.

3. **`autocontextSession` propagation**: Session context is stored in
   `AsyncLocalStorage`. It propagates naturally across all `await` boundaries
   within the same async call chain. No manual context-copying is required for
   `Promise`-based code or `worker_threads` that use `AsyncResource.bind`.

4. **Streaming and `betas.messages.stream`**: When the caller uses the streaming
   helper (`client.messages.stream`), the integration intercepts the stream
   proxy and emits a trace on `finalMessage`. Token usage is captured from the
   `message_stop` event's `usage` field.

5. **AnthropicBedrock and AnthropicVertex**: These SDK variants are **not**
   handled by this integration. Pass `AnthropicBedrock(...)` or
   `AnthropicVertex(...)` through the a2-iii-bedrock or a2-iii-vertex
   sub-specs respectively. The control-plane detector emits a
   `deferred-sdk-variant` advisory for these constructors.

## Cross-runtime parity

This module maintains byte-identical trace output with
`autocontext.integrations.anthropic` (Python). Deviations are bugs. See
`ts/tests/integrations/anthropic/parity/` for the parity test corpus.

## Breaking-change policy

This module follows **SemVer**. Any change to the public API surface (symbol
removal, signature change, interface extension that breaks existing
implementations) requires a **major version bump** of the `autoctx` npm
package. Additions to the public API (new optional parameters, new exports)
are minor bumps. Bug fixes and internal refactors are patch bumps.
