import { describe, expect, it, vi } from "vitest";

import { executeMaterializeScenarioRequestHandoff } from "../src/scenarios/materialize-scenario-request-handoff-delegation.js";

describe("materialize scenario request handoff delegation", () => {
  it("prepares the execution delegation input and hands off workflow execution", async () => {
    const dependencies = {
      coerceMaterializeFamily: vi.fn((family: string) => family as any),
      healSpec: vi.fn((spec: Record<string, unknown>) => spec),
      getScenarioTypeMarker: vi.fn(() => "simulation"),
    };
    const resolveMaterializeScenarioDependencies = vi.fn(() => dependencies as any);
    const planMaterializeScenarioRequest = vi.fn(() => ({
      family: "simulation",
      healedSpec: { taskPrompt: "Run sim" },
      scenarioDir: "/tmp/knowledge/_custom_scenarios/test_sim",
      scenarioType: "simulation",
    }));
    const executeMaterializeScenarioWorkflow = vi.fn(async () => ({
      persisted: true,
      generatedSource: true,
      scenarioDir: "/tmp/knowledge/_custom_scenarios/test_sim",
      family: "simulation",
      name: "test_sim",
      errors: [],
    }));

    await expect(
      executeMaterializeScenarioRequestHandoff({
        opts: {
          name: "test_sim",
          family: "simulation",
          spec: { taskPrompt: "Run sim" },
          knowledgeRoot: "/tmp/knowledge",
        },
        resolveMaterializeScenarioDependencies: resolveMaterializeScenarioDependencies as any,
        planMaterializeScenarioRequest: planMaterializeScenarioRequest as any,
        executeMaterializeScenarioWorkflow: executeMaterializeScenarioWorkflow as any,
      }),
    ).resolves.toEqual({
      persisted: true,
      generatedSource: true,
      scenarioDir: "/tmp/knowledge/_custom_scenarios/test_sim",
      family: "simulation",
      name: "test_sim",
      errors: [],
    });

    expect(resolveMaterializeScenarioDependencies).toHaveBeenCalledWith();
    expect(planMaterializeScenarioRequest).toHaveBeenCalledWith({
      family: "simulation",
      name: "test_sim",
      spec: { taskPrompt: "Run sim" },
      knowledgeRoot: "/tmp/knowledge",
      coerceMaterializeFamily: dependencies.coerceMaterializeFamily,
      healSpec: dependencies.healSpec,
      getScenarioTypeMarker: dependencies.getScenarioTypeMarker,
    });
    expect(executeMaterializeScenarioWorkflow).toHaveBeenCalledWith({
      name: "test_sim",
      family: "simulation",
      healedSpec: { taskPrompt: "Run sim" },
      scenarioDir: "/tmp/knowledge/_custom_scenarios/test_sim",
      scenarioType: "simulation",
      dependencies,
    });
  });
});
