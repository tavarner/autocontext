import { describe, expect, it } from "vitest";

import {
  ensureMaterializedScenario,
  ensureNewScenarioDescription,
} from "../src/cli/new-scenario-guards.js";

describe("new-scenario guards", () => {
  it("requires a description when the calling mode demands one", () => {
    expect(() =>
      ensureNewScenarioDescription({
        description: undefined,
        errorMessage: "Error: --description is required with --prompt-only",
      }),
    ).toThrow("Error: --description is required with --prompt-only");

    expect(
      ensureNewScenarioDescription({
        description: "Draft a scenario",
        errorMessage: "unused",
      }),
    ).toBe("Draft a scenario");
  });

  it("surfaces persisted-materialization failures through shared error shaping", () => {
    expect(() =>
      ensureMaterializedScenario({
        persisted: false,
        errors: [
          "custom scenario materialization does not support family 'game'; use a built-in game scenario instead",
        ],
      }),
    ).toThrow(
      "Error: custom scenario materialization does not support family 'game'; use a built-in game scenario instead",
    );
  });
});
