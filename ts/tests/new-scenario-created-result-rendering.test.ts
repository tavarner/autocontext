import { describe, expect, it } from "vitest";

import { renderCreatedScenarioResult } from "../src/cli/new-scenario-created-result-rendering.js";

describe("new-scenario created result rendering", () => {
  it("renders created scenario results", () => {
    expect(
      renderCreatedScenarioResult({
        created: {
          name: "fresh_task",
          family: "agent_task",
          spec: {
            taskPrompt: "Summarize the incident report.",
            rubric: "Clarity and factual accuracy",
            description: "Evaluate incident summaries",
          },
        },
        materialized: {
          scenarioDir: "/tmp/fresh_task",
          generatedSource: true,
          persisted: true,
        },
        json: false,
      }),
    ).toBe(
      [
        "Materialized scenario: fresh_task (family: agent_task)",
        "  Directory: /tmp/fresh_task",
        "  Task prompt: Summarize the incident report.",
        "  Rubric: Clarity and factual accuracy",
        "  Generated: scenario.js",
      ].join("\n"),
    );
  });
});
