import { describe, expect, it, vi } from "vitest";

import { executeMaterializeScenarioWorkflow } from "../src/scenarios/materialize-execution-workflow.js";
import type { MaterializeScenarioDependencies } from "../src/scenarios/materialize-dependencies.js";

function createDependencies(): MaterializeScenarioDependencies {
  return {
    coerceMaterializeFamily: vi.fn((family: string) => family as any),
    healSpec: vi.fn((spec: Record<string, unknown>) => spec),
    getScenarioTypeMarker: vi.fn(() => "agent_task" as any),
    hasCodegen: vi.fn(() => false),
    generateScenarioSource: vi.fn(() => "module.exports = {}"),
    validateGeneratedScenario: vi.fn(
      async () => ({ valid: true, errors: [], durationMs: 1, executedMethods: [] }) as any,
    ) as any,
    planMaterializedScenarioFamily: vi.fn(async () => ({
      persistedSpec: { taskPrompt: "Do" },
      agentTaskSpec: null,
      source: null,
      generatedSource: false,
      errors: [],
    })),
    persistMaterializedScenarioArtifacts: vi.fn(),
    buildUnsupportedGameMaterializeResult: vi.fn((opts) => ({
      persisted: false,
      generatedSource: false,
      scenarioDir: opts.scenarioDir,
      family: opts.family,
      name: opts.name,
      errors: ["game unsupported"],
    })),
    buildMaterializeFailureResult: vi.fn((opts) => ({
      persisted: false,
      generatedSource: false,
      scenarioDir: opts.scenarioDir,
      family: opts.family,
      name: opts.name,
      errors: opts.errors,
    })),
    buildSuccessfulMaterializeResult: vi.fn((opts) => ({
      persisted: true,
      generatedSource: opts.generatedSource,
      scenarioDir: opts.scenarioDir,
      family: opts.family,
      name: opts.name,
      errors: [],
    })),
  };
}

describe("materialize execution workflow", () => {
  it("routes game families to the unsupported result builder", async () => {
    const dependencies = createDependencies();

    await expect(
      executeMaterializeScenarioWorkflow({
        name: "custom_board_game",
        family: "game",
        healedSpec: {},
        scenarioDir: "/tmp/knowledge/_custom_scenarios/custom_board_game",
        scenarioType: "game",
        dependencies,
      }),
    ).resolves.toMatchObject({
      persisted: false,
      family: "game",
      errors: ["game unsupported"],
    });

    expect(dependencies.planMaterializedScenarioFamily).not.toHaveBeenCalled();
    expect(dependencies.persistMaterializedScenarioArtifacts).not.toHaveBeenCalled();
  });

  it("returns failure results when family planning reports errors", async () => {
    const dependencies = createDependencies();
    vi.mocked(dependencies.planMaterializedScenarioFamily).mockResolvedValueOnce({
      persistedSpec: { description: "Broken" },
      agentTaskSpec: null,
      source: null,
      generatedSource: false,
      errors: ["validation failed"],
    });

    await expect(
      executeMaterializeScenarioWorkflow({
        name: "broken_sim",
        family: "simulation",
        healedSpec: { description: "Broken" },
        scenarioDir: "/tmp/knowledge/_custom_scenarios/broken_sim",
        scenarioType: "simulation",
        dependencies,
      }),
    ).resolves.toMatchObject({
      persisted: false,
      family: "simulation",
      errors: ["validation failed"],
    });

    expect(dependencies.buildMaterializeFailureResult).toHaveBeenCalledWith({
      scenarioDir: "/tmp/knowledge/_custom_scenarios/broken_sim",
      family: "simulation",
      name: "broken_sim",
      errors: ["validation failed"],
    });
    expect(dependencies.persistMaterializedScenarioArtifacts).not.toHaveBeenCalled();
  });

  it("persists artifacts and returns success when planning succeeds", async () => {
    const dependencies = createDependencies();
    vi.mocked(dependencies.planMaterializedScenarioFamily).mockResolvedValueOnce({
      persistedSpec: { taskPrompt: "Do" },
      agentTaskSpec: null,
      source: "module.exports = {}",
      generatedSource: true,
      errors: [],
    });

    await expect(
      executeMaterializeScenarioWorkflow({
        name: "gen_sim",
        family: "simulation",
        healedSpec: { description: "Generated sim" },
        scenarioDir: "/tmp/knowledge/_custom_scenarios/gen_sim",
        scenarioType: "simulation",
        dependencies,
      }),
    ).resolves.toMatchObject({
      persisted: true,
      generatedSource: true,
      family: "simulation",
      name: "gen_sim",
      errors: [],
    });

    expect(dependencies.persistMaterializedScenarioArtifacts).toHaveBeenCalledWith({
      scenarioDir: "/tmp/knowledge/_custom_scenarios/gen_sim",
      scenarioType: "simulation",
      persistedSpec: { taskPrompt: "Do" },
      family: "simulation",
      agentTaskFamily: "agent_task",
      agentTaskSpec: null,
      source: "module.exports = {}",
    });
    expect(dependencies.buildSuccessfulMaterializeResult).toHaveBeenCalledWith({
      generatedSource: true,
      scenarioDir: "/tmp/knowledge/_custom_scenarios/gen_sim",
      family: "simulation",
      name: "gen_sim",
    });
  });
});
