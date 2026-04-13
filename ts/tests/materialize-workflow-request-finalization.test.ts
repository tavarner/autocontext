import { describe, expect, it, vi } from "vitest";

import { finalizeMaterializeWorkflowRequest } from "../src/scenarios/materialize-workflow-request-finalization.js";

describe("materialize workflow request finalization", () => {
  it("finalizes the workflow request from the composed request bundle and scenario name", () => {
    const dependencies = {
      coerceMaterializeFamily: vi.fn((family: string) => family as any),
      healSpec: vi.fn((spec: Record<string, unknown>) => spec),
      getScenarioTypeMarker: vi.fn(() => "simulation"),
    };

    expect(
      finalizeMaterializeWorkflowRequest({
        name: "test_sim",
        composedRequest: {
          dependencies: dependencies as any,
          request: {
            family: "simulation" as any,
            healedSpec: { taskPrompt: "Run sim" },
            scenarioDir: "/tmp/knowledge/_custom_scenarios/test_sim",
            scenarioType: "simulation",
          },
        },
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
