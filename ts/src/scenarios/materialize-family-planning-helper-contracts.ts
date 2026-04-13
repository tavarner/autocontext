import type { ScenarioFamilyName } from "./families.js";

export interface AgentTaskFamilyMaterializationRequest {
  healedSpec: Record<string, unknown>;
  persistedSpec: Record<string, unknown>;
}

export interface CodegenFamilyMaterializationRequest {
  family: string;
  name: string;
  healedSpec: Record<string, unknown>;
  persistedSpec: Record<string, unknown>;
  generateScenarioSource: (
    family: ScenarioFamilyName,
    spec: Record<string, unknown>,
    name: string,
  ) => string;
  validateGeneratedScenario: (
    source: string,
    family: string,
    name: string,
  ) => Promise<{ valid: boolean; errors: string[] }>;
}
