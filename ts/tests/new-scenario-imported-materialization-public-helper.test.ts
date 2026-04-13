import { describe, expect, it, vi } from "vitest";

import { executeImportedScenarioMaterialization } from "../src/cli/new-scenario-imported-materialization-public-helper.js";

describe("new-scenario imported materialization public helper", () => {
  it("materializes an imported scenario through normalization and execution", async () => {
    const materializeScenario = vi.fn(async () => ({
      scenarioDir: "/tmp/checkout_rca",
      generatedSource: true,
      persisted: true,
      errors: [],
    }));

    await expect(
      executeImportedScenarioMaterialization({
        spec: {
          name: "checkout_rca",
          taskPrompt: "Investigate a conversion drop",
          rubric: "Find the likely cause",
          description: "Root cause analysis",
        },
        detectScenarioFamily: () => "investigation",
        isScenarioFamilyName: (value: string) => value === "investigation",
        validFamilies: ["agent_task", "investigation"],
        materializeScenario,
        knowledgeRoot: "/tmp/knowledge",
        json: false,
      }),
    ).resolves.toBe(
      [
        "Materialized scenario: checkout_rca (family: investigation)",
        "  Directory: /tmp/checkout_rca",
        "  Generated: scenario.js",
      ].join("\n"),
    );

    expect(materializeScenario).toHaveBeenCalledWith({
      name: "checkout_rca",
      family: "investigation",
      spec: {
        taskPrompt: "Investigate a conversion drop",
        rubric: "Find the likely cause",
        description: "Root cause analysis",
      },
      knowledgeRoot: "/tmp/knowledge",
    });
  });
});
