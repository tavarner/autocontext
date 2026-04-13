import { describe, expect, it } from "vitest";

import {
  countImportedScenarioFamilySpecificFields,
  resolveImportedScenarioFamily,
} from "../src/cli/new-scenario-family-resolution.js";

describe("new-scenario family resolution", () => {
  it("counts family-specific imported fields excluding core prompt fields", () => {
    expect(
      countImportedScenarioFamilySpecificFields({
        taskPrompt: "Summarize the incident report.",
        rubric: "Clarity and factual accuracy",
        description: "Evaluate incident summaries",
        actions: [],
      }),
    ).toBe(1);
  });

  it("preserves agent-task fallback semantics and validates requested families", () => {
    expect(
      resolveImportedScenarioFamily({
        spec: {
          name: "fresh_saved_task",
          family: "workflow",
          taskPrompt: "Summarize the incident report.",
          rubric: "Clarity and factual accuracy",
          description: "Evaluate incident summaries",
        },
        description: "Evaluate incident summaries",
        taskPrompt: "Summarize the incident report.",
        detectScenarioFamily: () => "workflow",
        isScenarioFamilyName: (value: string) => ["agent_task", "workflow"].includes(value),
        validFamilies: ["agent_task", "workflow"],
      }),
    ).toMatchObject({
      family: "agent_task",
    });

    expect(
      resolveImportedScenarioFamily({
        spec: {
          name: "workflow_saved_task",
          family: "workflow",
          taskPrompt: "Summarize the incident report.",
          rubric: "Clarity and factual accuracy",
          description: "Evaluate incident summaries",
          steps: [],
        },
        description: "Evaluate incident summaries",
        taskPrompt: "Summarize the incident report.",
        detectScenarioFamily: () => "workflow",
        isScenarioFamilyName: (value: string) => ["agent_task", "workflow"].includes(value),
        validFamilies: ["agent_task", "workflow"],
      }),
    ).toMatchObject({
      family: "workflow",
    });

    expect(() =>
      resolveImportedScenarioFamily({
        spec: {
          name: "bad_family_task",
          family: "bogus",
          taskPrompt: "Summarize the incident report.",
          rubric: "Clarity and factual accuracy",
          description: "Evaluate incident summaries",
        },
        description: "Evaluate incident summaries",
        taskPrompt: "Summarize the incident report.",
        detectScenarioFamily: () => "workflow",
        isScenarioFamilyName: (value: string) => ["agent_task", "workflow"].includes(value),
        validFamilies: ["agent_task", "workflow"],
      }),
    ).toThrow("Error: family must be one of agent_task, workflow");
  });
});
