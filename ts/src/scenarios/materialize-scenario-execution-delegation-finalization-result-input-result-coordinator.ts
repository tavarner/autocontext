import type { MaterializeScenarioDependencies } from "./materialize-dependencies.js";
import { executeMaterializeScenarioWorkflow } from "./materialize-execution-workflow.js";
import type { MaterializeOpts } from "./materialize-contracts.js";
import { planMaterializeScenarioRequest } from "./materialize-request-planning.js";
import type { MaterializeScenarioExecutionDelegationInput } from "./materialize-scenario-execution-delegation-result.js";
import { buildMaterializeScenarioExecutionDelegationResult } from "./materialize-scenario-execution-delegation-result.js";
import { resolveMaterializeScenarioExecutionDelegationRequest } from "./materialize-scenario-execution-delegation-request-resolution.js";

export function buildMaterializeScenarioExecutionDelegationFinalizationResult(deps: {
  opts: MaterializeOpts;
  resolveMaterializeScenarioDependencies: (
    overrides?: Partial<MaterializeScenarioDependencies>,
  ) => MaterializeScenarioDependencies;
  planMaterializeScenarioRequest: typeof planMaterializeScenarioRequest;
  executeMaterializeScenarioWorkflow: typeof executeMaterializeScenarioWorkflow;
}): MaterializeScenarioExecutionDelegationInput {
  return buildMaterializeScenarioExecutionDelegationResult({
    request: resolveMaterializeScenarioExecutionDelegationRequest({
      opts: deps.opts,
      resolveMaterializeScenarioDependencies: deps.resolveMaterializeScenarioDependencies,
      planMaterializeScenarioRequest: deps.planMaterializeScenarioRequest,
    }),
    executeMaterializeScenarioWorkflow: deps.executeMaterializeScenarioWorkflow,
  });
}
