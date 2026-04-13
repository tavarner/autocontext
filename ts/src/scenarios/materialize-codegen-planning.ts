import type { MaterializeFamilyPlanningResult } from "./materialize-family-planning-contracts.js";

function buildBaseCodegenMaterializationResult(opts: {
  persistedSpec: Record<string, unknown>;
  source: string | null;
  generatedSource: boolean;
  errors: string[];
}): MaterializeFamilyPlanningResult {
  return {
    persistedSpec: opts.persistedSpec,
    agentTaskSpec: null,
    source: opts.source,
    generatedSource: opts.generatedSource,
    errors: opts.errors,
  };
}

export function buildCodegenValidationErrors(errors: string[]): string[] {
  return errors.map((error) => `codegen validation: ${error}`);
}

export function buildInvalidCodegenMaterializationResult(opts: {
  persistedSpec: Record<string, unknown>;
  source: string;
  errors: string[];
}): MaterializeFamilyPlanningResult {
  return buildBaseCodegenMaterializationResult({
    persistedSpec: opts.persistedSpec,
    source: opts.source,
    generatedSource: false,
    errors: buildCodegenValidationErrors(opts.errors),
  });
}

export function buildSuccessfulCodegenMaterializationResult(opts: {
  persistedSpec: Record<string, unknown>;
  source: string;
}): MaterializeFamilyPlanningResult {
  return buildBaseCodegenMaterializationResult({
    persistedSpec: opts.persistedSpec,
    source: opts.source,
    generatedSource: true,
    errors: [],
  });
}

export function buildCodegenFailureMaterializationResult(opts: {
  persistedSpec: Record<string, unknown>;
  error: unknown;
}): MaterializeFamilyPlanningResult {
  return buildBaseCodegenMaterializationResult({
    persistedSpec: opts.persistedSpec,
    source: null,
    generatedSource: false,
    errors: [`codegen failed: ${opts.error instanceof Error ? opts.error.message : String(opts.error)}`],
  });
}
