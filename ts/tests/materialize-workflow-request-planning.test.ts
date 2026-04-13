import { describe, expect, it, vi } from "vitest";

import { planMaterializeWorkflowRequest } from "../src/scenarios/materialize-workflow-request-planning.js";

describe("materialize workflow request planning", () => {
  it("plans the workflow request from materialize options and resolved dependencies", () => {
    const dependencies = {
      coerceMaterializeFamily: vi.fn((family: string) => family as any),
      healSpec: vi.fn((spec: Record<string, unknown>) => spec),
      getScenarioTypeMarker: vi.fn(() => "simulation"),
    };
    const planMaterializeScenarioRequest = vi.fn(() => ({
      family: "simulation",
      healedSpec: { taskPrompt: "Run sim" },
      scenarioDir: "/tmp/knowledge/_custom_scenarios/test_sim",
      scenarioType: "simulation",
    }));

    expect(
      planMaterializeWorkflowRequest({
        materializeOpts: {
          name: "test_sim",
          family: "simulation",
          spec: { taskPrompt: "Run sim" },
          knowledgeRoot: "/tmp/knowledge",
        },
        dependencies: dependencies as any,
        planMaterializeScenarioRequest: planMaterializeScenarioRequest as any,
      }),
    ).toEqual({
      family: "simulation",
      healedSpec: { taskPrompt: "Run sim" },
      scenarioDir: "/tmp/knowledge/_custom_scenarios/test_sim",
      scenarioType: "simulation",
    });

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
