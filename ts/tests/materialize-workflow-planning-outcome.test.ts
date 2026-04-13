import { describe, expect, it, vi } from "vitest";

import { buildMaterializeWorkflowPlanningOutcome } from "../src/scenarios/materialize-workflow-planning-outcome.js";

describe("materialize workflow planning outcome", () => {
  it("builds the workflow request planning outcome from resolved dependencies", () => {
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
      buildMaterializeWorkflowPlanningOutcome({
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
      dependencies,
      request: {
        family: "simulation",
        healedSpec: { taskPrompt: "Run sim" },
        scenarioDir: "/tmp/knowledge/_custom_scenarios/test_sim",
        scenarioType: "simulation",
      },
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
