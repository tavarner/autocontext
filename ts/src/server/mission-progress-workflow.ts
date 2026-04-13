import type {
  MissionCreatedEvent,
  MissionEventEmitter,
  MissionStatusChangedEvent,
  MissionStepEvent,
  MissionVerifiedEvent,
} from "../mission/events.js";

export interface MissionProgressMessage {
  type: "mission_progress";
  missionId: string;
  status: string;
  stepsCompleted: number;
  latestStep?: string;
  budgetUsed?: number;
  budgetMax?: number;
}

export function buildMissionProgressMessage(opts: {
  missionId: string;
  latestStep?: string;
  missionManager: {
    get: (missionId: string) => { status: string } | null;
    steps: (missionId: string) => Array<{ description?: string }>;
    budgetUsage: (missionId: string) => { stepsUsed?: number; maxSteps?: number };
  };
}): MissionProgressMessage | null {
  const mission = opts.missionManager.get(opts.missionId);
  if (!mission) {
    return null;
  }
  const steps = opts.missionManager.steps(opts.missionId);
  const budget = opts.missionManager.budgetUsage(opts.missionId);
  return {
    type: "mission_progress",
    missionId: opts.missionId,
    status: mission.status,
    stepsCompleted: steps.length,
    latestStep: opts.latestStep ?? steps.at(-1)?.description,
    budgetUsed: budget.stepsUsed,
    budgetMax: budget.maxSteps,
  };
}

export function subscribeToMissionProgressEvents(opts: {
  missionEvents: Pick<MissionEventEmitter, "on" | "off">;
  buildMissionProgress: (missionId: string, latestStep?: string) => MissionProgressMessage | null;
  onProgress: (message: MissionProgressMessage) => void;
}): () => void {
  const forward = (missionId: string, latestStep?: string) => {
    const progress = opts.buildMissionProgress(missionId, latestStep);
    if (progress) {
      opts.onProgress(progress);
    }
  };
  const onMissionCreated = (event: MissionCreatedEvent) => forward(event.missionId);
  const onMissionStep = (event: MissionStepEvent) => forward(event.missionId, event.description);
  const onMissionStatusChanged = (event: MissionStatusChangedEvent) => forward(event.missionId);
  const onMissionVerified = (event: MissionVerifiedEvent) => forward(event.missionId);

  opts.missionEvents.on("mission_created", onMissionCreated);
  opts.missionEvents.on("mission_step", onMissionStep);
  opts.missionEvents.on("mission_status_changed", onMissionStatusChanged);
  opts.missionEvents.on("mission_verified", onMissionVerified);

  return () => {
    opts.missionEvents.off("mission_created", onMissionCreated);
    opts.missionEvents.off("mission_step", onMissionStep);
    opts.missionEvents.off("mission_status_changed", onMissionStatusChanged);
    opts.missionEvents.off("mission_verified", onMissionVerified);
  };
}
