export type MissionReadResource =
  | "detail"
  | "steps"
  | "subgoals"
  | "budget"
  | "artifacts";

export interface MissionReadResponse {
  status: number;
  body: unknown;
}

export function executeMissionReadRequest(opts: {
  missionId: string;
  resource: MissionReadResource;
  missionManager: { get: (missionId: string) => unknown };
  missionApi: {
    getMission: (missionId: string) => unknown;
    getMissionSteps: (missionId: string) => unknown;
    getMissionSubgoals: (missionId: string) => unknown;
    getMissionBudget: (missionId: string) => unknown;
    getMissionArtifacts: (missionId: string) => unknown;
  };
}): MissionReadResponse {
  if (opts.resource !== "detail" && !opts.missionManager.get(opts.missionId)) {
    return {
      status: 404,
      body: { error: `Mission '${opts.missionId}' not found` },
    };
  }

  if (opts.resource === "detail") {
    const mission = opts.missionApi.getMission(opts.missionId);
    return mission
      ? { status: 200, body: mission }
      : {
          status: 404,
          body: { error: `Mission '${opts.missionId}' not found` },
        };
  }

  switch (opts.resource) {
    case "steps":
      return { status: 200, body: opts.missionApi.getMissionSteps(opts.missionId) };
    case "subgoals":
      return { status: 200, body: opts.missionApi.getMissionSubgoals(opts.missionId) };
    case "budget":
      return { status: 200, body: opts.missionApi.getMissionBudget(opts.missionId) };
    case "artifacts":
      return { status: 200, body: opts.missionApi.getMissionArtifacts(opts.missionId) };
  }
}
