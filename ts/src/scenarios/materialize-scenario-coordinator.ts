import type { MaterializeScenarioDependencies } from "./materialize-dependencies.js";
import { executeMaterializeScenarioWorkflow } from "./materialize-execution-workflow.js";
import type { MaterializeOpts, MaterializeResult } from "./materialize-contracts.js";
import { planMaterializeScenarioRequest } from "./materialize-request-planning.js";
import { executeMaterializeScenarioRequestHandoff } from "./materialize-scenario-request-handoff-delegation.js";

export async function executeMaterializeScenarioCoordinator(deps: {
  opts: MaterializeOpts;
  resolveMaterializeScenarioDependencies: (
    overrides?: Partial<MaterializeScenarioDependencies>,
  ) => MaterializeScenarioDependencies;
  planMaterializeScenarioRequest: typeof planMaterializeScenarioRequest;
  executeMaterializeScenarioWorkflow: typeof executeMaterializeScenarioWorkflow;
}): Promise<MaterializeResult> {
  return executeMaterializeScenarioRequestHandoff({
    opts: deps.opts,
    resolveMaterializeScenarioDependencies: deps.resolveMaterializeScenarioDependencies,
    planMaterializeScenarioRequest: deps.planMaterializeScenarioRequest,
    executeMaterializeScenarioWorkflow: deps.executeMaterializeScenarioWorkflow,
  });
}
