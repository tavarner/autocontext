import { describe, expect, it, vi } from "vitest";

import { prepareImportedScenarioMaterialization } from "../src/cli/new-scenario-imported-materialization-preparation.js";

describe("new-scenario imported materialization preparation", () => {
  it("prepares imported materialization requests with normalized scenario data", () => {
    const materializeScenario = vi.fn();

    expect(
      prepareImportedScenarioMaterialization({
        spec: {
          name: "checkout_rca",
          taskPrompt: "Investigate a conversion drop",
          rubric: "Find the likely cause",
          description: "Root cause analysis",
        },
        detectScenarioFamily: () => "investigation",
        isScenarioFamilyName: (value: string) => value === "investigation",
        validFamilies: ["agent_task", "investigation"],
        materializeScenario: materializeScenario as any,
        knowledgeRoot: "/tmp/knowledge",
        json: false,
      }),
    ).toEqual({
      parsed: {
        name: "checkout_rca",
        family: "investigation",
        spec: {
          taskPrompt: "Investigate a conversion drop",
          rubric: "Find the likely cause",
          description: "Root cause analysis",
        },
      },
      materializeScenario,
      knowledgeRoot: "/tmp/knowledge",
      json: false,
    });
  });
});
