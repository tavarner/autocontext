import { describe, expect, it } from "vitest";

import type {
  AgentTaskFamilyMaterializationRequest,
  CodegenFamilyMaterializationRequest,
} from "../src/scenarios/materialize-family-planning-helper-contracts.js";

describe("materialize family planning helper contracts", () => {
  it("defines the public helper request shapes", async () => {
    const agentTaskRequest: AgentTaskFamilyMaterializationRequest = {
      healedSpec: { taskPrompt: "Write a poem" },
      persistedSpec: { name: "task_one", family: "agent_task" },
    };

    const codegenRequest: CodegenFamilyMaterializationRequest = {
      family: "simulation",
      name: "sim_one",
      healedSpec: { description: "Generated sim" },
      persistedSpec: { name: "sim_one", family: "simulation" },
      generateScenarioSource: () => "module.exports = { scenario: {} }",
      validateGeneratedScenario: async () => ({ valid: true, errors: [] }),
    };

    expect(agentTaskRequest.persistedSpec.name).toBe("task_one");
    expect(codegenRequest.family).toBe("simulation");
    await expect(
      codegenRequest.validateGeneratedScenario("module.exports = {}", "simulation", "sim_one"),
    ).resolves.toEqual({ valid: true, errors: [] });
  });
});
