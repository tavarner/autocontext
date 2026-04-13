import type { ImportedScenarioMaterializationResult } from "./new-scenario-command-contracts.js";
import { prepareImportedScenarioMaterialization } from "./new-scenario-imported-materialization-preparation.js";
import { executeImportedScenarioMaterializationResult } from "./new-scenario-materialization-execution.js";

export async function executeImportedScenarioMaterialization(opts: {
  spec: Record<string, unknown>;
  detectScenarioFamily: (description: string) => string;
  isScenarioFamilyName: (value: string) => boolean;
  validFamilies: string[];
  materializeScenario: (request: {
    name: string;
    family: string;
    spec: Record<string, unknown>;
    knowledgeRoot: string;
  }) => Promise<ImportedScenarioMaterializationResult>;
  knowledgeRoot: string;
  json: boolean;
}): Promise<string> {
  return executeImportedScenarioMaterializationResult(prepareImportedScenarioMaterialization(opts));
}
