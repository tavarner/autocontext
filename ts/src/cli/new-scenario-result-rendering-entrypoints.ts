import type {
  MaterializedScenarioOutput,
  NormalizedImportedScenario,
} from "./new-scenario-command-contracts.js";
import { renderCreatedScenarioResult } from "./new-scenario-created-result-rendering.js";
import { serializeMaterializedScenarioResultOutput } from "./new-scenario-result-output-serialization.js";

export function renderMaterializedScenarioResult(opts: {
  parsed: NormalizedImportedScenario;
  materialized: MaterializedScenarioOutput;
  json: boolean;
}): string {
  return serializeMaterializedScenarioResultOutput(opts);
}

export { renderCreatedScenarioResult };
