import type { MaterializeScenarioDependencies } from "./materialize-dependencies.js";
import type { MaterializeRequestPlanningResult } from "./materialize-request-planning.js";
import type { ScenarioFamilyName } from "./families.js";

export interface MaterializeScenarioWorkflowRequest {
  name: string;
  family: ScenarioFamilyName;
  healedSpec: Record<string, unknown>;
  scenarioDir: string;
  scenarioType: string;
  dependencies: MaterializeScenarioDependencies;
}

export function buildMaterializeWorkflowRequestResult(opts: {
  name: string;
  request: MaterializeRequestPlanningResult;
  dependencies: MaterializeScenarioDependencies;
}): MaterializeScenarioWorkflowRequest {
  return {
    name: opts.name,
    family: opts.request.family,
    healedSpec: opts.request.healedSpec,
    scenarioDir: opts.request.scenarioDir,
    scenarioType: opts.request.scenarioType,
    dependencies: opts.dependencies,
  };
}
