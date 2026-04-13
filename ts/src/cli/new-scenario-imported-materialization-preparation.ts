import type {
  ImportedScenarioMaterializationResult,
  NormalizedImportedScenario,
} from "./new-scenario-command-contracts.js";
import { normalizeImportedScenarioSpec } from "./new-scenario-normalization-workflow.js";

export function prepareImportedScenarioMaterialization(opts: {
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
}): {
  parsed: NormalizedImportedScenario;
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
    parsed: normalizeImportedScenarioSpec({
      spec: opts.spec,
      detectScenarioFamily: opts.detectScenarioFamily,
      isScenarioFamilyName: opts.isScenarioFamilyName,
      validFamilies: opts.validFamilies,
    }),
    materializeScenario: opts.materializeScenario,
    knowledgeRoot: opts.knowledgeRoot,
    json: opts.json,
  };
}
