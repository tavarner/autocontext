import { describe, expect, it } from "vitest";

import {
  buildAgentTaskValidationErrors,
  buildInvalidAgentTaskMaterializationResult,
  buildSuccessfulAgentTaskMaterializationResult,
} from "../src/scenarios/materialize-agent-task-results.js";

describe("materialize agent-task results", () => {
  it("formats agent-task validation errors", () => {
    expect(buildAgentTaskValidationErrors(["Required", "Too short"])).toEqual([
      "agent_task spec validation: Required",
      "agent_task spec validation: Too short",
    ]);
  });

  it("builds invalid and successful agent-task materialization results", () => {
    const persistedSpec = {
      name: "task_one",
      family: "agent_task",
      scenario_type: "agent_task",
      description: "Poetry task",
    };

    expect(
      buildInvalidAgentTaskMaterializationResult({
        persistedSpec,
        messages: ["Required"],
      }),
    ).toMatchObject({
      persistedSpec,
      agentTaskSpec: null,
      source: null,
      generatedSource: false,
      errors: ["agent_task spec validation: Required"],
    });

    expect(
      buildSuccessfulAgentTaskMaterializationResult({
        persistedSpec,
        agentTaskSpec: {
          taskPrompt: "Write a poem",
          judgeRubric: "Judge creativity",
          outputFormat: "free_text",
          judgeModel: "",
          difficultyTiers: null,
          referenceContext: null,
          referenceSources: null,
          requiredConcepts: null,
          calibrationExamples: null,
          contextPreparation: null,
          requiredContextKeys: null,
          maxRounds: 1,
          qualityThreshold: 0.9,
          revisionPrompt: null,
          sampleInput: null,
        },
      }),
    ).toMatchObject({
      persistedSpec: {
        ...persistedSpec,
        taskPrompt: "Write a poem",
        judgeRubric: "Judge creativity",
        rubric: "Judge creativity",
      },
      agentTaskSpec: {
        taskPrompt: "Write a poem",
        judgeRubric: "Judge creativity",
      },
      source: null,
      generatedSource: false,
      errors: [],
    });
  });
});
