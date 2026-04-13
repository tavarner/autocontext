import { describe, expect, it, vi } from "vitest";

import { composeMaterializeScenarioExecutionDelegationFinalizationResult } from "../src/scenarios/materialize-scenario-execution-delegation-finalization-result-composition-coordinator.js";

describe("materialize scenario execution delegation finalization result composition coordinator", () => {
  it("coordinates request resolution with final delegation-result assembly", () => {
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

    expect(
      composeMaterializeScenarioExecutionDelegationFinalizationResult({
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
    ).toEqual({
      request: {
        name: "test_sim",
        family: "simulation",
        healedSpec: { taskPrompt: "Run sim" },
        scenarioDir: "/tmp/knowledge/_custom_scenarios/test_sim",
        scenarioType: "simulation",
        dependencies,
      },
      executeMaterializeScenarioWorkflow,
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
