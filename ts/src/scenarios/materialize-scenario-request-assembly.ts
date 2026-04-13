import type { MaterializeScenarioDependencies } from "./materialize-dependencies.js";
import type { MaterializeOpts } from "./materialize-contracts.js";
import { planMaterializeScenarioRequest } from "./materialize-request-planning.js";
import { assembleMaterializeScenarioWorkflowRequest } from "./materialize-workflow-request-coordinator.js";
import type { MaterializeScenarioWorkflowRequest } from "./materialize-workflow-request-result.js";

export function assembleMaterializeScenarioRequest(deps: {
  opts: MaterializeOpts;
  resolveMaterializeScenarioDependencies: (
    overrides?: Partial<MaterializeScenarioDependencies>,
  ) => MaterializeScenarioDependencies;
  planMaterializeScenarioRequest: typeof planMaterializeScenarioRequest;
}): MaterializeScenarioWorkflowRequest {
  return assembleMaterializeScenarioWorkflowRequest({
    opts: deps.opts,
    resolveMaterializeScenarioDependencies: deps.resolveMaterializeScenarioDependencies,
    planMaterializeScenarioRequest: deps.planMaterializeScenarioRequest,
  });
}
