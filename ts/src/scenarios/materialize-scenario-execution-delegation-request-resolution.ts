import type { MaterializeScenarioDependencies } from "./materialize-dependencies.js";
import type { MaterializeOpts } from "./materialize-contracts.js";
import { planMaterializeScenarioRequest } from "./materialize-request-planning.js";
import { buildMaterializeScenarioExecutionRequest } from "./materialize-scenario-execution-request.js";
import type { MaterializeScenarioWorkflowRequest } from "./materialize-workflow-request-result.js";

export function resolveMaterializeScenarioExecutionDelegationRequest(deps: {
  opts: MaterializeOpts;
  resolveMaterializeScenarioDependencies: (
    overrides?: Partial<MaterializeScenarioDependencies>,
  ) => MaterializeScenarioDependencies;
  planMaterializeScenarioRequest: typeof planMaterializeScenarioRequest;
}): MaterializeScenarioWorkflowRequest {
  return buildMaterializeScenarioExecutionRequest({
    opts: deps.opts,
    resolveMaterializeScenarioDependencies: deps.resolveMaterializeScenarioDependencies,
    planMaterializeScenarioRequest: deps.planMaterializeScenarioRequest,
  });
}
