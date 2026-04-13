import type { NormalizedImportedScenario } from "./new-scenario-command-contracts.js";
import { resolveImportedScenarioFamily } from "./new-scenario-family-resolution.js";
import { parseImportedScenarioCoreFields } from "./new-scenario-import-field-parsing.js";
import { buildNormalizedImportedScenario } from "./new-scenario-import-spec-assembly.js";

export function normalizeImportedScenarioSpec(opts: {
  spec: Record<string, unknown>;
  detectScenarioFamily: (description: string) => string;
  isScenarioFamilyName: (value: string) => boolean;
  validFamilies: string[];
}): NormalizedImportedScenario {
  const { name, taskPrompt, rubric, description } = parseImportedScenarioCoreFields(
    opts.spec,
  );

  const { family, specFields } = resolveImportedScenarioFamily({
    spec: opts.spec,
    description,
    taskPrompt,
    detectScenarioFamily: opts.detectScenarioFamily,
    isScenarioFamilyName: opts.isScenarioFamilyName,
    validFamilies: opts.validFamilies,
  });

  return buildNormalizedImportedScenario({
    name,
    family,
    specFields,
    taskPrompt,
    rubric,
    description,
  });
}
