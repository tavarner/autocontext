import { generateScenarioSource, hasCodegen } from "./codegen/index.js";
import { validateGeneratedScenario } from "./codegen/execution-validator.js";
import { getScenarioTypeMarker } from "./families.js";
import { healSpec } from "./spec-auto-heal.js";
import { persistMaterializedScenarioArtifacts } from "./materialize-artifact-persistence.js";
import { planMaterializedScenarioFamily } from "./materialize-family-planning.js";
import {
  buildMaterializeFailureResult,
  buildSuccessfulMaterializeResult,
  buildUnsupportedGameMaterializeResult,
  coerceMaterializeFamily,
} from "./materialize-result-support.js";

export interface MaterializeScenarioDependencies {
  coerceMaterializeFamily: typeof coerceMaterializeFamily;
  healSpec: typeof healSpec;
  getScenarioTypeMarker: typeof getScenarioTypeMarker;
  hasCodegen: typeof hasCodegen;
  generateScenarioSource: typeof generateScenarioSource;
  validateGeneratedScenario: typeof validateGeneratedScenario;
  planMaterializedScenarioFamily: typeof planMaterializedScenarioFamily;
  persistMaterializedScenarioArtifacts: typeof persistMaterializedScenarioArtifacts;
  buildUnsupportedGameMaterializeResult: typeof buildUnsupportedGameMaterializeResult;
  buildMaterializeFailureResult: typeof buildMaterializeFailureResult;
  buildSuccessfulMaterializeResult: typeof buildSuccessfulMaterializeResult;
}

export const DEFAULT_MATERIALIZE_SCENARIO_DEPENDENCIES: MaterializeScenarioDependencies = {
  coerceMaterializeFamily,
  healSpec,
  getScenarioTypeMarker,
  hasCodegen,
  generateScenarioSource,
  validateGeneratedScenario,
  planMaterializedScenarioFamily,
  persistMaterializedScenarioArtifacts,
  buildUnsupportedGameMaterializeResult,
  buildMaterializeFailureResult,
  buildSuccessfulMaterializeResult,
};

export function resolveMaterializeScenarioDependencies(
  overrides: Partial<MaterializeScenarioDependencies> = {},
): MaterializeScenarioDependencies {
  return {
    ...DEFAULT_MATERIALIZE_SCENARIO_DEPENDENCIES,
    ...overrides,
  };
}
