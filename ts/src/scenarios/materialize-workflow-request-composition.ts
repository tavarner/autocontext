import type { MaterializeScenarioDependencies } from "./materialize-dependencies.js";
import type { MaterializeOpts } from "./materialize-contracts.js";
import { planMaterializeScenarioRequest } from "./materialize-request-planning.js";
import { buildMaterializeWorkflowPlanningOutcome } from "./materialize-workflow-planning-outcome.js";
import type { MaterializeWorkflowPlanningOutcome } from "./materialize-workflow-planning-outcome.js";

export function composeMaterializeWorkflowRequest(opts: {
  materializeOpts: MaterializeOpts;
  resolveMaterializeScenarioDependencies: (
    overrides?: Partial<MaterializeScenarioDependencies>,
  ) => MaterializeScenarioDependencies;
  planMaterializeScenarioRequest: typeof planMaterializeScenarioRequest;
}): MaterializeWorkflowPlanningOutcome {
  return buildMaterializeWorkflowPlanningOutcome({
    materializeOpts: opts.materializeOpts,
    dependencies: opts.resolveMaterializeScenarioDependencies(),
    planMaterializeScenarioRequest: opts.planMaterializeScenarioRequest,
  });
}
