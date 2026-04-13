import { describe, expect, it } from "vitest";

import { buildScoreTrajectoryRecords } from "../src/storage/score-trajectory-store.js";

describe("score trajectory store workflow", () => {
  it("normalizes scoring backend and rating uncertainty while preserving trajectory fields", () => {
    expect(buildScoreTrajectoryRecords([
      {
        generation_index: 1,
        mean_score: 0.5,
        best_score: 0.55,
        elo: 1000,
        gate_decision: "retry",
        delta: 0.55,
        dimension_summary: { accuracy: 0.5 },
        scoring_backend: null,
        rating_uncertainty: null,
      },
      {
        generation_index: 2,
        mean_score: 0.65,
        best_score: 0.7,
        elo: 1050,
        gate_decision: "advance",
        delta: 0.15,
        dimension_summary: {},
        scoring_backend: "glicko",
        rating_uncertainty: 75,
      },
    ])).toEqual([
      {
        generation_index: 1,
        mean_score: 0.5,
        best_score: 0.55,
        elo: 1000,
        gate_decision: "retry",
        delta: 0.55,
        dimension_summary: { accuracy: 0.5 },
        scoring_backend: "elo",
        rating_uncertainty: null,
      },
      {
        generation_index: 2,
        mean_score: 0.65,
        best_score: 0.7,
        elo: 1050,
        gate_decision: "advance",
        delta: 0.15,
        dimension_summary: {},
        scoring_backend: "glicko",
        rating_uncertainty: 75,
      },
    ]);
  });
});
