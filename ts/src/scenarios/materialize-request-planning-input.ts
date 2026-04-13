import type { MaterializeScenarioDependencies } from "./materialize-dependencies.js";
import type { MaterializeOpts } from "./materialize-contracts.js";
import type { planMaterializeScenarioRequest } from "./materialize-request-planning.js";

export function buildMaterializeRequestPlanningInput(opts: {
  materializeOpts: MaterializeOpts;
  dependencies: MaterializeScenarioDependencies;
}): Parameters<typeof planMaterializeScenarioRequest>[0] {
  return {
    family: opts.materializeOpts.family,
    name: opts.materializeOpts.name,
    spec: opts.materializeOpts.spec,
    knowledgeRoot: opts.materializeOpts.knowledgeRoot,
    coerceMaterializeFamily: opts.dependencies.coerceMaterializeFamily,
    healSpec: opts.dependencies.healSpec,
    getScenarioTypeMarker: opts.dependencies.getScenarioTypeMarker,
  };
}
