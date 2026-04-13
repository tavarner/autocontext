import { describe, expect, it, vi } from "vitest";

import { MissionEventEmitter } from "../src/mission/events.js";
import {
  buildMissionProgressMessage,
  subscribeToMissionProgressEvents,
} from "../src/server/mission-progress-workflow.js";

describe("mission progress workflow", () => {
  it("builds mission progress messages from mission manager state", () => {
    expect(buildMissionProgressMessage({
      missionId: "mission_1",
      latestStep: undefined,
      missionManager: {
        get: () => ({ status: "running" }),
        steps: () => [{ description: "Analyze incident" }],
        budgetUsage: () => ({ stepsUsed: 1, maxSteps: 5 }),
      },
    })).toEqual({
      type: "mission_progress",
      missionId: "mission_1",
      status: "running",
      stepsCompleted: 1,
      latestStep: "Analyze incident",
      budgetUsed: 1,
      budgetMax: 5,
    });
  });

  it("returns null when mission state cannot be found", () => {
    expect(buildMissionProgressMessage({
      missionId: "missing",
      latestStep: undefined,
      missionManager: {
        get: () => null,
        steps: () => [],
        budgetUsage: () => ({ stepsUsed: 0, maxSteps: 0 }),
      },
    })).toBeNull();
  });

  it("subscribes to mission events and forwards shaped progress payloads", () => {
    const events = new MissionEventEmitter();
    const onProgress = vi.fn();

    const unsubscribe = subscribeToMissionProgressEvents({
      missionEvents: events,
      buildMissionProgress: (missionId: string, latestStep?: string) => ({
        type: "mission_progress",
        missionId,
        status: "running",
        stepsCompleted: latestStep ? 1 : 0,
        ...(latestStep ? { latestStep } : {}),
      }),
      onProgress,
    });

    events.emitCreated("mission_1", "Ship fix", "Resolve outage");
    events.emitStep("mission_1", "Analyze incident", 1);
    events.emitStatusChange("mission_1", "running", "paused");
    events.emitVerified("mission_1", true, "Looks good");

    expect(onProgress).toHaveBeenNthCalledWith(1, {
      type: "mission_progress",
      missionId: "mission_1",
      status: "running",
      stepsCompleted: 0,
    });
    expect(onProgress).toHaveBeenNthCalledWith(2, {
      type: "mission_progress",
      missionId: "mission_1",
      status: "running",
      stepsCompleted: 1,
      latestStep: "Analyze incident",
    });
    expect(onProgress).toHaveBeenCalledTimes(4);

    unsubscribe();
    events.emitStep("mission_1", "After unsubscribe", 2);
    expect(onProgress).toHaveBeenCalledTimes(4);
  });
});
