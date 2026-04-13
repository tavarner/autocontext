import { describe, expect, it, vi } from "vitest";

import { composeMaterializeWorkflowRequest } from "../src/scenarios/materialize-workflow-request-composition.js";

describe("materialize workflow request composition", () => {
  it("composes dependency resolution with workflow request planning", () => {
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
      composeMaterializeWorkflowRequest({
        materializeOpts: {
          name: "test_sim",
          family: "simulation",
          spec: { taskPrompt: "Run sim" },
          knowledgeRoot: "/tmp/knowledge",
        },
        resolveMaterializeScenarioDependencies: resolveMaterializeScenarioDependencies as any,
        planMaterializeScenarioRequest: planMaterializeScenarioRequest as any,
      }),
    ).toEqual({
      dependencies,
      request: {
        family: "simulation",
        healedSpec: { taskPrompt: "Run sim" },
        scenarioDir: "/tmp/knowledge/_custom_scenarios/test_sim",
        scenarioType: "simulation",
      },
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
