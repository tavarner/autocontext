import type { MaterializeScenarioDependencies } from "./materialize-dependencies.js";
import { executeMaterializeScenarioWorkflow } from "./materialize-execution-workflow.js";
import type { MaterializeOpts, MaterializeResult } from "./materialize-contracts.js";
import { planMaterializeScenarioRequest } from "./materialize-request-planning.js";
import { buildMaterializeScenarioExecutionDelegationInput } from "./materialize-scenario-execution-delegation-input-coordinator.js";

export function executeMaterializeScenarioRequestHandoff(deps: {
  opts: MaterializeOpts;
  resolveMaterializeScenarioDependencies: (
    overrides?: Partial<MaterializeScenarioDependencies>,
  ) => MaterializeScenarioDependencies;
  planMaterializeScenarioRequest: typeof planMaterializeScenarioRequest;
  executeMaterializeScenarioWorkflow: typeof executeMaterializeScenarioWorkflow;
}): Promise<MaterializeResult> {
  const delegationInput = buildMaterializeScenarioExecutionDelegationInput({
    opts: deps.opts,
    resolveMaterializeScenarioDependencies: deps.resolveMaterializeScenarioDependencies,
    planMaterializeScenarioRequest: deps.planMaterializeScenarioRequest,
    executeMaterializeScenarioWorkflow: deps.executeMaterializeScenarioWorkflow,
  });

  return delegationInput.executeMaterializeScenarioWorkflow(delegationInput.request);
}
