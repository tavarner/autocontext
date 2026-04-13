import { describe, expect, it } from "vitest";

import { buildNormalizedImportedScenario } from "../src/cli/new-scenario-import-spec-assembly.js";

describe("new-scenario import spec assembly", () => {
  it("builds normalized imported scenarios from resolved family fields", () => {
    expect(
      buildNormalizedImportedScenario({
        name: "checkout_rca",
        family: "investigation",
        specFields: {
          evidence: ["metrics", "logs"],
        },
        taskPrompt: "Investigate a conversion drop",
        rubric: "Find the likely cause",
        description: "Root cause analysis",
      }),
    ).toEqual({
      name: "checkout_rca",
      family: "investigation",
      spec: {
        evidence: ["metrics", "logs"],
        taskPrompt: "Investigate a conversion drop",
        rubric: "Find the likely cause",
        description: "Root cause analysis",
      },
    });
  });
});
