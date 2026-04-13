import { describe, expect, it } from "vitest";

import { parseImportedScenarioCoreFields } from "../src/cli/new-scenario-import-field-parsing.js";

describe("new-scenario import field parsing", () => {
  it("parses and trims required imported scenario fields", () => {
    expect(
      parseImportedScenarioCoreFields({
        name: " fresh_saved_task ",
        taskPrompt: " Summarize the incident report. ",
        rubric: " Clarity and factual accuracy ",
        description: "Evaluate incident summaries",
      }),
    ).toEqual({
      name: "fresh_saved_task",
      taskPrompt: "Summarize the incident report.",
      rubric: "Clarity and factual accuracy",
      description: "Evaluate incident summaries",
    });
  });

  it("preserves the required-field error contract", () => {
    expect(() =>
      parseImportedScenarioCoreFields({
        name: "oops",
        taskPrompt: "",
        rubric: "",
      }),
    ).toThrow("Error: spec must contain name, taskPrompt, and rubric fields");
  });
});
