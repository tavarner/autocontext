/**
 * Runtime interface contracts for all 11 scenario families (AC-380).
 * Mirrors the Python scenario family ABCs with TypeScript type guards.
 */

import type { AgentTaskInterface as BaseAgentTaskInterface } from "../types/index.js";
import type { ScenarioInterface as BaseGameScenarioInterface } from "./game-interface.js";
import type { ScenarioFamilyName as BaseScenarioFamilyName } from "./families.js";
import {
  isAgentTask as isRegisteredAgentTask,
  isGameScenario as isRegisteredGameScenario,
} from "./registry.js";

type MethodVariant = string | readonly string[];

function hasMethodVariants(obj: unknown, ...variants: MethodVariant[]): boolean {
  if (!obj || typeof obj !== "object") return false;
  const candidate = obj as Record<string, unknown>;
  return variants.every((variant) => {
    const names = Array.isArray(variant) ? variant : [variant];
    return names.some((name) => typeof candidate[name] === "function");
  });
}

function formatExpectedMethods(methods: readonly string[]): string {
  return methods.join(", ");
}

const GAME_METHODS = [
  "describeRules",
  "initialState",
  "step",
  "isTerminal",
  "getResult",
  "executeMatch",
] as const;

const AGENT_TASK_METHODS = [
  "getTaskPrompt",
  "evaluateOutput",
  "getRubric",
  "initialState",
  "describeTask",
] as const;

const SIMULATION_METHODS = [
  "describeScenario",
  "describeEnvironment",
  "initialState",
  "getAvailableActions",
  "executeAction",
  "isTerminal",
  "evaluateTrace",
  "getRubric",
] as const;

const NEGOTIATION_METHODS = [
  ...SIMULATION_METHODS,
  "getHiddenPreferences",
  "getRounds",
  "getOpponentModel",
  "updateOpponentModel",
  "evaluateNegotiation",
] as const;

const INVESTIGATION_METHODS = [
  ...SIMULATION_METHODS,
  "getEvidencePool",
  "evaluateEvidenceChain",
  "evaluateDiagnosis",
] as const;

const WORKFLOW_METHODS = [
  ...SIMULATION_METHODS,
  "getWorkflowSteps",
  "executeStep",
  "executeCompensation",
  "getSideEffects",
  "evaluateWorkflow",
] as const;

const SCHEMA_EVOLUTION_METHODS = [
  ...SIMULATION_METHODS,
  "getMutations",
  "getSchemaVersion",
  "getMutationLog",
  "applyMutation",
  "checkContextValidity",
  "evaluateAdaptation",
] as const;

const TOOL_FRAGILITY_METHODS = [
  ...SIMULATION_METHODS,
  "getToolContracts",
  "getDriftLog",
  "injectDrift",
  "attributeFailure",
  "evaluateFragility",
] as const;

const OPERATOR_LOOP_METHODS = [
  ...SIMULATION_METHODS,
  "getEscalationLog",
  "getClarificationLog",
  "escalate",
  "requestClarification",
  "evaluateJudgment",
] as const;

const COORDINATION_METHODS = [
  ...SIMULATION_METHODS,
  "getWorkerContexts",
  "getHandoffLog",
  "recordHandoff",
  "mergeOutputs",
  "evaluateCoordination",
] as const;

const ARTIFACT_EDITING_METHODS = [
  "describeTask",
  "getRubric",
  "initialArtifacts",
  "getEditPrompt",
  "validateArtifact",
  "evaluateEdits",
] as const;

const EXPECTED_METHODS: Record<ScenarioFamilyName, readonly string[]> = {
  game: GAME_METHODS,
  agent_task: AGENT_TASK_METHODS,
  simulation: SIMULATION_METHODS,
  negotiation: NEGOTIATION_METHODS,
  investigation: INVESTIGATION_METHODS,
  workflow: WORKFLOW_METHODS,
  schema_evolution: SCHEMA_EVOLUTION_METHODS,
  tool_fragility: TOOL_FRAGILITY_METHODS,
  operator_loop: OPERATOR_LOOP_METHODS,
  coordination: COORDINATION_METHODS,
  artifact_editing: ARTIFACT_EDITING_METHODS,
};

