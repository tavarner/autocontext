import type {
  Mission,
  MissionBudget,
  MissionStatus,
  MissionStep,
  MissionSubgoal,
  StepStatus,
  SubgoalStatus,
} from "./types.js";

export interface MissionRow {
  id: string;
  name: string;
  goal: string;
  status: string;
  budget: string | null;
  metadata: string;
  created_at: string;
  updated_at: string | null;
  completed_at: string | null;
}

export interface StepRow {
  id: string;
  mission_id: string;
  description: string;
  status: string;
  result: string | null;
  error: string | null;
  tool_calls: string;
  metadata: string;
  created_at: string;
  completed_at: string | null;
  parent_step_id: string | null;
  order_index: number;
}

export interface SubgoalRow {
  id: string;
  mission_id: string;
  description: string;
  priority: number;
  status: string;
  steps_json: string;
  created_at: string;
  completed_at: string | null;
}

export interface VerificationRow {
  id: string;
  mission_id: string;
  passed: number;
  reason: string;
  suggestions: string;
  metadata: string;
  created_at: string;
}

export interface MissionVerificationRecord {
  id: string;
  passed: boolean;
  reason: string;
  suggestions: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface MissionBudgetUsage {
  stepsUsed: number;
  maxSteps?: number;
  maxCostUsd?: number;
  exhausted: boolean;
}

export type {
  Mission,
  MissionBudget,
  MissionStatus,
  MissionStep,
  MissionSubgoal,
  StepStatus,
  SubgoalStatus,
};
