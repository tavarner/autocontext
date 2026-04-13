import type { ScenarioFamilyName } from "../scenarios/families.js";

export function humanizeScenarioName(name: string): string {
  return name.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function buildAgentTaskLessons(result: {
  bestScore: number;
  totalRounds: number;
  terminationReason: string;
}, bestReasoning: string): string[] {
  const lessons = [
    `The best output reached ${result.bestScore.toFixed(4)} quality after ${result.totalRounds} rounds.`,
    `The loop stopped because '${result.terminationReason}'.`,
  ];
  if (bestReasoning.trim()) {
    lessons.push(bestReasoning.trim());
  }
  return lessons;
}

export function buildGeneratedScenarioPlaybook(
  family: ScenarioFamilyName,
  execution: {
    score: number;
    reasoning: string;
    dimensionScores: Record<string, number>;
    records: Array<{ action: { name: string } }>;
    stepsExecuted: number;
  },
): string {
  const dimensions = Object.entries(execution.dimensionScores)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `- ${name}: ${value.toFixed(4)}`);
  const actions = execution.records.map((record) => `- ${record.action.name}`);
  return [
    "## Generated Scenario Summary",
    "",
    `- Family: ${family}`,
    `- Score: ${execution.score.toFixed(4)}`,
    `- Steps executed: ${execution.stepsExecuted}`,
    "",
    "## Evaluation Reasoning",
    "",
    execution.reasoning,
    "",
    "## Dimension Scores",
    "",
    ...(dimensions.length > 0 ? dimensions : ["- No dimension scores recorded."]),
    "",
    "## Action Trace",
    "",
    ...(actions.length > 0 ? actions : ["- No executable actions were available."]),
  ].join("\n");
}

export function buildGeneratedScenarioLessons(execution: {
  reasoning: string;
  dimensionScores: Record<string, number>;
}): string[] {
  const weakest = Object.entries(execution.dimensionScores)
    .sort(([, left], [, right]) => left - right)[0];
  const lessons = [execution.reasoning];
  if (weakest) {
    lessons.push(`The weakest dimension was '${weakest[0]}' at ${weakest[1].toFixed(4)}.`);
  }
  return lessons;
}