export type ScenarioFamilyName = BaseScenarioFamilyName;

// ---------------------------------------------------------------------------
// 1. Game (parametric) — ScenarioInterface
// ---------------------------------------------------------------------------

export type GameScenarioInterface = BaseGameScenarioInterface;

export function isGameScenario(obj: unknown): obj is GameScenarioInterface {
  return isRegisteredGameScenario(obj);
}

// ---------------------------------------------------------------------------
// 2. Agent Task
// ---------------------------------------------------------------------------

export type AgentTaskInterface = BaseAgentTaskInterface;

export function isAgentTask(obj: unknown): obj is AgentTaskInterface {
  return isRegisteredAgentTask(obj);
}

// ---------------------------------------------------------------------------
// 3. Simulation
// ---------------------------------------------------------------------------

export interface SimulationInterface {
  describeScenario(): string;
  describeEnvironment(): unknown;
  initialState(seed?: number): Record<string, unknown>;
  getAvailableActions(state: Record<string, unknown>): unknown[];
  executeAction(state: Record<string, unknown>, action: unknown): [unknown, Record<string, unknown>];
  isTerminal(state: Record<string, unknown>): boolean;
  evaluateTrace(trace: unknown, finalState: Record<string, unknown>): unknown;
  getRubric(): string;
}

export function isSimulation(obj: unknown): obj is SimulationInterface {
  return hasMethodVariants(
    obj,
    ["describeScenario", "describe_scenario"],
    ["describeEnvironment", "describe_environment"],
    ["initialState", "initial_state"],
    ["getAvailableActions", "get_available_actions"],
    ["executeAction", "execute_action"],
    ["isTerminal", "is_terminal"],
    ["evaluateTrace", "evaluate_trace"],
    ["getRubric", "get_rubric"],
  );
}

// ---------------------------------------------------------------------------
// 4. Negotiation
// ---------------------------------------------------------------------------

export interface NegotiationInterface extends SimulationInterface {
  getHiddenPreferences(state: Record<string, unknown>): unknown;
  getRounds(state: Record<string, unknown>): unknown[];
  getOpponentModel(state: Record<string, unknown>): unknown | null;
  updateOpponentModel(state: Record<string, unknown>, model: unknown): Record<string, unknown>;
  evaluateNegotiation(state: Record<string, unknown>): unknown;
}

export function isNegotiation(obj: unknown): obj is NegotiationInterface {
  return (
    isSimulation(obj)
    && hasMethodVariants(
      obj,
      ["getHiddenPreferences", "get_hidden_preferences"],
      ["getRounds", "get_rounds"],
      ["getOpponentModel", "get_opponent_model"],
      ["updateOpponentModel", "update_opponent_model"],
      ["evaluateNegotiation", "evaluate_negotiation"],
    )
  );
}

// ---------------------------------------------------------------------------
// 5. Investigation
// ---------------------------------------------------------------------------

export interface InvestigationInterface extends SimulationInterface {
  getEvidencePool(state: Record<string, unknown>): unknown[];
  evaluateEvidenceChain(chain: unknown, state: Record<string, unknown>): unknown;
  evaluateDiagnosis(diagnosis: string, evidenceChain: unknown, state: Record<string, unknown>): unknown;
}

export function isInvestigation(obj: unknown): obj is InvestigationInterface {
  return (
    isSimulation(obj)
    && hasMethodVariants(
      obj,
      ["getEvidencePool", "get_evidence_pool"],
      ["evaluateEvidenceChain", "evaluate_evidence_chain"],
      ["evaluateDiagnosis", "evaluate_diagnosis"],
    )
  );
}

