import { describe, expect, it, vi } from "vitest";

import { assembleMaterializeScenarioWorkflowRequest } from "../src/scenarios/materialize-workflow-request-coordinator.js";

describe("materialize workflow request coordinator", () => {
  it("coordinates dependency resolution, request planning, and workflow-request construction", () => {
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

    expect(
      assembleMaterializeScenarioWorkflowRequest({
        opts: {
          name: "test_sim",
          family: "simulation",
          spec: { taskPrompt: "Run sim" },
          knowledgeRoot: "/tmp/knowledge",
        },
        resolveMaterializeScenarioDependencies: resolveMaterializeScenarioDependencies as any,
        planMaterializeScenarioRequest: planMaterializeScenarioRequest as any,
      }),
    ).toEqual({
      name: "test_sim",
      family: "simulation",
      healedSpec: { taskPrompt: "Run sim" },
      scenarioDir: "/tmp/knowledge/_custom_scenarios/test_sim",
      scenarioType: "simulation",
      dependencies,
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
  });
});
