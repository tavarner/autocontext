import { describe, expect, it, vi } from "vitest";

import { buildMaterializeScenarioExecutionDelegationResult } from "../src/scenarios/materialize-scenario-execution-delegation-result.js";

describe("materialize scenario execution delegation result", () => {
  it("builds execution delegation input from an assembled request and executor", () => {
    const request = {
      name: "test_sim",
      family: "simulation",
      healedSpec: { taskPrompt: "Run sim" },
      scenarioDir: "/tmp/knowledge/_custom_scenarios/test_sim",
      scenarioType: "simulation",
      dependencies: {
        coerceMaterializeFamily: vi.fn((family: string) => family as any),
      },
    };
    const executeMaterializeScenarioWorkflow = vi.fn(async () => ({
      persisted: true,
      generatedSource: true,
      scenarioDir: "/tmp/knowledge/_custom_scenarios/test_sim",
      family: "simulation",
      name: "test_sim",
      errors: [],
    }));

    expect(
      buildMaterializeScenarioExecutionDelegationResult({
        request: request as any,
        executeMaterializeScenarioWorkflow: executeMaterializeScenarioWorkflow as any,
      }),
    ).toEqual({
      request,
      executeMaterializeScenarioWorkflow,
    });
  });
});
