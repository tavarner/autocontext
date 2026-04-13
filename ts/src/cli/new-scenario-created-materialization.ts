import type {
  CreatedScenarioOutput,
  ImportedScenarioMaterializationResult,
} from "./new-scenario-command-contracts.js";
import { executeCreatedScenarioMaterializationResult } from "./new-scenario-materialization-execution.js";
import { prepareCreatedScenarioMaterialization } from "./new-scenario-created-materialization-preparation.js";

export async function executeCreatedScenarioMaterialization(opts: {
  created: CreatedScenarioOutput;
  materializeScenario: (request: {
    name: string;
    family: string;
    spec: Record<string, unknown>;
    knowledgeRoot: string;
  }) => Promise<ImportedScenarioMaterializationResult>;
  knowledgeRoot: string;
  json: boolean;
}): Promise<string> {
  return executeCreatedScenarioMaterializationResult(prepareCreatedScenarioMaterialization(opts));
}
