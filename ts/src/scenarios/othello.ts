/**
 * Othello opening scenario — deterministic game scenario (AC-402).
 * Port of autocontext/scenarios/othello.py.
 */

import type {
  LegalAction,
  Observation,
  Result,
  ScenarioInterface,
  ScoringDimension,
} from "./game-interface.js";
import { ResultSchema } from "./game-interface.js";

function createRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rngUniform(rng: () => number, lo: number, hi: number): number {
  return lo + rng() * (hi - lo);
}

function rngInt(rng: () => number, lo: number, hi: number): number {
  return Math.floor(rngUniform(rng, lo, hi + 1));
}

export class OthelloScenario implements ScenarioInterface {
  readonly name = "othello";

  scoringDimensions(): ScoringDimension[] {
    return [
      { name: "mobility", weight: 0.35, description: "How well the opening preserves future move flexibility." },
      { name: "corner_pressure", weight: 0.4, description: "How strongly the opening policy pressures stable corner access." },
      { name: "stability", weight: 0.25, description: "How well the opening balances mobility against disc stability." },
    ];
  }

  describeRules(): string {
    return "Standard Othello opening phase on an 8x8 board. Valid actions optimize mobility and corner pressure.";
  }

  describeStrategyInterface(): string {
    return "Return JSON object with `mobility_weight`, `corner_weight`, and `stability_weight` as floats in [0,1].";
  }

  describeEvaluationCriteria(): string {
    return "Optimize weighted mobility, corner access, and disk stability.";
  }

  initialState(seed?: number): Record<string, unknown> {
    const rng = createRng(seed ?? 0);
    return {
      seed: seed ?? 0,
      legal_move_count: rngInt(rng, 8, 14),
      stability_index: Math.round(rngUniform(rng, 0.2, 0.8) * 1000) / 1000,
      terminal: false,
      timeline: [],
    };
  }

  getObservation(state: Record<string, unknown>, playerId: string): Observation {
    return {
      narrative: `${playerId} in early game with ${state.legal_move_count} legal moves and stability index ${state.stability_index}.`,
      state: {
        legal_move_count: state.legal_move_count,
        stability_index: state.stability_index,
      },
      constraints: [
        "Corner pressure is high value when mobility is not over-constrained.",
        "Avoid sacrificing stability for marginal mobility gains.",
      ],
    };
  }

  validateActions(
    _state: Record<string, unknown>,
    _playerId: string,
    actions: Record<string, unknown>,
  ): [boolean, string] {
    for (const key of ["mobility_weight", "corner_weight", "stability_weight"]) {
      const value = actions[key];
      if (typeof value !== "number") {
        return [false, `missing or invalid field: ${key}`];
      }
      if (value < 0 || value > 1) {
        return [false, `${key} must be in [0,1]`];
      }
    }
    return [true, "ok"];
  }

  step(state: Record<string, unknown>, actions: Record<string, unknown>): Record<string, unknown> {
    const mobility = actions.mobility_weight as number;
    const corner = actions.corner_weight as number;
    const stability = actions.stability_weight as number;
    const rng = createRng(state.seed as number);
    const noise = rngUniform(rng, -0.05, 0.05);
    const weighted = mobility * 0.35 + corner * 0.4 + stability * 0.25 + noise;
    const score = Math.round(Math.max(0, Math.min(1, weighted)) * 10000) / 10000;
    const timeline = [...(state.timeline as Array<Record<string, unknown>>)];
    timeline.push({
      event: "opening_evaluated",
      mobility: Math.round(mobility * 10000) / 10000,
      corner: Math.round(corner * 10000) / 10000,
      stability: Math.round(stability * 10000) / 10000,
    });
    return {
      ...state,
      terminal: true,
      score,
      timeline,
      metrics: {
        mobility: Math.round(mobility * 10000) / 10000,
        corner_pressure: Math.round(corner * 10000) / 10000,
        stability: Math.round(stability * 10000) / 10000,
      },
    };
  }

  isTerminal(state: Record<string, unknown>): boolean {
    return Boolean(state.terminal);
  }

  getResult(state: Record<string, unknown>): Result {
    const score = (state.score as number) ?? 0;
    const replay = (state.timeline as Array<Record<string, unknown>>) ?? [];
    const rawMetrics = (state.metrics ?? {}) as Record<string, number>;
    return ResultSchema.parse({
      score,
      winner: score >= 0.52 ? "challenger" : "incumbent",
      summary: `Othello opening score ${score.toFixed(4)}`,
      replay,
      metrics: rawMetrics,
    });
  }

  replayToNarrative(replay: Array<Record<string, unknown>>): string {
    if (!replay.length) return "No Othello replay available.";
    const latest = replay[replay.length - 1];
    return `Opening policy emphasized mobility ${((latest.mobility as number) ?? 0).toFixed(2)}, corner pressure ${((latest.corner as number) ?? 0).toFixed(2)}, and stability ${((latest.stability as number) ?? 0).toFixed(2)}.`;
  }

  renderFrame(state: Record<string, unknown>): Record<string, unknown> {
    return {
      scenario: this.name,
      score: (state.score as number) ?? 0,
      metrics: state.metrics ?? {},
    };
  }

  enumerateLegalActions(state: Record<string, unknown>): LegalAction[] | null {
    if (this.isTerminal(state)) return [];
    return [
      { action: "mobility_weight", description: "Weight for move availability", type: "continuous", range: [0, 1] },
      { action: "corner_weight", description: "Weight for corner control", type: "continuous", range: [0, 1] },
      { action: "stability_weight", description: "Weight for disc stability", type: "continuous", range: [0, 1] },
    ];
  }

  executeMatch(strategy: Record<string, unknown>, seed: number): Result {
    const state = this.initialState(seed);
    const [valid, reason] = this.validateActions(state, "challenger", strategy);
    if (!valid) {
      return ResultSchema.parse({
        score: 0,
        winner: "incumbent",
        summary: "strategy rejected during validation",
        replay: [{ event: "validation_failed", reason }],
        metrics: { valid: 0 },
        validationErrors: [reason],
      });
    }
    const nextState = this.step(state, strategy);
    return this.getResult(nextState);
  }
}
