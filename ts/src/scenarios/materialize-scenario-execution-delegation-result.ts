import { executeMaterializeScenarioWorkflow } from "./materialize-execution-workflow.js";
import type { MaterializeScenarioWorkflowRequest } from "./materialize-workflow-request-result.js";

export interface MaterializeScenarioExecutionDelegationInput {
  request: MaterializeScenarioWorkflowRequest;
  executeMaterializeScenarioWorkflow: typeof executeMaterializeScenarioWorkflow;
}

export function buildMaterializeScenarioExecutionDelegationResult(opts: {
  request: MaterializeScenarioWorkflowRequest;
  executeMaterializeScenarioWorkflow: typeof executeMaterializeScenarioWorkflow;
}): MaterializeScenarioExecutionDelegationInput {
  return {
    request: opts.request,
    executeMaterializeScenarioWorkflow: opts.executeMaterializeScenarioWorkflow,
  };
}
