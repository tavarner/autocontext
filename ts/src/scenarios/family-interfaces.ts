/**
 * Runtime interface contracts for all 11 scenario families (AC-380).
 * Mirrors Python's scenario family ABCs with TypeScript type guards.
 *
 * Each family has:
 * - A TypeScript interface defining the required methods
 * - A type guard function (isXxx) for runtime detection
 *
 * Plus a detectFamily() function that returns the family name.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hasMethod(obj: unknown, ...names: string[]): boolean {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  return names.every((n) => typeof o[n] === "function");
}

// ---------------------------------------------------------------------------
// 1. Game (parametric) — ScenarioInterface
// ---------------------------------------------------------------------------

export interface GameScenarioInterface {
  readonly name: string;
  describeRules(): string;
  describeStrategyInterface(): string;
  describeEvaluationCriteria(): string;
  initialState(seed?: number): Record<string, unknown>;
  validateActions(state: Record<string, unknown>, playerId: string, actions: Record<string, unknown>): [boolean, string];
  step(state: Record<string, unknown>, actions: Record<string, unknown>): Record<string, unknown>;
  isTerminal(state: Record<string, unknown>): boolean;
  getResult(state: Record<string, unknown>): unknown;
  executeMatch(strategy: Record<string, unknown>, seed: number): unknown;
}

export function isGameScenario(obj: unknown): obj is GameScenarioInterface {
  return hasMethod(obj, "describeRules", "initialState", "step", "isTerminal", "getResult", "executeMatch");
}

// ---------------------------------------------------------------------------
// 2. Agent Task
// ---------------------------------------------------------------------------

export interface AgentTaskInterface {
  getTaskPrompt(state?: Record<string, unknown>): string;
  evaluateOutput(output: string, state?: Record<string, unknown>): Promise<unknown>;
  getRubric(): string;
  initialState(seed?: number): Record<string, unknown>;
  describeTask(): string;
}

export function isAgentTask(obj: unknown): obj is AgentTaskInterface {
  return hasMethod(obj, "getTaskPrompt", "evaluateOutput", "getRubric", "initialState", "describeTask");
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
  return hasMethod(obj, "describeScenario", "describeEnvironment", "initialState", "getAvailableActions", "executeAction", "isTerminal", "evaluateTrace", "getRubric");
}

// ---------------------------------------------------------------------------
// 4. Negotiation
// ---------------------------------------------------------------------------

export interface NegotiationInterface {
  describeScenario(): string;
  getParties(): unknown[];
  initialState(seed?: number): Record<string, unknown>;
  proposeOffer(state: Record<string, unknown>): unknown;
  evaluateNegotiation(state: Record<string, unknown>): unknown;
  getRubric(): string;
}

export function isNegotiation(obj: unknown): obj is NegotiationInterface {
  return hasMethod(obj, "describeScenario", "getParties", "initialState", "proposeOffer", "evaluateNegotiation", "getRubric");
}

// ---------------------------------------------------------------------------
// 5. Investigation
// ---------------------------------------------------------------------------

export interface InvestigationInterface {
  describeScenario(): string;
  initialState(seed?: number): Record<string, unknown>;
  getAvailableActions(state: Record<string, unknown>): unknown[];
  executeAction(state: Record<string, unknown>, action: unknown): [unknown, Record<string, unknown>];
  evaluateTrace(trace: unknown, finalState: Record<string, unknown>): unknown;
  getRubric(): string;
  getRedHerrings(): unknown[];
}

export function isInvestigation(obj: unknown): obj is InvestigationInterface {
  return hasMethod(obj, "describeScenario", "initialState", "getAvailableActions", "executeAction", "evaluateTrace", "getRubric", "getRedHerrings");
}

// ---------------------------------------------------------------------------
// 6. Workflow
// ---------------------------------------------------------------------------

export interface WorkflowInterface {
  describeScenario(): string;
  initialState(seed?: number): Record<string, unknown>;
  getSteps(): unknown[];
  executeStep(state: Record<string, unknown>, step: unknown): unknown;
  evaluateWorkflow(state: Record<string, unknown>): unknown;
  getRubric(): string;
}

export function isWorkflow(obj: unknown): obj is WorkflowInterface {
  return hasMethod(obj, "describeScenario", "initialState", "getSteps", "executeStep", "evaluateWorkflow", "getRubric");
}

// ---------------------------------------------------------------------------
// 7. Schema Evolution
// ---------------------------------------------------------------------------

export interface SchemaEvolutionInterface {
  describeScenario(): string;
  initialState(seed?: number): Record<string, unknown>;
  getAvailableActions(state: Record<string, unknown>): unknown[];
  executeAction(state: Record<string, unknown>, action: unknown): [unknown, Record<string, unknown>];
  evaluateTrace(trace: unknown, finalState: Record<string, unknown>): unknown;
  getRubric(): string;
}

export function isSchemaEvolution(obj: unknown): obj is SchemaEvolutionInterface {
  return hasMethod(obj, "describeScenario", "initialState", "getAvailableActions", "executeAction", "evaluateTrace", "getRubric") && !isInvestigation(obj);
}

// ---------------------------------------------------------------------------
// 8. Tool Fragility
// ---------------------------------------------------------------------------

export interface ToolFragilityInterface {
  describeScenario(): string;
  initialState(seed?: number): Record<string, unknown>;
  getAvailableActions(state: Record<string, unknown>): unknown[];
  executeAction(state: Record<string, unknown>, action: unknown): [unknown, Record<string, unknown>];
  evaluateTrace(trace: unknown, finalState: Record<string, unknown>): unknown;
  getRubric(): string;
}

export function isToolFragility(obj: unknown): obj is ToolFragilityInterface {
  return hasMethod(obj, "describeScenario", "initialState", "getAvailableActions", "executeAction", "evaluateTrace", "getRubric");
}

// ---------------------------------------------------------------------------
// 9. Operator Loop
// ---------------------------------------------------------------------------

export interface OperatorLoopInterface {
  describeScenario(): string;
  initialState(seed?: number): Record<string, unknown>;
  getAvailableActions(state: Record<string, unknown>): unknown[];
  executeAction(state: Record<string, unknown>, action: unknown): [unknown, Record<string, unknown>];
  evaluateTrace(trace: unknown, finalState: Record<string, unknown>): unknown;
  getRubric(): string;
}

export function isOperatorLoop(obj: unknown): obj is OperatorLoopInterface {
  return hasMethod(obj, "describeScenario", "initialState", "getAvailableActions", "executeAction", "evaluateTrace", "getRubric");
}

// ---------------------------------------------------------------------------
// 10. Coordination
// ---------------------------------------------------------------------------

export interface CoordinationInterface {
  describeScenario(): string;
  initialState(seed?: number): Record<string, unknown>;
  getAvailableActions(state: Record<string, unknown>): unknown[];
  executeAction(state: Record<string, unknown>, action: unknown): [unknown, Record<string, unknown>];
  evaluateTrace(trace: unknown, finalState: Record<string, unknown>): unknown;
  getRubric(): string;
}

export function isCoordination(obj: unknown): obj is CoordinationInterface {
  return hasMethod(obj, "describeScenario", "initialState", "getAvailableActions", "executeAction", "evaluateTrace", "getRubric");
}

// ---------------------------------------------------------------------------
// 11. Artifact Editing
// ---------------------------------------------------------------------------

export interface ArtifactEditingInterface {
  describeTask(): string;
  getArtifact(): string;
  evaluateEdit(edited: string): unknown;
  getRubric(): string;
}

export function isArtifactEditing(obj: unknown): obj is ArtifactEditingInterface {
  return hasMethod(obj, "describeTask", "getArtifact", "evaluateEdit", "getRubric");
}

// ---------------------------------------------------------------------------
// Family detection
// ---------------------------------------------------------------------------

export type ScenarioFamilyName =
  | "game"
  | "agent_task"
  | "simulation"
  | "negotiation"
  | "investigation"
  | "workflow"
  | "schema_evolution"
  | "tool_fragility"
  | "operator_loop"
  | "coordination"
  | "artifact_editing";

/**
 * Detect which scenario family an object belongs to.
 * Returns null if the object doesn't match any known family.
 * Order matters — more specific checks come first.
 */
export function detectFamily(obj: unknown): ScenarioFamilyName | null {
  if (isGameScenario(obj)) return "game";
  if (isNegotiation(obj)) return "negotiation";
  if (isInvestigation(obj)) return "investigation";
  if (isArtifactEditing(obj)) return "artifact_editing";
  if (isWorkflow(obj)) return "workflow";
  if (isSimulation(obj)) return "simulation";
  if (isAgentTask(obj)) return "agent_task";
  // These overlap with simulation — detect via family metadata if available
  return null;
}
