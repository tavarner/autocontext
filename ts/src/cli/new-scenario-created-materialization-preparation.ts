import type {
  CreatedScenarioOutput,
  ImportedScenarioMaterializationResult,
} from "./new-scenario-command-contracts.js";

export function prepareCreatedScenarioMaterialization(opts: {
  created: CreatedScenarioOutput;
  materializeScenario: (request: {
    name: string;
    family: string;
    spec: Record<string, unknown>;
    knowledgeRoot: string;
  }) => Promise<ImportedScenarioMaterializationResult>;
  knowledgeRoot: string;
  json: boolean;
}): {
  created: CreatedScenarioOutput;
  materializeScenario: (request: {
    name: string;
    family: string;
    spec: Record<string, unknown>;
    knowledgeRoot: string;
  }) => Promise<ImportedScenarioMaterializationResult>;
  knowledgeRoot: string;
  json: boolean;
} {
  return {
    created: opts.created,
    materializeScenario: opts.materializeScenario,
    knowledgeRoot: opts.knowledgeRoot,
    json: opts.json,
  };
}
