import type { MaterializeWorkflowPlanningOutcome } from "./materialize-workflow-planning-outcome.js";
import type { MaterializeScenarioWorkflowRequest } from "./materialize-workflow-request-result.js";
import { buildMaterializeWorkflowRequestResult } from "./materialize-workflow-request-result.js";

export function finalizeMaterializeWorkflowRequest(opts: {
  name: string;
  composedRequest: MaterializeWorkflowPlanningOutcome;
}): MaterializeScenarioWorkflowRequest {
  return buildMaterializeWorkflowRequestResult({
    name: opts.name,
    request: opts.composedRequest.request,
    dependencies: opts.composedRequest.dependencies,
  });
}
