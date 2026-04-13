import { describe, expect, it } from "vitest";

import {
  buildCreatedScenarioResultLines,
  buildMaterializedScenarioResultLines,
} from "../src/cli/new-scenario-result-line-builders.js";

describe("new-scenario result line builders", () => {
  it("builds imported materialized scenario lines", () => {
    expect(
      buildMaterializedScenarioResultLines({
        parsed: {
          name: "checkout_rca",
          family: "investigation",
          spec: {
            taskPrompt: "Investigate a conversion drop",
            rubric: "Find the likely cause",
            description: "Root cause analysis",
          },
        },
        scenarioDir: "/tmp/checkout_rca",
        generatedSource: true,
      }),
    ).toEqual([
      "Materialized scenario: checkout_rca (family: investigation)",
      "  Directory: /tmp/checkout_rca",
      "  Generated: scenario.js",
    ]);
  });

  it("builds created materialized scenario lines", () => {
    expect(
      buildCreatedScenarioResultLines({
        created: {
          name: "fresh_task",
          family: "agent_task",
          spec: {
            taskPrompt: "Summarize the incident report.",
            rubric: "Clarity and factual accuracy",
            description: "Evaluate incident summaries",
          },
        },
        scenarioDir: "/tmp/fresh_task",
        generatedSource: true,
      }),
    ).toEqual([
      "Materialized scenario: fresh_task (family: agent_task)",
      "  Directory: /tmp/fresh_task",
      "  Task prompt: Summarize the incident report.",
      "  Rubric: Clarity and factual accuracy",
      "  Generated: scenario.js",
    ]);
  });
});
