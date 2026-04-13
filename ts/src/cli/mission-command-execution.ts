import type { LLMProvider } from "../types/index.js";
import type {
  PlannedMissionCreate,
  PlannedMissionRun,
} from "./mission-command-workflow.js";

type MissionPayloadBuilder<TManager> = (
  manager: TManager,
  missionId: string,
) => Record<string, unknown>;

type MissionArtifactsBuilder<TManager> = (
  manager: TManager,
  missionId: string,
  runsRoot: string,
) => Record<string, unknown>;

type MissionCheckpointWriter<TManager> = (
  manager: TManager,
  missionId: string,
  runsRoot: string,
) => string;

export function executeMissionCreateCommand<TManager extends {
  create?: (opts: { name: string; goal: string; budget?: { maxSteps: number } }) => string;
}>(opts: {
  manager: TManager;
  createCodeMission: (
    manager: TManager,
    mission: {
      name: string;
      goal: string;
      repoPath: string;
      testCommand: string;
      lintCommand?: string;
      buildCommand?: string;
      budget?: { maxSteps: number };
      metadata: Record<string, unknown>;
    },
  ) => string;
  buildMissionStatusPayload: MissionPayloadBuilder<TManager>;
  writeMissionCheckpoint: MissionCheckpointWriter<TManager>;
  runsRoot: string;
  plan: PlannedMissionCreate;
}): Record<string, unknown> {
  const missionId = opts.plan.missionType === "code"
    ? opts.createCodeMission(opts.manager, {
        name: opts.plan.name,
        goal: opts.plan.goal,
        repoPath: opts.plan.repoPath,
        testCommand: opts.plan.testCommand,
        ...(opts.plan.lintCommand ? { lintCommand: opts.plan.lintCommand } : {}),
        ...(opts.plan.buildCommand ? { buildCommand: opts.plan.buildCommand } : {}),
        ...(opts.plan.budget ? { budget: opts.plan.budget } : {}),
        metadata: {},
      })
    : opts.manager.create?.({
        name: opts.plan.name,
        goal: opts.plan.goal,
        ...(opts.plan.budget ? { budget: opts.plan.budget } : {}),
      });

  if (!missionId) {
    throw new Error("Mission manager did not create a mission.");
  }

  return {
    ...opts.buildMissionStatusPayload(opts.manager, missionId),
    checkpointPath: opts.writeMissionCheckpoint(
      opts.manager,
      missionId,
      opts.runsRoot,
    ),
  };
}

export async function executeMissionRunCommand<TManager>(opts: {
  manager: TManager;
  plan: PlannedMissionRun;
  runsRoot: string;
  knowledgeRoot: string;
  createAdaptiveProvider: () => LLMProvider;
  runMissionLoop: (
    manager: TManager,
    missionId: string,
    runsRoot: string,
    knowledgeRoot: string,
    options: {
      maxIterations: number;
      stepDescription?: string;
      provider?: LLMProvider;
    },
  ) => Promise<Record<string, unknown>>;
}): Promise<Record<string, unknown>> {
  return opts.runMissionLoop(
    opts.manager,
    opts.plan.id,
    opts.runsRoot,
    opts.knowledgeRoot,
    {
      maxIterations: opts.plan.maxIterations,
      stepDescription: opts.plan.stepDescription,
      provider: opts.plan.needsAdaptivePlanning
        ? opts.createAdaptiveProvider()
        : undefined,
    },
  );
}

export function executeMissionStatusCommand<TManager>(opts: {
  manager: TManager;
  missionId: string;
  buildMissionStatusPayload: MissionPayloadBuilder<TManager>;
}): Record<string, unknown> {
  return opts.buildMissionStatusPayload(opts.manager, opts.missionId);
}

export function executeMissionArtifactsCommand<TManager>(opts: {
  manager: TManager;
  missionId: string;
  runsRoot: string;
  buildMissionArtifactsPayload: MissionArtifactsBuilder<TManager>;
}): Record<string, unknown> {
  return opts.buildMissionArtifactsPayload(
    opts.manager,
    opts.missionId,
    opts.runsRoot,
  );
}

export function executeMissionListCommand<TMission>(opts: {
  listMissions: (status?: string) => TMission[];
  status?: string;
}): TMission[] {
  return opts.listMissions(opts.status);
}

export function executeMissionLifecycleCommand<TManager extends {
  pause?: (missionId: string) => void;
  resume?: (missionId: string) => void;
  cancel?: (missionId: string) => void;
}>(opts: {
  action: "pause" | "resume" | "cancel";
  missionId: string;
  manager: TManager;
  buildMissionStatusPayload: MissionPayloadBuilder<TManager>;
  writeMissionCheckpoint: MissionCheckpointWriter<TManager>;
  runsRoot: string;
}): Record<string, unknown> {
  opts.manager[opts.action]?.(opts.missionId);
  return {
    ...opts.buildMissionStatusPayload(opts.manager, opts.missionId),
    checkpointPath: opts.writeMissionCheckpoint(
      opts.manager,
      opts.missionId,
      opts.runsRoot,
    ),
  };
}
