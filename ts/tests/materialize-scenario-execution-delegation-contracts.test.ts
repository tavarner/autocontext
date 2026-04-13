import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, expectTypeOf, it } from "vitest";

import { executeMaterializeScenarioWorkflow } from "../src/scenarios/materialize-execution-workflow.js";
import type { MaterializeScenarioExecutionDelegationInput } from "../src/scenarios/materialize-scenario-execution-delegation-result.js";
import type { MaterializeScenarioWorkflowRequest } from "../src/scenarios/materialize-workflow-request-result.js";

describe("materialize scenario execution delegation contracts", () => {
  it("defines the shared execution delegation input contract on the substantive result owner", () => {
    expectTypeOf<MaterializeScenarioExecutionDelegationInput>().toMatchTypeOf<{
      request: MaterializeScenarioWorkflowRequest;
      executeMaterializeScenarioWorkflow: typeof executeMaterializeScenarioWorkflow;
    }>();

    expect(
      existsSync(
        join(
          import.meta.dirname,
          "..",
          "src",
          "scenarios",
          "materialize-scenario-execution-delegation-contracts.ts",
        ),
      ),
    ).toBe(false);
  });
});
