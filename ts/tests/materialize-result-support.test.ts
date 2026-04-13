import { describe, expect, it } from "vitest";

import {
  buildMaterializeFailureResult,
  buildSuccessfulMaterializeResult,
  buildUnsupportedGameMaterializeResult,
  coerceMaterializeFamily,
} from "../src/scenarios/materialize-result-support.js";

describe("materialize result support", () => {
  it("coerces unsupported families to agent_task while preserving supported ones", () => {
    expect(coerceMaterializeFamily("simulation")).toBe("simulation");
    expect(coerceMaterializeFamily("unknown_family")).toBe("agent_task");
  });

  it("builds the unsupported game failure result with the preserved error contract", () => {
    expect(
      buildUnsupportedGameMaterializeResult({
        scenarioDir: "/tmp/knowledge/_custom_scenarios/custom_board_game",
        family: "game",
        name: "custom_board_game",
      }),
    ).toEqual({
      persisted: false,
      generatedSource: false,
      scenarioDir: "/tmp/knowledge/_custom_scenarios/custom_board_game",
      family: "game",
      name: "custom_board_game",
      errors: [
        "custom scenario materialization does not support family 'game'; use a built-in game scenario instead",
      ],
    });
  });

  it("builds generic failure and success materialize results", () => {
    expect(
      buildMaterializeFailureResult({
        scenarioDir: "/tmp/knowledge/_custom_scenarios/bad_task",
        family: "agent_task",
        name: "bad_task",
        errors: ["agent_task spec validation: task_prompt must not be empty"],
      }),
    ).toMatchObject({
      persisted: false,
      generatedSource: false,
      family: "agent_task",
    });

    expect(
      buildSuccessfulMaterializeResult({
        generatedSource: true,
        scenarioDir: "/tmp/knowledge/_custom_scenarios/gen_sim",
        family: "simulation",
        name: "gen_sim",
      }),
    ).toEqual({
      persisted: true,
      generatedSource: true,
      scenarioDir: "/tmp/knowledge/_custom_scenarios/gen_sim",
      family: "simulation",
      name: "gen_sim",
      errors: [],
    });
  });
});
