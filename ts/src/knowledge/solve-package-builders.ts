import type { ScenarioFamilyName } from "../scenarios/families.js";
import { serializeSkillPackage, type SerializedSkillPackageDict } from "./package.js";
import {
  buildAgentTaskLessons,
  buildGeneratedScenarioLessons,
  buildGeneratedScenarioPlaybook,
  humanizeScenarioName,
} from "./solve-package-helpers.js";
import { SkillPackage } from "./skill-package.js";

export function buildAgentTaskSolvePackage(opts: {
  scenarioName: string;
  description: string;
  taskPrompt: string;
  judgeRubric: string;
  outputFormat: "free_text" | "json_schema" | "code";
  maxRounds: number;
  qualityThreshold: number;
  bestRound: number;
  totalRounds: number;
  terminationReason: string;
  bestScore: number;
  bestOutput: string;
  judgeFailures: number;
  bestReasoning: string;
  referenceContext?: string | null;
  contextPreparation?: string | null;
}): SerializedSkillPackageDict {
  const pkg = new SkillPackage({
    scenarioName: opts.scenarioName,
    displayName: humanizeScenarioName(opts.scenarioName),
    description: opts.description,
    playbook: [
      "## Improvement Summary",
      "",
      `- Best round: ${opts.bestRound}`,
      `- Total rounds: ${opts.totalRounds}`,
      `- Termination reason: ${opts.terminationReason}`,
      `- Best score: ${opts.bestScore.toFixed(4)}`,
      "",
      "## Best Output",
      "",
      opts.bestOutput,
    ].join("\n"),
    lessons: buildAgentTaskLessons({
      bestScore: opts.bestScore,
      totalRounds: opts.totalRounds,
      terminationReason: opts.terminationReason,
    }, opts.bestReasoning),
    bestStrategy: {
      family: "agent_task",
      best_round: opts.bestRound,
      termination_reason: opts.terminationReason,
    },
    bestScore: opts.bestScore,
    bestElo: 1500,
    hints: "",
    metadata: {
      family: "agent_task",
      total_rounds: opts.totalRounds,
      termination_reason: opts.terminationReason,
      judge_failures: opts.judgeFailures,
    },
    taskPrompt: opts.taskPrompt,
    judgeRubric: opts.judgeRubric,
    exampleOutputs: [{
      output: opts.bestOutput,
      score: opts.bestScore,
      reasoning: opts.bestReasoning || "Best output from improvement loop.",
    }],
    outputFormat: opts.outputFormat,
    referenceContext: opts.referenceContext ?? null,
    contextPreparation: opts.contextPreparation ?? null,
    maxRounds: opts.maxRounds,
    qualityThreshold: opts.qualityThreshold,
  });
  return serializeSkillPackage(pkg);
}

export function buildGeneratedScenarioSolvePackage(opts: {
  scenarioName: string;
  family: ScenarioFamilyName;
  description: string;
  score: number;
  reasoning: string;
  dimensionScores: Record<string, number>;
  records: Array<{ action: { name: string } }>;
  stepsExecuted: number;
  validation: { durationMs: number; executedMethods: string[] };
}): SerializedSkillPackageDict {
  const pkg = new SkillPackage({
    scenarioName: opts.scenarioName,
    displayName: humanizeScenarioName(opts.scenarioName),
    description: opts.description,
    playbook: buildGeneratedScenarioPlaybook(opts.family, {
      score: opts.score,
      reasoning: opts.reasoning,
      dimensionScores: opts.dimensionScores,
      records: opts.records,
      stepsExecuted: opts.stepsExecuted,
    }),
    lessons: buildGeneratedScenarioLessons({
      reasoning: opts.reasoning,
      dimensionScores: opts.dimensionScores,
    }),
    bestStrategy: {
      family: opts.family,
      action_trace: opts.records.map((record) => record.action.name),
      steps_executed: opts.stepsExecuted,
    },
    bestScore: opts.score,
    bestElo: 1500,
    hints: "",
    metadata: {
      family: opts.family,
      generated_source: true,
      execution_validation: {
        duration_ms: opts.validation.durationMs,
        executed_methods: opts.validation.executedMethods,
      },
      steps_executed: opts.stepsExecuted,
      dimension_scores: opts.dimensionScores,
      reasoning: opts.reasoning,
    },
  });
  return serializeSkillPackage(pkg);
}
