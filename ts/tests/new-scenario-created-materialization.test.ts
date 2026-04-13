import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { executeCreatedScenarioMaterialization } from "../src/cli/new-scenario-created-materialization.js";

describe("new-scenario created materialization", () => {
  it("routes prepared materialization directly instead of through an extra execution wrapper", () => {
    const cliDir = join(import.meta.dirname, "..", "src", "cli");
    const source = readFileSync(join(cliDir, "new-scenario-created-materialization.ts"), "utf-8");

    expect(source).not.toContain("new-scenario-created-materialization-execution");
    expect(existsSync(join(cliDir, "new-scenario-created-materialization-execution.ts"))).toBe(
      false,
    );
  });

  it("materializes a created scenario and renders the created result", async () => {
    const materializeScenario = vi.fn(async () => ({
      scenarioDir: "/tmp/fresh_task",
      generatedSource: true,
      persisted: true,
      errors: [],
    }));

    await expect(
      executeCreatedScenarioMaterialization({
        created: {
          name: "fresh_task",
          family: "agent_task",
          spec: {
            taskPrompt: "Summarize the incident report.",
            rubric: "Clarity and factual accuracy",
            description: "Evaluate incident summaries",
          },
        },
        materializeScenario,
        knowledgeRoot: "/tmp/knowledge",
        json: false,
      }),
    ).resolves.toBe(
      [
        "Materialized scenario: fresh_task (family: agent_task)",
        "  Directory: /tmp/fresh_task",
        "  Task prompt: Summarize the incident report.",
        "  Rubric: Clarity and factual accuracy",
        "  Generated: scenario.js",
      ].join("\n"),
    );

    expect(materializeScenario).toHaveBeenCalledWith({
      name: "fresh_task",
      family: "agent_task",
      spec: {
        taskPrompt: "Summarize the incident report.",
        rubric: "Clarity and factual accuracy",
        description: "Evaluate incident summaries",
      },
      knowledgeRoot: "/tmp/knowledge",
    });
  });
});
