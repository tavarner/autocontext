import { describe, expect, it } from "vitest";

import {
  buildMissionBudgetUsage,
  buildMissionCompletionTimestamp,
  buildMissionVerificationRecord,
  buildStepCompletionTimestamp,
  buildSubgoalCompletionTimestamp,
} from "../src/mission/store-lifecycle-workflow.js";
import { missionFromRow, stepFromRow, subgoalFromRow } from "../src/mission/store-mappers.js";

describe("mission store workflows", () => {
  it("maps mission, step, subgoal, and verification rows into domain records", () => {
    expect(
      missionFromRow({
        id: "mission-1",
        name: "Ship feature",
        goal: "Release it",
        status: "active",
        budget: '{"maxSteps":5}',
        metadata: '{"team":"core"}',
        created_at: "2026-01-01T00:00:00Z",
        updated_at: null,
        completed_at: null,
      }),
    ).toMatchObject({
      id: "mission-1",
      budget: { maxSteps: 5 },
      metadata: { team: "core" },
    });

    expect(
      stepFromRow({
        id: "step-1",
        mission_id: "mission-1",
        description: "Investigate",
        status: "bogus",
        result: null,
        error: null,
        tool_calls: "[]",
        metadata: "{}",
        created_at: "2026-01-01T00:00:00Z",
        completed_at: null,
        parent_step_id: null,
        order_index: 1,
      }),
    ).toMatchObject({ status: "pending" });

    expect(
      subgoalFromRow({
        id: "subgoal-1",
        mission_id: "mission-1",
        description: "Prepare",
        priority: 2,
        status: "bogus",
        steps_json: "[]",
        created_at: "2026-01-01T00:00:00Z",
        completed_at: null,
      }),
    ).toMatchObject({ status: "pending", priority: 2 });

    expect(
      buildMissionVerificationRecord({
        id: "verify-1",
        mission_id: "mission-1",
        passed: 1,
        reason: "Looks good",
        suggestions: '["Ship it"]',
        metadata: '{"confidence":0.9}',
        created_at: "2026-01-01T00:00:00Z",
      }),
    ).toEqual({
      id: "verify-1",
      passed: true,
      reason: "Looks good",
      suggestions: ["Ship it"],
      metadata: { confidence: 0.9 },
      createdAt: "2026-01-01T00:00:00Z",
    });
  });

  it("computes completion timestamps and budget usage", () => {
    expect(buildMissionCompletionTimestamp("completed")).toBeTypeOf("string");
    expect(buildMissionCompletionTimestamp("active")).toBeNull();
    expect(buildStepCompletionTimestamp("blocked")).toBeTypeOf("string");
    expect(buildSubgoalCompletionTimestamp("pending")).toBeNull();

    expect(
      buildMissionBudgetUsage(
        {
          id: "mission-1",
          name: "Ship feature",
          goal: "Release it",
          status: "active",
          budget: { maxSteps: 5, maxCostUsd: 10 },
          metadata: {},
          createdAt: "2026-01-01T00:00:00Z",
        },
        5,
      ),
    ).toEqual({
      stepsUsed: 5,
      maxSteps: 5,
      maxCostUsd: 10,
      exhausted: true,
    });
  });
});
