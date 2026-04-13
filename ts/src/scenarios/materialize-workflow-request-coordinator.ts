import type { MaterializeScenarioDependencies } from "./materialize-dependencies.js";
import type { MaterializeOpts } from "./materialize-contracts.js";
import { planMaterializeScenarioRequest } from "./materialize-request-planning.js";
import { composeMaterializeWorkflowRequest } from "./materialize-workflow-request-composition.js";
import { finalizeMaterializeWorkflowRequest } from "./materialize-workflow-request-finalization.js";
import type { MaterializeScenarioWorkflowRequest } from "./materialize-workflow-request-result.js";

export function assembleMaterializeScenarioWorkflowRequest(deps: {
  opts: MaterializeOpts;
  resolveMaterializeScenarioDependencies: (
    overrides?: Partial<MaterializeScenarioDependencies>,
  ) => MaterializeScenarioDependencies;
  planMaterializeScenarioRequest: typeof planMaterializeScenarioRequest;
}): MaterializeScenarioWorkflowRequest {
  return finalizeMaterializeWorkflowRequest({
    name: deps.opts.name,
    composedRequest: composeMaterializeWorkflowRequest({
      materializeOpts: deps.opts,
      resolveMaterializeScenarioDependencies: deps.resolveMaterializeScenarioDependencies,
      planMaterializeScenarioRequest: deps.planMaterializeScenarioRequest,
    }),
  });
}
