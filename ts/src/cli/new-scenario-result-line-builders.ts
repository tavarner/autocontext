import type {
  CreatedScenarioOutput,
  NormalizedImportedScenario,
} from "./new-scenario-command-contracts.js";

export function buildMaterializedScenarioResultLines(opts: {
  parsed: NormalizedImportedScenario;
  scenarioDir: string;
  generatedSource: boolean;
}): string[] {
  const lines = [
    `Materialized scenario: ${opts.parsed.name} (family: ${opts.parsed.family})`,
    `  Directory: ${opts.scenarioDir}`,
  ];
  if (opts.generatedSource) {
    lines.push("  Generated: scenario.js");
  }
  return lines;
}

export function buildCreatedScenarioResultLines(opts: {
  created: CreatedScenarioOutput;
  scenarioDir: string;
  generatedSource: boolean;
}): string[] {
  const lines = [
    `Materialized scenario: ${opts.created.name} (family: ${opts.created.family})`,
    `  Directory: ${opts.scenarioDir}`,
    `  Task prompt: ${opts.created.spec.taskPrompt}`,
    `  Rubric: ${opts.created.spec.rubric}`,
  ];
  if (opts.generatedSource) {
    lines.push("  Generated: scenario.js");
  }
  return lines;
}
