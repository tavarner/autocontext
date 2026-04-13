import type { MaterializeScenarioDependencies } from "./materialize-dependencies.js";
import type { MaterializeOpts } from "./materialize-contracts.js";
import { planMaterializeScenarioRequest } from "./materialize-request-planning.js";
import type { MaterializeRequestPlanningResult } from "./materialize-request-planning.js";
import { planMaterializeWorkflowRequest } from "./materialize-workflow-request-planning.js";

export interface MaterializeWorkflowPlanningOutcome {
  dependencies: MaterializeScenarioDependencies;
  request: MaterializeRequestPlanningResult;
}

export function buildMaterializeWorkflowPlanningOutcome(opts: {
  materializeOpts: MaterializeOpts;
  dependencies: MaterializeScenarioDependencies;
  planMaterializeScenarioRequest: typeof planMaterializeScenarioRequest;
}): MaterializeWorkflowPlanningOutcome {
  return {
    dependencies: opts.dependencies,
    request: planMaterializeWorkflowRequest({
      materializeOpts: opts.materializeOpts,
      dependencies: opts.dependencies,
      planMaterializeScenarioRequest: opts.planMaterializeScenarioRequest,
    }),
  };
}
