/**
 * SkillPackage — portable knowledge packages for external agents.
 * Port of autocontext/src/autocontext/knowledge/export.py
 */

import {
  type SkillPackageData,
  type SkillPackageDict,
  type SkillPackageExampleOutputDict,
} from "./skill-package-contracts.js";
import { buildSkillPackageDict } from "./skill-package-dict-workflow.js";
import { buildExportedAgentTaskSkillData } from "./skill-package-export-workflow.js";
import { cleanLessons } from "./skill-package-lesson-cleaning.js";
import { buildSkillPackageMarkdown } from "./skill-package-markdown-workflow.js";

export type {
  SkillPackageData,
  SkillPackageDict,
  SkillPackageExampleOutputDict,
} from "./skill-package-contracts.js";
export { cleanLessons } from "./skill-package-lesson-cleaning.js";

export class SkillPackage {
  readonly scenarioName: string;
  readonly displayName: string;
  readonly description: string;
  readonly playbook: string;
  readonly lessons: string[];
  readonly bestStrategy: Record<string, unknown> | null;
  readonly bestScore: number;
  readonly bestElo: number;
  readonly hints: string;
  readonly harness: Record<string, string>;
  readonly metadata: Record<string, unknown>;
  readonly taskPrompt: string | null;
  readonly judgeRubric: string | null;
  readonly exampleOutputs: Array<{ output: string; score: number; reasoning: string }> | null;
  readonly outputFormat: string | null;
  readonly referenceContext: string | null;
  readonly contextPreparation: string | null;
  readonly maxRounds: number | null;
  readonly qualityThreshold: number | null;

  constructor(data: SkillPackageData) {
    this.scenarioName = data.scenarioName;
    this.displayName = data.displayName;
    this.description = data.description;
    this.playbook = data.playbook;
    this.lessons = data.lessons;
    this.bestStrategy = data.bestStrategy;
    this.bestScore = data.bestScore;
    this.bestElo = data.bestElo;
    this.hints = data.hints;
    this.harness = data.harness ?? {};
    this.metadata = data.metadata ?? {};
    this.taskPrompt = data.taskPrompt ?? null;
    this.judgeRubric = data.judgeRubric ?? null;
    this.exampleOutputs = data.exampleOutputs ?? null;
    this.outputFormat = data.outputFormat ?? null;
    this.referenceContext = data.referenceContext ?? null;
    this.contextPreparation = data.contextPreparation ?? null;
    this.maxRounds = data.maxRounds ?? null;
    this.qualityThreshold = data.qualityThreshold ?? null;
  }

  toDict(): SkillPackageDict {
    return buildSkillPackageDict({
      scenarioName: this.scenarioName,
      displayName: this.displayName,
      description: this.description,
      playbook: this.playbook,
      lessons: this.lessons,
      bestStrategy: this.bestStrategy,
      bestScore: this.bestScore,
      bestElo: this.bestElo,
      hints: this.hints,
      harness: this.harness,
      metadata: this.metadata,
      taskPrompt: this.taskPrompt,
      judgeRubric: this.judgeRubric,
      exampleOutputs: this.exampleOutputs,
      outputFormat: this.outputFormat,
      referenceContext: this.referenceContext,
      contextPreparation: this.contextPreparation,
      maxRounds: this.maxRounds,
      qualityThreshold: this.qualityThreshold,
    });
  }

  toSkillMarkdown(): string {
    return buildSkillPackageMarkdown({
      scenarioName: this.scenarioName,
      displayName: this.displayName,
      description: this.description,
      playbook: this.playbook,
      lessons: this.lessons,
      bestStrategy: this.bestStrategy,
      bestScore: this.bestScore,
      bestElo: this.bestElo,
      hints: this.hints,
      harness: this.harness,
      metadata: this.metadata,
      taskPrompt: this.taskPrompt,
      judgeRubric: this.judgeRubric,
      exampleOutputs: this.exampleOutputs,
      outputFormat: this.outputFormat,
      referenceContext: this.referenceContext,
      contextPreparation: this.contextPreparation,
      maxRounds: this.maxRounds,
      qualityThreshold: this.qualityThreshold,
    });
  }
}

export function exportAgentTaskSkill(opts: {
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
}): SkillPackage {
  return new SkillPackage(buildExportedAgentTaskSkillData(opts));
}
