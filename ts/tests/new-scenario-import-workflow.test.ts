import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { ensureMaterializedScenario } from "../src/cli/new-scenario-materialization-execution.js";
import { normalizeImportedScenarioSpec } from "../src/cli/new-scenario-normalization-workflow.js";

describe("new-scenario import workflow cleanup", () => {
  it("exports import/materialization helpers directly from the command workflow", () => {
    const cliDir = join(import.meta.dirname, "..", "src", "cli");
    const source = readFileSync(join(cliDir, "new-scenario-command-workflow.ts"), "utf-8");

    expect(source).not.toContain("./new-scenario-import-workflow.js");
    expect(source).toContain('from "./new-scenario-guards.js"');
    expect(source).toContain('from "./new-scenario-normalization-workflow.js"');
    expect(source).toContain('from "./new-scenario-created-materialization.js"');
    expect(source).toContain('from "./new-scenario-imported-materialization-public-helper.js"');
    expect(existsSync(join(cliDir, "new-scenario-import-workflow.ts"))).toBe(false);
    expect(existsSync(join(cliDir, "new-scenario-materialization-coordinator.ts"))).toBe(false);
    expect(existsSync(join(cliDir, "new-scenario-materialization-workflow.ts"))).toBe(false);
  });

  it("normalizes imported specs and preserves agent-task fallback semantics", () => {
    expect(
      normalizeImportedScenarioSpec({
        spec: {
          name: "fresh_saved_task",
          family: "workflow",
          taskPrompt: "Summarize the incident report.",
          rubric: "Clarity and factual accuracy",
          description: "Evaluate incident summaries",
        },
        detectScenarioFamily: () => "workflow",
        isScenarioFamilyName: (value: string) => ["agent_task", "workflow"].includes(value),
        validFamilies: ["agent_task", "workflow"],
      }),
    ).toMatchObject({
      name: "fresh_saved_task",
      family: "agent_task",
    });
  });

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
});
