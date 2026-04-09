import { describe, expect, it } from "vitest";

import {
  buildGenerationAttemptCandidate,
  createTournamentExecutionPlan,
  DEFAULT_COMPETITOR_STRATEGY,
  parseCompetitorStrategyResult,
} from "../src/loop/generation-execution-step.js";

describe("generation execution step", () => {
  it("parses competitor strategy JSON when valid", () => {
    expect(
      parseCompetitorStrategyResult('{"aggression":0.8,"defense":0.4,"path_bias":0.2}'),
    ).toEqual({
      aggression: 0.8,
      defense: 0.4,
      path_bias: 0.2,
    });
  });

  it("falls back to the default strategy when competitor output is invalid", () => {
    expect(parseCompetitorStrategyResult("not-json")).toEqual(
      DEFAULT_COMPETITOR_STRATEGY,
    );
  });

  it("creates tournament execution plan from generation context", () => {
    expect(
      createTournamentExecutionPlan({
        generation: 3,
        seedBase: 1000,
        matchesPerGeneration: 4,
        currentElo: 1075,
      }),
    ).toEqual({
      seedForGeneration: 1008,
      tournamentOptions: {
        matchCount: 4,
        seedBase: 1008,
        initialElo: 1075,
      },
    });
  });

  it("builds a generation attempt candidate from execution outputs", () => {
    const tournamentResult = {
      matches: [],
      meanScore: 0.66,
      bestScore: 0.71,
      wins: 2,
      losses: 1,
      elo: 1033,
    };

    expect(
      buildGenerationAttemptCandidate({
        competitorPrompt: "prompt",
        competitorResultText: '{"aggression":0.6}',
        strategy: { aggression: 0.6 },
        tournamentResult,
        gateDecision: "advance",
      }),
    ).toEqual({
      competitorPrompt: "prompt",
      competitorResultText: '{"aggression":0.6}',
      strategy: { aggression: 0.6 },
      tournamentResult,
      gateDecision: "advance",
    });
  });
});
