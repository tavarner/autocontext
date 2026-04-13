import type { MaterializeOpts, MaterializeResult } from "./materialize-contracts.js";
import { resolveMaterializeScenarioDependencies } from "./materialize-dependencies.js";
import { executeMaterializeScenarioWorkflow } from "./materialize-execution-workflow.js";
import { planMaterializeScenarioRequest } from "./materialize-request-planning.js";
import { executeMaterializeScenarioCoordinator } from "./materialize-scenario-coordinator.js";

export function executeMaterializeScenarioWithDefaults(opts: {
  materializeOpts: MaterializeOpts;
  executeMaterializeScenarioCoordinator: typeof executeMaterializeScenarioCoordinator;
}): Promise<MaterializeResult> {
  return opts.executeMaterializeScenarioCoordinator({
    opts: opts.materializeOpts,
    resolveMaterializeScenarioDependencies,
    planMaterializeScenarioRequest,
    executeMaterializeScenarioWorkflow,
  });
}

export function materializeScenario(opts: MaterializeOpts): Promise<MaterializeResult> {
  return executeMaterializeScenarioWithDefaults({
    materializeOpts: opts,
    executeMaterializeScenarioCoordinator,
  });
}
