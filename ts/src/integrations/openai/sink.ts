/**
 * Re-export of the shared sink primitives.
 *
 * Kept for backward compatibility with existing internal imports within this
 * package. New integrations should import directly from
 * `autoctx/integrations/_shared`.
 */
export { FileSink } from "../_shared/sink.js";
export type { TraceSink, FileSinkOptions } from "../_shared/sink.js";
