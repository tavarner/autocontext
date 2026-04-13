import { describe, expect, it, vi } from "vitest";

import {
  planAgentTaskFamilyMaterialization,
  planCodegenFamilyMaterialization,
} from "../src/scenarios/materialize-family-planning-helpers.js";

describe("materialize family planning helpers", () => {
  it("plans normalized agent-task materialization details", () => {
    const result = planAgentTaskFamilyMaterialization({
      healedSpec: {
        taskPrompt: "Write a poem",
        rubric: "Judge creativity",
        description: "Poetry task",
      },
      persistedSpec: {
        name: "task_one",
        family: "agent_task",
        scenario_type: "agent_task",
        description: "Poetry task",
      },
    });

    expect(result.errors).toEqual([]);
    expect(result.generatedSource).toBe(false);
    expect(result.agentTaskSpec).toMatchObject({
      taskPrompt: "Write a poem",
      judgeRubric: "Judge creativity",
    });
    expect(result.persistedSpec).toMatchObject({
      taskPrompt: "Write a poem",
      judgeRubric: "Judge creativity",
      rubric: "Judge creativity",
    });
  });

  it("plans codegen materialization and surfaces validation failures", async () => {
    await expect(
      planCodegenFamilyMaterialization({
        family: "simulation",
        name: "sim_one",
        healedSpec: { description: "Generated sim" },
        persistedSpec: { name: "sim_one", family: "simulation", scenario_type: "simulation" },
        generateScenarioSource: vi.fn(() => "module.exports = { scenario: {} }"),
        validateGeneratedScenario: vi.fn(async () => ({ valid: true, errors: [] })) as any,
      }),
    ).resolves.toMatchObject({
      generatedSource: true,
      errors: [],
    });

    await expect(
      planCodegenFamilyMaterialization({
        family: "simulation",
        name: "sim_two",
        healedSpec: { description: "Broken sim" },
        persistedSpec: { name: "sim_two", family: "simulation", scenario_type: "simulation" },
        generateScenarioSource: vi.fn(() => "module.exports = { scenario: {} }"),
        validateGeneratedScenario: vi.fn(async () => ({ valid: false, errors: ["missing method"] })) as any,
      }),
    ).resolves.toMatchObject({
      generatedSource: false,
      errors: ["codegen validation: missing method"],
    });
  });
});
