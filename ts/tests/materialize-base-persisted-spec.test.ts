import { describe, expect, it } from "vitest";

import { buildBaseMaterializedPersistedSpec } from "../src/scenarios/materialize-base-persisted-spec.js";

describe("materialize base persisted spec", () => {
  it("builds the base persisted spec payload", () => {
    expect(
      buildBaseMaterializedPersistedSpec({
        name: "task_one",
        family: "agent_task",
        scenarioType: "agent_task",
        healedSpec: { taskPrompt: "Write a poem" },
      }),
    ).toEqual({
      name: "task_one",
      family: "agent_task",
      scenario_type: "agent_task",
      taskPrompt: "Write a poem",
    });
  });
});
