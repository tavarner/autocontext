import {
  applyGenerationAttemptDecision,
  canContinueGenerationAttempt,
  didAdvanceGenerationAttempt,
  getFinalizedGenerationAttempt,
  createGenerationAttemptState,
  type GenerationAttempt,
  type GenerationAttemptState,
  type GenerationGateDecision,
} from "./generation-attempt-state.js";

export type GenerationPhase =
  | "generation_started"
  | "awaiting_competitor_result"
  | "awaiting_tournament_result"
  | "gate_decided"
  | "finalized";

export interface GenerationPhaseState {
  generation: number;
  previousBestForGeneration: number;
  phase: GenerationPhase;
  attemptState: GenerationAttemptState;
  lastGateDecision: GenerationGateDecision | null;
}

export interface CreateGenerationPhaseStateOpts {
  generation: number;
  previousBestForGeneration: number;
}

export function createGenerationPhaseState(
  opts: CreateGenerationPhaseStateOpts,
): GenerationPhaseState {
  return {
    generation: opts.generation,
    previousBestForGeneration: opts.previousBestForGeneration,
    phase: "generation_started",
    attemptState: createGenerationAttemptState({
      generation: opts.generation,
      previousBestForGeneration: opts.previousBestForGeneration,
    }),
    lastGateDecision: null,
  };
}

export function markAwaitingCompetitorResult(
  state: GenerationPhaseState,
): GenerationPhaseState {
  assertAllowedGenerationPhaseTransition(
    state.phase,
    "awaiting_competitor_result",
    ["generation_started", "gate_decided"],
  );

  return {
    ...state,
    phase: "awaiting_competitor_result",
  };
}

export function markAwaitingTournamentResult(
  state: GenerationPhaseState,
): GenerationPhaseState {
  assertAllowedGenerationPhaseTransition(
    state.phase,
    "awaiting_tournament_result",
    ["awaiting_competitor_result"],
  );

  return {
    ...state,
    phase: "awaiting_tournament_result",
  };
}

export function applyGenerationPhaseDecision(
  state: GenerationPhaseState,
  attempt: GenerationAttempt,
): GenerationPhaseState {
  assertAllowedGenerationPhaseTransition(
    state.phase,
    attempt.gateDecision === "retry" ? "gate_decided" : "finalized",
    ["awaiting_tournament_result"],
  );

  return {
    ...state,
    phase: attempt.gateDecision === "retry" ? "gate_decided" : "finalized",
    attemptState: applyGenerationAttemptDecision(state.attemptState, attempt),
    lastGateDecision: attempt.gateDecision,
  };
}

export function canContinueGenerationPhase(
  state: GenerationPhaseState,
  maxRetries: number,
): boolean {
  return canContinueGenerationAttempt(state.attemptState, maxRetries);
}

export function didAdvanceGenerationPhase(
  state: GenerationPhaseState,
): boolean {
  return didAdvanceGenerationAttempt(state.attemptState);
}

export function getFinalizedGenerationPhaseAttempt(
  state: GenerationPhaseState,
): GenerationAttempt {
  return getFinalizedGenerationAttempt(state.attemptState);
}

function assertAllowedGenerationPhaseTransition(
  previousPhase: GenerationPhase,
  nextPhase: GenerationPhase,
  allowedPreviousPhases: GenerationPhase[],
): void {
  if (!allowedPreviousPhases.includes(previousPhase)) {
    throw new Error(
      `Invalid generation phase transition: ${previousPhase} -> ${nextPhase}`,
    );
  }
}

export type { GenerationAttempt };
