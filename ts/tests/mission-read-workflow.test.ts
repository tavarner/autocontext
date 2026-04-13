import { describe, expect, it, vi } from "vitest";

import { executeMissionReadRequest } from "../src/server/mission-read-workflow.js";

describe("mission read workflow", () => {
  it("returns 404 when the requested mission does not exist", () => {
    const missionManager = {
      get: vi.fn(() => null),
    };
    const missionApi = {
      getMission: vi.fn(),
      getMissionSteps: vi.fn(),
      getMissionSubgoals: vi.fn(),
      getMissionBudget: vi.fn(),
      getMissionArtifacts: vi.fn(),
    };

    expect(executeMissionReadRequest({
      missionId: "missing",
      resource: "steps",
      missionManager,
      missionApi,
    })).toEqual({
      status: 404,
      body: { error: "Mission 'missing' not found" },
    });
    expect(missionApi.getMissionSteps).not.toHaveBeenCalled();
  });

  it("returns mission detail via missionApi", () => {
    const missionApi = {
      getMission: vi.fn(() => ({ id: "mission_1", stepsCount: 2 })),
      getMissionSteps: vi.fn(),
      getMissionSubgoals: vi.fn(),
      getMissionBudget: vi.fn(),
      getMissionArtifacts: vi.fn(),
    };

    expect(executeMissionReadRequest({
      missionId: "mission_1",
      resource: "detail",
      missionManager: { get: vi.fn() },
      missionApi,
    })).toEqual({
      status: 200,
      body: { id: "mission_1", stepsCount: 2 },
    });
    expect(missionApi.getMission).toHaveBeenCalledWith("mission_1");
  });

  it("returns collection resources after existence checks", () => {
    const missionManager = {
      get: vi.fn(() => ({ id: "mission_1" })),
    };
    const missionApi = {
      getMission: vi.fn(),
      getMissionSteps: vi.fn(() => [{ id: "step_1" }]),
      getMissionSubgoals: vi.fn(() => [{ id: "subgoal_1" }]),
      getMissionBudget: vi.fn(() => ({ stepsUsed: 1, maxSteps: 3 })),
      getMissionArtifacts: vi.fn(() => ({ checkpointDir: "/tmp/checkpoints" })),
    };

    expect(executeMissionReadRequest({
      missionId: "mission_1",
      resource: "steps",
      missionManager,
      missionApi,
    })).toEqual({
      status: 200,
      body: [{ id: "step_1" }],
    });

    expect(executeMissionReadRequest({
      missionId: "mission_1",
      resource: "subgoals",
      missionManager,
      missionApi,
    })).toEqual({
      status: 200,
      body: [{ id: "subgoal_1" }],
    });

    expect(executeMissionReadRequest({
      missionId: "mission_1",
      resource: "budget",
      missionManager,
      missionApi,
    })).toEqual({
      status: 200,
      body: { stepsUsed: 1, maxSteps: 3 },
    });

    expect(executeMissionReadRequest({
      missionId: "mission_1",
      resource: "artifacts",
      missionManager,
      missionApi,
    })).toEqual({
      status: 200,
      body: { checkpointDir: "/tmp/checkpoints" },
    });
  });
});
