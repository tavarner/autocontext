import { describe, expect, it } from "vitest";

import type {
  MaterializeOpts,
  MaterializeResult,
} from "../src/scenarios/materialize-contracts.js";

describe("materialize contracts", () => {
  it("defines the public materialize request and result shapes", () => {
    const request: MaterializeOpts = {
      name: "task_one",
      family: "agent_task",
      spec: { taskPrompt: "Write a poem" },
      knowledgeRoot: "/tmp/knowledge",
    };

    const result: MaterializeResult = {
      persisted: true,
      generatedSource: false,
      scenarioDir: "/tmp/knowledge/_custom_scenarios/task_one",
      family: "agent_task",
      name: "task_one",
      errors: [],
    };

    expect(request.knowledgeRoot).toBe("/tmp/knowledge");
    expect(result.persisted).toBe(true);
    expect(result.scenarioDir).toContain("task_one");
  });
});
