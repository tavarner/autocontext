import { describe, expect, it } from "vitest";

import {
  serializeCreatedScenarioResultOutput,
  serializeMaterializedScenarioResultOutput,
} from "../src/cli/new-scenario-result-output-serialization.js";

describe("new-scenario result output serialization", () => {
  it("serializes materialized imported scenario results for json and text", () => {
    const parsed = {
      name: "checkout_rca",
      family: "investigation",
      spec: {
        taskPrompt: "Investigate a conversion drop",
        rubric: "Find the likely cause",
        description: "Root cause analysis",
      },
    };
    const materialized = {
      scenarioDir: "/tmp/checkout_rca",
      generatedSource: true,
      persisted: true,
    };

    expect(
      serializeMaterializedScenarioResultOutput({
        parsed,
        materialized,
        json: false,
      }),
    ).toBe(
      [
        "Materialized scenario: checkout_rca (family: investigation)",
        "  Directory: /tmp/checkout_rca",
        "  Generated: scenario.js",
      ].join("\n"),
    );

    expect(
      serializeMaterializedScenarioResultOutput({
        parsed,
        materialized,
        json: true,
      }),
    ).toBe(
      JSON.stringify(
        {
          ...parsed,
          scenarioDir: "/tmp/checkout_rca",
          generatedSource: true,
          persisted: true,
        },
        null,
        2,
      ),
    );
  });

  it("serializes created scenario results for json and text", () => {
    const created = {
      name: "fresh_task",
      family: "agent_task",
      spec: {
        taskPrompt: "Summarize the incident report.",
        rubric: "Clarity and factual accuracy",
        description: "Evaluate incident summaries",
      },
    };
    const materialized = {
      scenarioDir: "/tmp/fresh_task",
      generatedSource: true,
      persisted: true,
    };

    expect(
      serializeCreatedScenarioResultOutput({
        created,
        materialized,
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

    expect(
      serializeCreatedScenarioResultOutput({
        created,
        materialized,
        json: true,
      }),
    ).toBe(
      JSON.stringify(
        {
          ...created,
          scenarioDir: "/tmp/fresh_task",
          generatedSource: true,
          persisted: true,
        },
        null,
        2,
      ),
    );
  });
});
