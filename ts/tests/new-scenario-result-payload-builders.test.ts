import { describe, expect, it } from "vitest";

import {
  buildCreatedScenarioResultPayload,
  buildMaterializedScenarioResultPayload,
} from "../src/cli/new-scenario-result-payload-builders.js";

describe("new-scenario result payload builders", () => {
  it("builds imported scenario result payloads", () => {
    expect(
      buildMaterializedScenarioResultPayload({
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
      }),
    ).toEqual({
      name: "checkout_rca",
      family: "investigation",
      spec: {
        taskPrompt: "Investigate a conversion drop",
        rubric: "Find the likely cause",
        description: "Root cause analysis",
      },
      scenarioDir: "/tmp/checkout_rca",
      generatedSource: true,
      persisted: true,
    });
  });

  it("builds created scenario result payloads", () => {
    expect(
      buildCreatedScenarioResultPayload({
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
          generatedSource: false,
          persisted: true,
        },
      }),
    ).toEqual({
      name: "fresh_task",
      family: "agent_task",
      spec: {
        taskPrompt: "Summarize the incident report.",
        rubric: "Clarity and factual accuracy",
        description: "Evaluate incident summaries",
      },
      scenarioDir: "/tmp/fresh_task",
      generatedSource: false,
      persisted: true,
    });
  });
});