// ---------------------------------------------------------------------------
// 6. Workflow
// ---------------------------------------------------------------------------

export interface WorkflowInterface extends SimulationInterface {
  getWorkflowSteps(): unknown[];
  executeStep(state: Record<string, unknown>, step: unknown): unknown;
  executeCompensation(state: Record<string, unknown>, step: unknown): unknown;
  getSideEffects(state: Record<string, unknown>): unknown[];
  evaluateWorkflow(state: Record<string, unknown>): unknown;
}

export function isWorkflow(obj: unknown): obj is WorkflowInterface {
  return (
    isSimulation(obj)
    && hasMethodVariants(
      obj,
      ["getWorkflowSteps", "get_workflow_steps"],
      ["executeStep", "execute_step"],
      ["executeCompensation", "execute_compensation"],
      ["getSideEffects", "get_side_effects"],
      ["evaluateWorkflow", "evaluate_workflow"],
    )
  );
}

// ---------------------------------------------------------------------------
// 7. Schema Evolution
// ---------------------------------------------------------------------------

export interface SchemaEvolutionInterface extends SimulationInterface {
  getMutations(): unknown[];
  getSchemaVersion(state: Record<string, unknown>): number;
  getMutationLog(state: Record<string, unknown>): unknown[];
  applyMutation(state: Record<string, unknown>, mutation: unknown): Record<string, unknown>;
  checkContextValidity(state: Record<string, unknown>, assumptions: string[]): unknown[];
  evaluateAdaptation(state: Record<string, unknown>): unknown;
}

export function isSchemaEvolution(obj: unknown): obj is SchemaEvolutionInterface {
  return (
    isSimulation(obj)
    && hasMethodVariants(
      obj,
      ["getMutations", "get_mutations"],
      ["getSchemaVersion", "get_schema_version"],
      ["getMutationLog", "get_mutation_log"],
      ["applyMutation", "apply_mutation"],
      ["checkContextValidity", "check_context_validity"],
      ["evaluateAdaptation", "evaluate_adaptation"],
    )
  );
}

// ---------------------------------------------------------------------------
// 8. Tool Fragility
// ---------------------------------------------------------------------------

export interface ToolFragilityInterface extends SimulationInterface {
  getToolContracts(state: Record<string, unknown>): unknown[];
  getDriftLog(state: Record<string, unknown>): unknown[];
  injectDrift(state: Record<string, unknown>, drift: unknown): Record<string, unknown>;
  attributeFailure(state: Record<string, unknown>, step: number, error: string): unknown;
  evaluateFragility(state: Record<string, unknown>): unknown;
}

export function isToolFragility(obj: unknown): obj is ToolFragilityInterface {
  return (
    isSimulation(obj)
    && hasMethodVariants(
      obj,
      ["getToolContracts", "get_tool_contracts"],
      ["getDriftLog", "get_drift_log"],
      ["injectDrift", "inject_drift"],
      ["attributeFailure", "attribute_failure"],
      ["evaluateFragility", "evaluate_fragility"],
    )
  );
}

// ---------------------------------------------------------------------------
// 9. Operator Loop
// ---------------------------------------------------------------------------

export interface OperatorLoopInterface extends SimulationInterface {
  getEscalationLog(state: Record<string, unknown>): unknown[];
  getClarificationLog(state: Record<string, unknown>): unknown[];
  escalate(state: Record<string, unknown>, event: unknown): Record<string, unknown>;
  requestClarification(state: Record<string, unknown>, request: unknown): Record<string, unknown>;
  evaluateJudgment(state: Record<string, unknown>): unknown;
}

export function isOperatorLoop(obj: unknown): obj is OperatorLoopInterface {
  return (
    isSimulation(obj)
    && hasMethodVariants(
      obj,
      ["getEscalationLog", "get_escalation_log"],
      ["getClarificationLog", "get_clarification_log"],
      "escalate",
      ["requestClarification", "request_clarification"],
      ["evaluateJudgment", "evaluate_judgment"],
    )
  );
}

