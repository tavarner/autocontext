import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, expectTypeOf, it } from "vitest";

import type { MaterializeScenarioDependencies } from "../src/scenarios/materialize-dependencies.js";
import type { MaterializeRequestPlanningResult } from "../src/scenarios/materialize-request-planning.js";
import type { MaterializeWorkflowPlanningOutcome } from "../src/scenarios/materialize-workflow-planning-outcome.js";

describe("materialize workflow planning outcome contracts", () => {
  it("defines the shared planning outcome contract on the planning outcome owner", () => {
    expectTypeOf<MaterializeWorkflowPlanningOutcome>().toMatchTypeOf<{
      dependencies: MaterializeScenarioDependencies;
      request: MaterializeRequestPlanningResult;
    }>();

    expect(
      existsSync(
        join(
          import.meta.dirname,
          "..",
          "src",
          "scenarios",
          "materialize-workflow-planning-outcome-contracts.ts",
        ),
      ),
    ).toBe(false);
  });
});
