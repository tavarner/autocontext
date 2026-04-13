import type { MaterializeScenarioDependencies } from "./materialize-dependencies.js";
import type { MaterializeOpts } from "./materialize-contracts.js";
import { buildMaterializeRequestPlanningInput } from "./materialize-request-planning-input.js";
import {
  planMaterializeScenarioRequest,
  type MaterializeRequestPlanningResult,
} from "./materialize-request-planning.js";

export function planMaterializeWorkflowRequest(opts: {
  materializeOpts: MaterializeOpts;
  dependencies: MaterializeScenarioDependencies;
  planMaterializeScenarioRequest: typeof planMaterializeScenarioRequest;
}): MaterializeRequestPlanningResult {
  return opts.planMaterializeScenarioRequest(
    buildMaterializeRequestPlanningInput({
      materializeOpts: opts.materializeOpts,
      dependencies: opts.dependencies,
    }),
  );
}
