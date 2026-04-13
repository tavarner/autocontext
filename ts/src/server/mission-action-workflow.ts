import type { LLMProvider } from "../types/index.js";
import type { MissionManager } from "../mission/manager.js";

export type MissionAction = "run" | "pause" | "resume" | "cancel";

export interface MissionActionResponse {
  status: number;
  body: unknown;
}

type MissionManagerLike = {
  get: (missionId: string) => { id?: string; metadata?: Record<string, unknown> } | null;
  pause: (missionId: string) => void;
  resume: (missionId: string) => void;
  cancel: (missionId: string) => void;
};

export function buildMissionRunRequest(opts: {
  body: Record<string, unknown>;
  mission: { metadata?: Record<string, unknown> };
  buildMissionProvider: () => LLMProvider;
}): {
  maxIterations: number;
  stepDescription?: string;
  provider?: LLMProvider;
} {
  const rawMaxIterations = opts.body.maxIterations;
  const parsedMaxIterations = typeof rawMaxIterations === "number"
    ? rawMaxIterations
    : Number.parseInt(String(rawMaxIterations ?? "1"), 10);
  const missionType = opts.mission.metadata?.missionType;
  const maxIterations = Number.isInteger(parsedMaxIterations) && parsedMaxIterations > 0
    ? parsedMaxIterations
    : 1;

  return {
    maxIterations,
    stepDescription: typeof opts.body.stepDescription === "string"
      ? opts.body.stepDescription
      : undefined,
    provider: missionType !== "code" && missionType !== "proof"
      ? opts.buildMissionProvider()
      : undefined,
  };
}

export async function executeMissionActionRequest(opts: {
  action: MissionAction;
  missionId: string;
  body: Record<string, unknown>;
  missionManager: MissionManagerLike;
  runManager: {
    getRunsRoot: () => string;
    getKnowledgeRoot: () => string;
    buildMissionProvider: () => LLMProvider;
  };
  deps?: {
    runMissionLoop?: (
      missionManager: unknown,
      missionId: string,
      runsRoot: string,
      knowledgeRoot: string,
      request: {
        maxIterations: number;
        stepDescription?: string;
        provider?: LLMProvider;
      },
    ) => Promise<Record<string, unknown>>;
    buildMissionStatusPayload?: (
      missionManager: unknown,
      missionId: string,
    ) => Record<string, unknown>;
    writeMissionCheckpoint?: (
      missionManager: unknown,
      missionId: string,
      runsRoot: string,
    ) => string;
  };
}): Promise<MissionActionResponse> {
  const mission = opts.missionManager.get(opts.missionId);
  if (!mission) {
    return {
      status: 404,
      body: { error: `Mission '${opts.missionId}' not found` },
    };
  }

  if (opts.action === "run") {
    const { runMissionLoop } = await import("../mission/control-plane.js");
    const executeRunMissionLoop = opts.deps?.runMissionLoop ?? (
      async (manager, missionId, runsRoot, knowledgeRoot, request) => runMissionLoop(
        manager as MissionManager,
        missionId,
        runsRoot,
        knowledgeRoot,
        request,
      )
    );
    return {
      status: 200,
      body: await executeRunMissionLoop(
        opts.missionManager,
        opts.missionId,
        opts.runManager.getRunsRoot(),
        opts.runManager.getKnowledgeRoot(),
        buildMissionRunRequest({
          body: opts.body,
          mission,
          buildMissionProvider: opts.runManager.buildMissionProvider,
        }),
      ),
    };
  }

  opts.missionManager[opts.action](opts.missionId);
  const { buildMissionStatusPayload, writeMissionCheckpoint } =
    await import("../mission/control-plane.js");
  const buildPayload = opts.deps?.buildMissionStatusPayload ?? (
    (manager, missionId) => buildMissionStatusPayload(
      manager as MissionManager,
      missionId,
    )
  );
  const writeCheckpoint = opts.deps?.writeMissionCheckpoint ?? (
    (manager, missionId, runsRoot) => writeMissionCheckpoint(
      manager as MissionManager,
      missionId,
      runsRoot,
    )
  );
  const runsRoot = opts.runManager.getRunsRoot();

  return {
    status: 200,
    body: {
      ...buildPayload(opts.missionManager, opts.missionId),
      checkpointPath: writeCheckpoint(opts.missionManager, opts.missionId, runsRoot),
    },
  };
}
