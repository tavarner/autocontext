import { describe, expect, it, vi } from "vitest";

import { buildMaterializeRequestPlanningInput } from "../src/scenarios/materialize-request-planning-input.js";

describe("materialize request planning input", () => {
  it("builds planning input from materialize options and resolved dependencies", () => {
    const dependencies = {
      coerceMaterializeFamily: vi.fn((family: string) => family as any),
      healSpec: vi.fn((spec: Record<string, unknown>) => spec),
      getScenarioTypeMarker: vi.fn(() => "simulation"),
    };

    expect(
      buildMaterializeRequestPlanningInput({
        materializeOpts: {
          name: "test_sim",
          family: "simulation",
          spec: { taskPrompt: "Run sim" },
          knowledgeRoot: "/tmp/knowledge",
        },
        dependencies: dependencies as any,
      }),
    ).toEqual({
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
