import { describe, expect, it, vi } from "vitest";

import { buildMaterializeWorkflowRequestResult } from "../src/scenarios/materialize-workflow-request-result.js";

describe("materialize workflow request result", () => {
  it("builds workflow request results from the planned request and resolved dependencies", () => {
    const dependencies = {
      coerceMaterializeFamily: vi.fn((family: string) => family as any),
      healSpec: vi.fn((spec: Record<string, unknown>) => spec),
      getScenarioTypeMarker: vi.fn(() => "simulation"),
    };

    expect(
      buildMaterializeWorkflowRequestResult({
        name: "test_sim",
        request: {
          family: "simulation" as any,
          healedSpec: { taskPrompt: "Run sim" },
          scenarioDir: "/tmp/knowledge/_custom_scenarios/test_sim",
          scenarioType: "simulation",
        },
        dependencies: dependencies as any,
      }),
    ).toEqual({
      name: "test_sim",
      family: "simulation",
      healedSpec: { taskPrompt: "Run sim" },
      scenarioDir: "/tmp/knowledge/_custom_scenarios/test_sim",
      scenarioType: "simulation",
      dependencies,
    });
  });
});
