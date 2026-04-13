import { describe, expect, it, vi } from "vitest";

import { executeCodegenMaterializationPlan } from "../src/scenarios/materialize-codegen-execution.js";

describe("materialize codegen execution", () => {
  const persistedSpec = {
    name: "sim_one",
    family: "simulation",
    scenario_type: "simulation",
  };

  it("builds successful and invalid codegen materialization results from execution", async () => {
    await expect(
      executeCodegenMaterializationPlan({
        family: "simulation",
        name: "sim_one",
        healedSpec: { description: "Generated sim" },
        persistedSpec,
        generateScenarioSource: vi.fn(() => "module.exports = { scenario: {} }"),
        validateGeneratedScenario: vi.fn(async () => ({ valid: true, errors: [] })) as any,
      }),
    ).resolves.toMatchObject({
      persistedSpec,
      source: "module.exports = { scenario: {} }",
      generatedSource: true,
      errors: [],
    });

    await expect(
      executeCodegenMaterializationPlan({
        family: "simulation",
        name: "sim_two",
        healedSpec: { description: "Broken sim" },
        persistedSpec,
        generateScenarioSource: vi.fn(() => "module.exports = { scenario: {} }"),
        validateGeneratedScenario: vi.fn(async () => ({ valid: false, errors: ["missing method"] })) as any,
      }),
    ).resolves.toMatchObject({
      persistedSpec,
      source: "module.exports = { scenario: {} }",
      generatedSource: false,
      errors: ["codegen validation: missing method"],
    });
  });

  it("builds failure results when code generation throws", async () => {
    await expect(
      executeCodegenMaterializationPlan({
        family: "simulation",
        name: "sim_fail",
        healedSpec: { description: "Broken sim" },
        persistedSpec,
        generateScenarioSource: vi.fn(() => {
          throw new Error("boom");
        }),
        validateGeneratedScenario: vi.fn() as any,
      }),
    ).resolves.toMatchObject({
      persistedSpec,
      source: null,
      generatedSource: false,
      errors: ["codegen failed: boom"],
    });
  });
});
