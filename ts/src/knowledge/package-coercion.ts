import type { StrategyPackageData } from "./package-types.js";
import { displayNameForScenario } from "./package-metadata.js";

const PACKAGE_FORMAT_VERSION = 1;

export function coerceHarness(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const harness: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") {
      harness[key] = value;
    }
  }
  return harness;
}

export function coercePackage(
  raw: Record<string, unknown>,
  scenarioOverride?: string,
): StrategyPackageData {
  const scenarioName = scenarioOverride
    ?? (typeof raw.scenario_name === "string" ? raw.scenario_name : undefined)
    ?? (typeof raw.scenarioName === "string" ? raw.scenarioName : undefined)
    ?? "unknown";

  return {
    formatVersion:
      typeof raw.format_version === "number"
        ? raw.format_version
        : typeof raw.formatVersion === "number"
          ? raw.formatVersion
          : PACKAGE_FORMAT_VERSION,
    scenarioName,
    displayName:
      typeof raw.display_name === "string"
        ? raw.display_name
        : typeof raw.displayName === "string"
          ? raw.displayName
          : displayNameForScenario(scenarioName),
    description:
      typeof raw.description === "string"
        ? raw.description
        : `Exported knowledge for ${scenarioName}`,
    playbook: typeof raw.playbook === "string" ? raw.playbook : "",
    lessons: Array.isArray(raw.lessons)
      ? raw.lessons.filter((value): value is string => typeof value === "string")
      : [],
    bestStrategy:
      raw.best_strategy && typeof raw.best_strategy === "object" && !Array.isArray(raw.best_strategy)
        ? (raw.best_strategy as Record<string, unknown>)
        : raw.bestStrategy && typeof raw.bestStrategy === "object" && !Array.isArray(raw.bestStrategy)
          ? (raw.bestStrategy as Record<string, unknown>)
          : null,
    bestScore:
      typeof raw.best_score === "number"
        ? raw.best_score
        : typeof raw.bestScore === "number"
          ? raw.bestScore
          : 0,
    bestElo:
      typeof raw.best_elo === "number"
        ? raw.best_elo
        : typeof raw.bestElo === "number"
          ? raw.bestElo
          : 1500,
    hints: typeof raw.hints === "string" ? raw.hints : "",
    harness: coerceHarness(raw.harness),
    metadata:
      raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
        ? (raw.metadata as Record<string, unknown>)
        : {},
    taskPrompt:
      typeof raw.task_prompt === "string"
        ? raw.task_prompt
        : typeof raw.taskPrompt === "string"
          ? raw.taskPrompt
          : null,
    judgeRubric:
      typeof raw.judge_rubric === "string"
        ? raw.judge_rubric
        : typeof raw.judgeRubric === "string"
          ? raw.judgeRubric
          : null,
    exampleOutputs: Array.isArray(raw.example_outputs)
      ? (raw.example_outputs as Array<{ output: string; score: number; reasoning: string }>)
      : Array.isArray(raw.exampleOutputs)
        ? (raw.exampleOutputs as Array<{ output: string; score: number; reasoning: string }>)
        : null,
    outputFormat:
      typeof raw.output_format === "string"
        ? raw.output_format
        : typeof raw.outputFormat === "string"
          ? raw.outputFormat
          : null,
    referenceContext:
      typeof raw.reference_context === "string"
        ? raw.reference_context
        : typeof raw.referenceContext === "string"
          ? raw.referenceContext
          : null,
    contextPreparation:
      typeof raw.context_preparation === "string"
        ? raw.context_preparation
        : typeof raw.contextPreparation === "string"
          ? raw.contextPreparation
          : null,
    maxRounds:
      typeof raw.max_rounds === "number"
        ? raw.max_rounds
        : typeof raw.maxRounds === "number"
          ? raw.maxRounds
          : null,
    qualityThreshold:
      typeof raw.quality_threshold === "number"
        ? raw.quality_threshold
        : typeof raw.qualityThreshold === "number"
          ? raw.qualityThreshold
          : null,
  };
}
