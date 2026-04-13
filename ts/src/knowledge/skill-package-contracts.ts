export interface SkillPackageExampleOutputDict {
  output: string;
  score: number;
  reasoning: string;
}

export interface SkillPackageDict {
  [key: string]: unknown;
  scenario_name: string;
  display_name: string;
  description: string;
  playbook: string;
  lessons: string[];
  best_strategy: Record<string, unknown> | null;
  best_score: number;
  best_elo: number;
  hints: string;
  harness: Record<string, string>;
  metadata: Record<string, unknown>;
  task_prompt?: string;
  judge_rubric?: string;
  example_outputs?: SkillPackageExampleOutputDict[];
  output_format?: string;
  reference_context?: string;
  context_preparation?: string;
  max_rounds?: number;
  quality_threshold?: number | null;
}

export interface SkillPackageData {
  scenarioName: string;
  displayName: string;
  description: string;
  playbook: string;
  lessons: string[];
  bestStrategy: Record<string, unknown> | null;
  bestScore: number;
  bestElo: number;
  hints: string;
  harness?: Record<string, string>;
  metadata?: Record<string, unknown>;
  taskPrompt?: string | null;
  judgeRubric?: string | null;
  exampleOutputs?: Array<{ output: string; score: number; reasoning: string }> | null;
  outputFormat?: string | null;
  referenceContext?: string | null;
  contextPreparation?: string | null;
  maxRounds?: number | null;
  qualityThreshold?: number | null;
}
