import { describe, expect, it } from "vitest";

import {
  renderCreatedScenarioResult,
  renderMaterializedScenarioResult,
} from "../src/cli/new-scenario-result-rendering-entrypoints.js";

describe("new-scenario result rendering entrypoints", () => {
  it("renders materialized imported scenario results", () => {
    expect(
      renderMaterializedScenarioResult({
        parsed: {
          name: "checkout_rca",
          family: "investigation",
          spec: {
            taskPrompt: "Investigate a conversion drop",
            rubric: "Find the likely cause",
            description: "Root cause analysis",
          },
        },
        materialized: {
          scenarioDir: "/tmp/checkout_rca",
          generatedSource: true,
          persisted: true,
        },
        json: false,
      }),
    ).toBe(
      [
        "Materialized scenario: checkout_rca (family: investigation)",
        "  Directory: /tmp/checkout_rca",
        "  Generated: scenario.js",
      ].join("\n"),
    );
  });

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