// ---------------------------------------------------------------------------
// 10. Coordination
// ---------------------------------------------------------------------------

export interface CoordinationInterface extends SimulationInterface {
  getWorkerContexts(state: Record<string, unknown>): unknown[];
  getHandoffLog(state: Record<string, unknown>): unknown[];
  recordHandoff(state: Record<string, unknown>, handoff: unknown): Record<string, unknown>;
  mergeOutputs(state: Record<string, unknown>, workerOutputs: Record<string, string>): Record<string, unknown>;
  evaluateCoordination(state: Record<string, unknown>): unknown;
}

export function isCoordination(obj: unknown): obj is CoordinationInterface {
  return (
    isSimulation(obj)
    && hasMethodVariants(
      obj,
      ["getWorkerContexts", "get_worker_contexts"],
      ["getHandoffLog", "get_handoff_log"],
      ["recordHandoff", "record_handoff"],
      ["mergeOutputs", "merge_outputs"],
      ["evaluateCoordination", "evaluate_coordination"],
    )
  );
}

// ---------------------------------------------------------------------------
// 11. Artifact Editing
// ---------------------------------------------------------------------------

export interface ArtifactEditingInterface {
  describeTask(): string;
  getRubric(): string;
  initialArtifacts(seed?: number): unknown[];
  getEditPrompt(artifacts: unknown[]): string;
  validateArtifact(artifact: unknown): unknown;
  evaluateEdits(original: unknown[], edited: unknown[]): unknown;
}

export function isArtifactEditing(obj: unknown): obj is ArtifactEditingInterface {
  return hasMethodVariants(
    obj,
    ["describeTask", "describe_task"],
    ["getRubric", "get_rubric"],
    ["initialArtifacts", "initial_artifacts"],
    ["getEditPrompt", "get_edit_prompt"],
    ["validateArtifact", "validate_artifact"],
    ["evaluateEdits", "evaluate_edits"],
  );
}

const FAMILY_GUARDS: Record<ScenarioFamilyName, (obj: unknown) => boolean> = {
  game: isGameScenario,
  agent_task: isAgentTask,
  simulation: isSimulation,
  negotiation: isNegotiation,
  investigation: isInvestigation,
  workflow: isWorkflow,
  schema_evolution: isSchemaEvolution,
  tool_fragility: isToolFragility,
  operator_loop: isOperatorLoop,
  coordination: isCoordination,
  artifact_editing: isArtifactEditing,
};

export function assertFamilyContract(
  obj: unknown,
  family: ScenarioFamilyName,
  context = "runtime object",
): void {
  if (FAMILY_GUARDS[family](obj)) {
    return;
  }
  throw new Error(
    `${context} does not satisfy '${family}' contract. Expected methods: ${formatExpectedMethods(EXPECTED_METHODS[family])}`,
  );
}

/**
 * Detect which scenario family an object belongs to.
 * Returns null if the object doesn't match any known family.
 * Order matters — more specific checks come first.
 */
export function detectFamily(obj: unknown): ScenarioFamilyName | null {
  if (isGameScenario(obj)) return "game";
  if (isArtifactEditing(obj)) return "artifact_editing";
  if (isNegotiation(obj)) return "negotiation";
  if (isInvestigation(obj)) return "investigation";
  if (isWorkflow(obj)) return "workflow";
  if (isSchemaEvolution(obj)) return "schema_evolution";
  if (isToolFragility(obj)) return "tool_fragility";
  if (isOperatorLoop(obj)) return "operator_loop";
  if (isCoordination(obj)) return "coordination";
  if (isSimulation(obj)) return "simulation";
  if (isAgentTask(obj)) return "agent_task";
  return null;
}
