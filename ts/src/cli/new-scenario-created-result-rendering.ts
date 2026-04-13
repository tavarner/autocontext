import type {
  CreatedScenarioOutput,
  MaterializedScenarioOutput,
} from "./new-scenario-command-contracts.js";
import { serializeCreatedScenarioResultOutput } from "./new-scenario-result-output-serialization.js";

export function renderCreatedScenarioResult(opts: {
  created: CreatedScenarioOutput;
  materialized: MaterializedScenarioOutput;
  json: boolean;
}): string {
  return serializeCreatedScenarioResultOutput(opts);
}
