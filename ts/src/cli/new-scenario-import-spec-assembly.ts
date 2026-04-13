import type { NormalizedImportedScenario } from "./new-scenario-command-contracts.js";

export function buildNormalizedImportedScenario(opts: {
  name: string;
  family: string;
  specFields: Record<string, unknown>;
  taskPrompt: string;
  rubric: string;
  description: string;
}): NormalizedImportedScenario {
  return {
    name: opts.name,
    family: opts.family,
    spec: {
      ...opts.specFields,
      taskPrompt: opts.taskPrompt,
      rubric: opts.rubric,
      description: opts.description,
    },
  };
}
