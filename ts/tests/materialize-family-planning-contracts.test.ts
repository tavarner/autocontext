import { describe, expect, it } from "vitest";

import {
  AGENT_TASK_FAMILY,
  buildUnsupportedFamilyPlanningResult,
  type MaterializeFamilyPlanningDependencies,
  type MaterializeFamilyPlanningRequest,
} from "../src/scenarios/materialize-family-planning-contracts.js";

describe("materialize family planning contracts", () => {
  it("exports the agent-task family constant and request/dependency contract shapes", () => {
    expect(AGENT_TASK_FAMILY).toBe("agent_task");

    const request: MaterializeFamilyPlanningRequest = {
      family: "agent_task",
      name: "task_one",
      healedSpec: { taskPrompt: "Write a poem" },
      scenarioType: "agent_task",
    };
    const dependencies: MaterializeFamilyPlanningDependencies = {
      hasCodegen: () => false,
      generateScenarioSource: () => "module.exports = {}",
      validateGeneratedScenario: async () => ({
        valid: true,
        errors: [],
        executedMethods: [],
        durationMs: 1,
      }),
    };

    expect(request.scenarioType).toBe("agent_task");
    expect(dependencies.hasCodegen("agent_task")).toBe(false);
  });

  it("builds unsupported-family planning results", () => {
    expect(
      buildUnsupportedFamilyPlanningResult({
        persistedSpec: { name: "custom_board_game" },
        family: "game",
      }),
    ).toMatchObject({
      persistedSpec: { name: "custom_board_game" },
      agentTaskSpec: null,
      source: null,
      generatedSource: false,
      errors: ["custom scenario materialization is not supported for family 'game'"],
    });
  });
});
