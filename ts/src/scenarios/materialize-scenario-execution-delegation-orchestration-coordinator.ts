import type { MaterializeScenarioDependencies } from "./materialize-dependencies.js";
import { executeMaterializeScenarioWorkflow } from "./materialize-execution-workflow.js";
import type { MaterializeOpts } from "./materialize-contracts.js";
import { planMaterializeScenarioRequest } from "./materialize-request-planning.js";
import type { MaterializeScenarioExecutionDelegationInput } from "./materialize-scenario-execution-delegation-result.js";
import { finalizeMaterializeScenarioExecutionDelegationInput } from "./materialize-scenario-execution-delegation-finalization-coordinator.js";

export function orchestrateMaterializeScenarioExecutionDelegationInput(deps: {
  opts: MaterializeOpts;
  resolveMaterializeScenarioDependencies: (
    overrides?: Partial<MaterializeScenarioDependencies>,
  ) => MaterializeScenarioDependencies;
  planMaterializeScenarioRequest: typeof planMaterializeScenarioRequest;
  executeMaterializeScenarioWorkflow: typeof executeMaterializeScenarioWorkflow;
}): MaterializeScenarioExecutionDelegationInput {
  return finalizeMaterializeScenarioExecutionDelegationInput({
    opts: deps.opts,
    resolveMaterializeScenarioDependencies: deps.resolveMaterializeScenarioDependencies,
    planMaterializeScenarioRequest: deps.planMaterializeScenarioRequest,
    executeMaterializeScenarioWorkflow: deps.executeMaterializeScenarioWorkflow,
  });
}
