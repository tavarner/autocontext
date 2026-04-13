import {
  AGENT_TASK_FAMILY,
  buildUnsupportedFamilyPlanningResult,
  type MaterializeFamilyPlanningDependencies,
  type MaterializeFamilyPlanningRequest,
  type MaterializeFamilyPlanningResult,
} from "./materialize-family-planning-contracts.js";
import { buildBaseMaterializedPersistedSpec } from "./materialize-base-persisted-spec.js";
import {
  planAgentTaskFamilyMaterialization,
  planCodegenFamilyMaterialization,
} from "./materialize-family-planning-helpers.js";

export type {
  MaterializeFamilyPlanningDependencies,
  MaterializeFamilyPlanningRequest,
  MaterializeFamilyPlanningResult,
} from "./materialize-family-planning-contracts.js";

export async function planMaterializedScenarioFamily(
  opts: MaterializeFamilyPlanningRequest,
  dependencies: MaterializeFamilyPlanningDependencies,
): Promise<MaterializeFamilyPlanningResult> {
  const persistedSpec = buildBaseMaterializedPersistedSpec({
    name: opts.name,
    family: opts.family,
    scenarioType: opts.scenarioType,
    healedSpec: opts.healedSpec,
  });

  if (opts.family === AGENT_TASK_FAMILY) {
    return planAgentTaskFamilyMaterialization({
      healedSpec: opts.healedSpec,
      persistedSpec,
    });
  }

  if (dependencies.hasCodegen(opts.family)) {
    return planCodegenFamilyMaterialization({
      family: opts.family,
      name: opts.name,
      healedSpec: opts.healedSpec,
      persistedSpec,
      generateScenarioSource: dependencies.generateScenarioSource,
      validateGeneratedScenario: dependencies.validateGeneratedScenario,
    });
  }

  return buildUnsupportedFamilyPlanningResult({
    persistedSpec,
    family: opts.family,
  });
}
