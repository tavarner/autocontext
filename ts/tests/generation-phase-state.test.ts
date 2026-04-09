import { describe, expect, it } from "vitest";

import {
  applyGenerationPhaseDecision,
  canContinueGenerationPhase,
  createGenerationPhaseState,
  didAdvanceGenerationPhase,
  getFinalizedGenerationPhaseAttempt,
  markAwaitingCompetitorResult,
  markAwaitingTournamentResult,
  type GenerationAttempt,
} from "../src/loop/generation-phase-state.js";

function makeAttempt(
  gateDecision: GenerationAttempt["gateDecision"],
  bestScore: number,
): GenerationAttempt {
  return {
    competitorPrompt: "prompt",
    competitorResultText: '{"aggression":0.5}',
    strategy: { aggression: 0.5 },
    tournamentResult: {
      matches: [],
      meanScore: bestScore,
      bestScore,
      wins: 1,
      losses: 0,
      elo: 1000 + bestScore * 10,
    },
    gateDecision,
  };
}

describe("generation phase state", () => {
  it("starts at generation_started and moves through competitor/tournament phases", () => {
    const started = createGenerationPhaseState({
      generation: 2,
      previousBestForGeneration: 0.4,
    });

    const awaitingCompetitor = markAwaitingCompetitorResult(started);
    const awaitingTournament = markAwaitingTournamentResult(awaitingCompetitor);

    expect(started.phase).toBe("generation_started");
    expect(awaitingCompetitor.phase).toBe("awaiting_competitor_result");
    expect(awaitingTournament.phase).toBe("awaiting_tournament_result");
  });

  it("records retry gate decisions without finalizing the generation", () => {
    const started = createGenerationPhaseState({
      generation: 2,
      previousBestForGeneration: 0.4,
    });

    const retryState = applyGenerationPhaseDecision(
      markAwaitingTournamentResult(markAwaitingCompetitorResult(started)),
      makeAttempt("retry", 0.41),
    );

    expect(retryState.phase).toBe("gate_decided");
    expect(retryState.lastGateDecision).toBe("retry");
    expect(retryState.attemptState.retryCount).toBe(1);
    expect(canContinueGenerationPhase(retryState, 1)).toBe(true);
    expect(didAdvanceGenerationPhase(retryState)).toBe(false);
  });

  it("finalizes advance decisions and exposes the finalized attempt", () => {
    const started = createGenerationPhaseState({
      generation: 3,
      previousBestForGeneration: 0.45,
    });

    const advanced = applyGenerationPhaseDecision(
      markAwaitingTournamentResult(markAwaitingCompetitorResult(started)),
      makeAttempt("advance", 0.6),
    );

    expect(advanced.phase).toBe("finalized");
    expect(advanced.lastGateDecision).toBe("advance");
    expect(didAdvanceGenerationPhase(advanced)).toBe(true);
    expect(getFinalizedGenerationPhaseAttempt(advanced).tournamentResult.bestScore).toBe(0.6);
    expect(canContinueGenerationPhase(advanced, 2)).toBe(false);
  });

  it("rejects invalid phase ordering", () => {
    const started = createGenerationPhaseState({
      generation: 1,
      previousBestForGeneration: 0,
    });

    expect(() => markAwaitingTournamentResult(started)).toThrow(
      "Invalid generation phase transition: generation_started -> awaiting_tournament_result",
    );
  });
});
