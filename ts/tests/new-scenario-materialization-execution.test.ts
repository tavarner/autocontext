import { describe, expect, it, vi } from "vitest";

import {
  ensureMaterializedScenario,
  executeCreatedScenarioMaterializationResult,
  executeImportedScenarioMaterializationResult,
} from "../src/cli/new-scenario-materialization-execution.js";

describe("new-scenario materialization execution", () => {
  it("surfaces persisted-materialization failures through shared error shaping", () => {
    expect(() =>
      ensureMaterializedScenario({
        persisted: false,
        errors: [
          "custom scenario materialization does not support family 'game'; use a built-in game scenario instead",
        ],
      }),
    ).toThrow(
      "Error: custom scenario materialization does not support family 'game'; use a built-in game scenario instead",
    );
  });

  it("executes imported and created scenario materialization flows", async () => {
    const materializeScenario = vi.fn(async ({ name, family }: { name: string; family: string }) => ({
      scenarioDir: `/tmp/${name}`,
      generatedSource: family !== "agent_task",
      persisted: true,
      errors: [],
    }));

    await expect(
      executeImportedScenarioMaterializationResult({
        parsed: {
          name: "fresh_saved_task",
          family: "agent_task",
          spec: {
            taskPrompt: "Summarize the incident report.",
            rubric: "Clarity and factual accuracy",
            description: "Evaluate incident summaries",
          },
        },
        materializeScenario: materializeScenario as any,
        knowledgeRoot: "/tmp/knowledge",
        json: false,
      }),
    ).resolves.toContain("Materialized scenario: fresh_saved_task");

    await expect(
      executeCreatedScenarioMaterializationResult({
        created: {
          name: "generated_sim",
          family: "simulation",
          spec: {
            taskPrompt: "Run a simulation",
            rubric: "Evaluate correctness",
            description: "Generated simulation",
          },
        },
        materializeScenario: materializeScenario as any,
        knowledgeRoot: "/tmp/knowledge",
        json: false,
      }),
    ).resolves.toContain("Generated: scenario.js");
  });
});
