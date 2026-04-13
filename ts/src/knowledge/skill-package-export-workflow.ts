import type { SkillPackageData } from "./skill-package-contracts.js";

export function formatSkillPackageDisplayName(scenarioName: string): string {
  return scenarioName.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function buildExportedAgentTaskSkillData(opts: {
  scenarioName: string;
  taskPrompt: string;
  judgeRubric: string;
  outputFormat: string;
  playbook: string;
  lessons: string[];
  bestOutputs: Array<{ output: string; score: number; reasoning: string }>;
  hints?: string;
  referenceContext?: string;
  contextPreparation?: string;
}): SkillPackageData {
  const displayName = formatSkillPackageDisplayName(opts.scenarioName);
  return {
    scenarioName: opts.scenarioName,
    displayName,
    description: `Agent task: ${displayName}`,
    playbook: opts.playbook,
    lessons: opts.lessons,
    bestStrategy: null,
    bestScore: opts.bestOutputs.length > 0 ? opts.bestOutputs[0].score : 0.0,
    bestElo: 1500.0,
    hints: opts.hints ?? "",
    taskPrompt: opts.taskPrompt,
    judgeRubric: opts.judgeRubric,
    exampleOutputs: opts.bestOutputs.length > 0 ? opts.bestOutputs : null,
    outputFormat: opts.outputFormat,
    referenceContext: opts.referenceContext ?? null,
    contextPreparation: opts.contextPreparation ?? null,
  };
}
