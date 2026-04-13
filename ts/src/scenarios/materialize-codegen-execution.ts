import type { MaterializeFamilyPlanningResult } from "./materialize-family-planning-contracts.js";
import type { CodegenFamilyMaterializationRequest } from "./materialize-family-planning-helper-contracts.js";
import {
  buildCodegenFailureMaterializationResult,
  buildInvalidCodegenMaterializationResult,
  buildSuccessfulCodegenMaterializationResult,
} from "./materialize-codegen-planning.js";

export async function executeCodegenMaterializationPlan(
  opts: CodegenFamilyMaterializationRequest,
): Promise<MaterializeFamilyPlanningResult> {
  try {
    const source = opts.generateScenarioSource(
      opts.family,
      opts.healedSpec,
      opts.name,
    );
    const validation = await opts.validateGeneratedScenario(source, opts.family, opts.name);
    if (!validation.valid) {
      return buildInvalidCodegenMaterializationResult({
        persistedSpec: opts.persistedSpec,
        source,
        errors: validation.errors,
      });
    }

    return buildSuccessfulCodegenMaterializationResult({
      persistedSpec: opts.persistedSpec,
      source,
    });
  } catch (error) {
    return buildCodegenFailureMaterializationResult({
      persistedSpec: opts.persistedSpec,
      error,
    });
  }
}
