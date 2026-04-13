import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { executeMaterializeScenarioWithDefaults } from "../src/scenarios/materialize-scenario-default-wiring.js";

describe("materialize scenario default wiring", () => {
  it("wires defaults directly instead of routing through a dependency-bundle wrapper", () => {
    const scenariosDir = join(import.meta.dirname, "..", "src", "scenarios");
    const source = readFileSync(
      join(scenariosDir, "materialize-scenario-default-wiring.ts"),
      "utf-8",
    );

    expect(source).not.toContain("materialize-scenario-default-dependencies");
    expect(existsSync(join(scenariosDir, "materialize-scenario-default-dependencies.ts"))).toBe(
      false,
    );
  });

  it("wires the public materializeScenario entrypoint to the coordinator with default dependencies", async () => {
    const executeMaterializeScenarioCoordinator = vi.fn(async () => ({
      persisted: true,
      generatedSource: true,
      scenarioDir: "/tmp/knowledge/_custom_scenarios/test_sim",
      family: "simulation",
      name: "test_sim",
      errors: [],
    }));

    await expect(
      executeMaterializeScenarioWithDefaults({
        materializeOpts: {
          name: "test_sim",
          family: "simulation",
          spec: { taskPrompt: "Run sim" },
          knowledgeRoot: "/tmp/knowledge",
        },
        executeMaterializeScenarioCoordinator: executeMaterializeScenarioCoordinator as any,
      }),
    ).resolves.toEqual({
      persisted: true,
      generatedSource: true,
      scenarioDir: "/tmp/knowledge/_custom_scenarios/test_sim",
      family: "simulation",
      name: "test_sim",
      errors: [],
    });

    expect(executeMaterializeScenarioCoordinator).toHaveBeenCalledWith({
      opts: {
        name: "test_sim",
        family: "simulation",
        spec: { taskPrompt: "Run sim" },
        knowledgeRoot: "/tmp/knowledge",
      },
      resolveMaterializeScenarioDependencies: expect.any(Function),
      planMaterializeScenarioRequest: expect.any(Function),
      executeMaterializeScenarioWorkflow: expect.any(Function),
    });
  });
});
