import { describe, expect, it, vi } from "vitest";

import { prepareCreatedScenarioMaterialization } from "../src/cli/new-scenario-created-materialization-preparation.js";

describe("new-scenario created materialization preparation", () => {
  it("prepares created materialization requests with created scenario data", () => {
    const materializeScenario = vi.fn();
    const created = {
      name: "fresh_task",
      family: "agent_task",
      spec: {
        taskPrompt: "Summarize the incident report.",
        rubric: "Clarity and factual accuracy",
        description: "Evaluate incident summaries",
      },
    };

    expect(
      prepareCreatedScenarioMaterialization({
        created,
        materializeScenario: materializeScenario as any,
        knowledgeRoot: "/tmp/knowledge",
        json: false,
      }),
    ).toEqual({
      created,
      materializeScenario,
      knowledgeRoot: "/tmp/knowledge",
      json: false,
    });
  });
});
