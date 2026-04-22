/**
 * Shared primitives for autocontext integration libraries (TS half).
 *
 * Provider-specific integrations (`autoctx/integrations/openai`,
 * `autoctx/integrations/anthropic`, etc.) consume these via direct import or
 * via re-exports from their own subpath entry.
 *
 * Stability commitment: follows SemVer with the parent `autoctx` package.
 * See `STABILITY.md` in this directory.
 */
export { FileSink } from "./sink.js";
export type { TraceSink, FileSinkOptions } from "./sink.js";
export { autocontextSession, currentSession } from "./session.js";
export type { SessionContext } from "./session.js";
