import { generateScenarioSource, hasCodegen } from "./codegen/index.js";
import { validateGeneratedScenario } from "./codegen/execution-validator.js";
import type { AgentTaskSpec } from "./agent-task-spec.js";
import type { ScenarioFamilyName } from "./families.js";

export const AGENT_TASK_FAMILY = "agent_task";

export interface MaterializeFamilyPlanningRequest {
  family: ScenarioFamilyName;
  name: string;
  healedSpec: Record<string, unknown>;
  scenarioType: string;
}

export interface MaterializeFamilyPlanningDependencies {
  hasCodegen: typeof hasCodegen;
  generateScenarioSource: typeof generateScenarioSource;
  validateGeneratedScenario: typeof validateGeneratedScenario;
}

export interface MaterializeFamilyPlanningResult {
  persistedSpec: Record<string, unknown>;
  agentTaskSpec: AgentTaskSpec | null;
  source: string | null;
  generatedSource: boolean;
  errors: string[];
}

export function buildUnsupportedFamilyPlanningResult(opts: {
  persistedSpec: Record<string, unknown>;
  family: string;
}): MaterializeFamilyPlanningResult {
  return {
    persistedSpec: opts.persistedSpec,
    agentTaskSpec: null,
    source: null,
    generatedSource: false,
    errors: [`custom scenario materialization is not supported for family '${opts.family}'`],
  };
}
