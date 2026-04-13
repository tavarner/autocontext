import type {
  SkillPackageData,
  SkillPackageDict,
} from "./skill-package-contracts.js";

export function buildSkillPackageDict(data: SkillPackageData): SkillPackageDict {
  const dict: SkillPackageDict = {
    scenario_name: data.scenarioName,
    display_name: data.displayName,
    description: data.description,
    playbook: data.playbook,
    lessons: data.lessons,
    best_strategy: data.bestStrategy,
    best_score: data.bestScore,
    best_elo: data.bestElo,
    hints: data.hints,
    harness: data.harness ?? {},
    metadata: data.metadata ?? {},
  };

  if (data.taskPrompt != null) dict.task_prompt = data.taskPrompt;
  if (data.judgeRubric != null) dict.judge_rubric = data.judgeRubric;
  if (data.exampleOutputs != null) dict.example_outputs = data.exampleOutputs;
  if (data.outputFormat != null) dict.output_format = data.outputFormat;
  if (data.referenceContext != null) dict.reference_context = data.referenceContext;
  if (data.contextPreparation != null) dict.context_preparation = data.contextPreparation;
  if (data.maxRounds != null && data.maxRounds > 1) dict.max_rounds = data.maxRounds;
  if (data.qualityThreshold != null) dict.quality_threshold = data.qualityThreshold;

  return dict;
}
