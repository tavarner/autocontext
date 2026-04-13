import type { SkillPackageData } from "./skill-package.js";

export type ConflictPolicy = "overwrite" | "merge" | "skip";

export interface StrategyPackageData extends SkillPackageData {
  formatVersion?: number;
}

export interface ImportStrategyPackageResult {
  scenario: string;
  playbookWritten: boolean;
  harnessWritten: string[];
  harnessSkipped: string[];
  skillWritten: boolean;
  metadataWritten: boolean;
  conflictPolicy: ConflictPolicy;
}

export interface PersistedPackageMetadata {
  format_version?: number;
  best_strategy?: Record<string, unknown> | null;
  best_score?: number;
  best_elo?: number;
  metadata?: Record<string, unknown>;
}
