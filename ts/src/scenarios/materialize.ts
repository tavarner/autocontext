/**
 * Scenario materialization — persist runnable artifacts from specs (AC-433).
 *
 * This is the missing glue between "spec created" and "runnable scenario on disk."
 * Called by the CLI new-scenario command, MCP tools, and programmatic API.
 */

export type { MaterializeOpts, MaterializeResult } from "./materialize-contracts.js";
export { materializeScenario } from "./materialize-scenario-default-wiring.js";
