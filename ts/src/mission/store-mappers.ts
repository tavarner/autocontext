import { StepStatusSchema, SubgoalStatusSchema } from "./types.js";
import type {
  Mission,
  MissionBudget,
  MissionStatus,
  MissionStep,
  MissionSubgoal,
  StepStatus,
  SubgoalStatus,
  MissionRow,
  StepRow,
  SubgoalRow,
} from "./store-contracts.js";
import { buildMissionSubgoalRecord } from "./store-lifecycle-workflow.js";

export function missionFromRow(row: MissionRow): Mission {
  return {
    id: row.id,
    name: row.name,
    goal: row.goal,
    status: row.status as MissionStatus,
    budget: row.budget ? (JSON.parse(row.budget) as MissionBudget) : undefined,
    metadata: JSON.parse(row.metadata ?? "{}"),
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
  };
}

export function stepFromRow(row: StepRow): MissionStep {
  const status = StepStatusSchema.safeParse(row.status);
  return {
    id: row.id,
    missionId: row.mission_id,
    description: row.description,
    status: status.success ? status.data : ("pending" as StepStatus),
    result: row.result ?? undefined,
    createdAt: row.created_at,
    completedAt: row.completed_at ?? undefined,
  };
}

export function subgoalFromRow(row: SubgoalRow): MissionSubgoal {
  const status = SubgoalStatusSchema.safeParse(row.status);
  return buildMissionSubgoalRecord(
    row,
    status.success ? status.data : ("pending" as SubgoalStatus),
  );
}
