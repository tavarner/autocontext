import { randomUUID } from "node:crypto";
import { StepStatusSchema, SubgoalStatusSchema } from "./types.js";
import type {
  Mission,
  MissionBudgetUsage,
  MissionSubgoal,
  MissionVerificationRecord,
  StepStatus,
  SubgoalRow,
  SubgoalStatus,
  VerificationRow,
} from "./store-contracts.js";

export function generateMissionRecordId(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

export function buildMissionCompletionTimestamp(status: string): string | null {
  return status === "completed" || status === "failed" || status === "canceled"
    ? new Date().toISOString()
    : null;
}

export function buildStepCompletionTimestamp(status: StepStatus): string | null {
  const parsedStatus = StepStatusSchema.parse(status);
  return parsedStatus === "completed"
    || parsedStatus === "failed"
    || parsedStatus === "blocked"
    || parsedStatus === "skipped"
    ? new Date().toISOString()
    : null;
}

export function buildSubgoalCompletionTimestamp(status: SubgoalStatus): string | null {
  const parsedStatus = SubgoalStatusSchema.parse(status);
  return parsedStatus === "completed" || parsedStatus === "failed" || parsedStatus === "skipped"
    ? new Date().toISOString()
    : null;
}

export function buildMissionVerificationRecord(row: VerificationRow): MissionVerificationRecord {
  return {
    id: row.id as string,
    passed: (row.passed as number) === 1,
    reason: row.reason as string,
    suggestions: JSON.parse((row.suggestions as string) ?? "[]"),
    metadata: JSON.parse((row.metadata as string) ?? "{}"),
    createdAt: row.created_at as string,
  };
}

export function buildMissionBudgetUsage(
  mission: Mission | null,
  stepsUsed: number,
): MissionBudgetUsage {
  const maxSteps = mission?.budget?.maxSteps;
  const maxCostUsd = mission?.budget?.maxCostUsd;
  const exhausted = maxSteps !== undefined ? stepsUsed >= maxSteps : false;

  return {
    stepsUsed,
    ...(maxSteps !== undefined ? { maxSteps } : {}),
    ...(maxCostUsd !== undefined ? { maxCostUsd } : {}),
    exhausted,
  };
}

export function buildMissionSubgoalRecord(
  row: SubgoalRow,
  status: SubgoalStatus,
): MissionSubgoal {
  return {
    id: row.id as string,
    missionId: row.mission_id as string,
    description: row.description as string,
    priority: row.priority as number,
    status,
    createdAt: row.created_at as string,
    completedAt: (row.completed_at as string) ?? undefined,
  };
}
