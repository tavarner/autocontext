import { AgentTaskSpecSchema } from "./agent-task-spec.js";
import { buildAgentTaskMaterializeInput } from "./materialize-agent-task-planning.js";
import { executeCodegenMaterializationPlan } from "./materialize-codegen-execution.js";
import type {
  AgentTaskFamilyMaterializationRequest,
  CodegenFamilyMaterializationRequest,
} from "./materialize-family-planning-helper-contracts.js";
import {
  buildInvalidAgentTaskMaterializationResult,
  buildSuccessfulAgentTaskMaterializationResult,
} from "./materialize-agent-task-results.js";
import {
  AGENT_TASK_FAMILY,
  type MaterializeFamilyPlanningResult,
} from "./materialize-family-planning-contracts.js";

export {
  AGENT_TASK_FAMILY,
  type MaterializeFamilyPlanningResult,
} from "./materialize-family-planning-contracts.js";

export { buildBaseMaterializedPersistedSpec } from "./materialize-base-persisted-spec.js";

export type {
  AgentTaskFamilyMaterializationRequest,
  CodegenFamilyMaterializationRequest,
} from "./materialize-family-planning-helper-contracts.js";

export function planAgentTaskFamilyMaterialization(
  opts: AgentTaskFamilyMaterializationRequest,
): MaterializeFamilyPlanningResult {
  const validation = AgentTaskSpecSchema.safeParse(
    buildAgentTaskMaterializeInput(opts.healedSpec),
  );

  if (!validation.success) {
    return buildInvalidAgentTaskMaterializationResult({
      persistedSpec: opts.persistedSpec,
      messages: validation.error.issues.map((issue) => issue.message),
    });
  }

  return buildSuccessfulAgentTaskMaterializationResult({
    persistedSpec: opts.persistedSpec,
    agentTaskSpec: validation.data,
  });
}

export async function planCodegenFamilyMaterialization(
  opts: CodegenFamilyMaterializationRequest,
): Promise<MaterializeFamilyPlanningResult> {
  return executeCodegenMaterializationPlan({
    family: opts.family,
    name: opts.name,
    healedSpec: opts.healedSpec,
    persistedSpec: opts.persistedSpec,
    generateScenarioSource: opts.generateScenarioSource,
    validateGeneratedScenario: opts.validateGeneratedScenario,
  });
}
