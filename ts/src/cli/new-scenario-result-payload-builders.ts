import type {
  CreatedScenarioOutput,
  MaterializedScenarioOutput,
  NormalizedImportedScenario,
} from "./new-scenario-command-contracts.js";

export function buildMaterializedScenarioResultPayload(opts: {
  parsed: NormalizedImportedScenario;
  materialized: MaterializedScenarioOutput;
}): NormalizedImportedScenario & {
  scenarioDir: string;
  generatedSource: boolean;
  persisted: boolean;
} {
  return {
    ...opts.parsed,
    scenarioDir: opts.materialized.scenarioDir,
    generatedSource: opts.materialized.generatedSource,
    persisted: opts.materialized.persisted,
  };
}

export function buildCreatedScenarioResultPayload(opts: {
  created: CreatedScenarioOutput;
  materialized: MaterializedScenarioOutput;
}): CreatedScenarioOutput & {
  scenarioDir: string;
  generatedSource: boolean;
  persisted: boolean;
} {
  return {
    ...opts.created,
    scenarioDir: opts.materialized.scenarioDir,
    generatedSource: opts.materialized.generatedSource,
    persisted: opts.materialized.persisted,
  };
}
