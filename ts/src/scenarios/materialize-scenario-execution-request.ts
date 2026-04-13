import type { MaterializeScenarioDependencies } from "./materialize-dependencies.js";
import type { MaterializeOpts } from "./materialize-contracts.js";
import { planMaterializeScenarioRequest } from "./materialize-request-planning.js";
import { assembleMaterializeScenarioRequest } from "./materialize-scenario-request-assembly.js";
import type { MaterializeScenarioWorkflowRequest } from "./materialize-workflow-request-result.js";

export function buildMaterializeScenarioExecutionRequest(deps: {
  opts: MaterializeOpts;
  resolveMaterializeScenarioDependencies: (
    overrides?: Partial<MaterializeScenarioDependencies>,
  ) => MaterializeScenarioDependencies;
  planMaterializeScenarioRequest: typeof planMaterializeScenarioRequest;
}): MaterializeScenarioWorkflowRequest {
  return assembleMaterializeScenarioRequest({
    opts: deps.opts,
    resolveMaterializeScenarioDependencies: deps.resolveMaterializeScenarioDependencies,
    planMaterializeScenarioRequest: deps.planMaterializeScenarioRequest,
  });
}
