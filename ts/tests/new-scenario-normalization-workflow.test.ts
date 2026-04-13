import { describe, expect, it } from "vitest";

import { normalizeImportedScenarioSpec } from "../src/cli/new-scenario-normalization-workflow.js";

describe("new-scenario normalization workflow", () => {
  it("normalizes imported specs through parsed fields, family resolution, and final assembly", () => {
    expect(
      normalizeImportedScenarioSpec({
        spec: {
          name: "checkout_rca",
          taskPrompt: "Investigate a conversion drop",
          rubric: "Find the likely cause",
          description: "Root cause analysis",
        },
        detectScenarioFamily: () => "investigation",
        isScenarioFamilyName: (value: string) => value === "investigation",
        validFamilies: ["agent_task", "investigation"],
      }),
    ).toEqual({
      name: "checkout_rca",
      family: "investigation",
      spec: {
        taskPrompt: "Investigate a conversion drop",
        rubric: "Find the likely cause",
        description: "Root cause analysis",
      },
    });
  });
});
