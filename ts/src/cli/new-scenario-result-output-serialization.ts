import type {
  CreatedScenarioOutput,
  MaterializedScenarioOutput,
  NormalizedImportedScenario,
} from "./new-scenario-command-contracts.js";
import {
  buildCreatedScenarioResultLines,
  buildMaterializedScenarioResultLines,
} from "./new-scenario-result-line-builders.js";
import {
  buildCreatedScenarioResultPayload,
  buildMaterializedScenarioResultPayload,
} from "./new-scenario-result-payload-builders.js";

export function serializeMaterializedScenarioResultOutput(opts: {
  parsed: NormalizedImportedScenario;
  materialized: MaterializedScenarioOutput;
  json: boolean;
}): string {
  if (opts.json) {
    return JSON.stringify(
      buildMaterializedScenarioResultPayload({
        parsed: opts.parsed,
        materialized: opts.materialized,
      }),
      null,
      2,
    );
  }

  return buildMaterializedScenarioResultLines({
    parsed: opts.parsed,
    scenarioDir: opts.materialized.scenarioDir,
    generatedSource: opts.materialized.generatedSource,
  }).join("\n");
}

export function serializeCreatedScenarioResultOutput(opts: {
  created: CreatedScenarioOutput;
  materialized: MaterializedScenarioOutput;
  json: boolean;
}): string {
  if (opts.json) {
    return JSON.stringify(
      buildCreatedScenarioResultPayload({
        created: opts.created,
        materialized: opts.materialized,
      }),
      null,
      2,
    );
  }

  return buildCreatedScenarioResultLines({
    created: opts.created,
    scenarioDir: opts.materialized.scenarioDir,
    generatedSource: opts.materialized.generatedSource,
  }).join("\n");
}
