import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  appendStoreAgentOutput,
  countStoreCompletedRuns,
  createStoreRun,
  getStoreAgentOutputs,
  getStoreBestGenerationForScenario,
  getStoreBestMatchForScenario,
  getStoreGenerations,
  getStoreMatchesForGeneration,
  getStoreMatchesForRun,
  getStoreRun,
  getStoreScoreTrajectory,
  listStoreRuns,
  listStoreRunsForScenario,
  recordStoreMatch,
  upsertStoreGeneration,
  updateStoreRunStatus,
} from "../src/storage/storage-generation-run-facade.js";
import { migrateDatabase } from "../src/storage/storage-migration-workflow.js";

const MIGRATIONS_DIR = join(import.meta.dirname, "..", "migrations");

describe("storage generation and run facade", () => {
  let dir: string;
  let db: Database.Database;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ac-storage-generation-facade-"));
    db = new Database(join(dir, "test.db"));
    migrateDatabase(db, MIGRATIONS_DIR);
  });

  afterEach(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("preserves run, generation, match, output, and trajectory semantics", () => {
    createStoreRun(db, "run-1", "grid_ctf", 3, "local", "deterministic");
    upsertStoreGeneration(db, "run-1", 1, {
      meanScore: 0.6,
      bestScore: 0.7,
      elo: 1050,
      wins: 3,
      losses: 2,
      gateDecision: "advance",
      status: "completed",
      scoringBackend: "glicko",
      ratingUncertainty: 80,
    });
    updateStoreRunStatus(db, "run-1", "completed");
    recordStoreMatch(db, "run-1", 1, {
      seed: 42,
      score: 0.9,
      passedValidation: true,
      validationErrors: "",
      winner: "challenger",
      strategyJson: '{"aggression":0.8}',
      replayJson: '[{"turn":1}]',
    });
    appendStoreAgentOutput(db, "run-1", 1, "competitor", '{"aggression":0.8}');

    expect(getStoreRun(db, "run-1")).toMatchObject({
      scenario: "grid_ctf",
      status: "completed",
      agent_provider: "deterministic",
    });
    expect(getStoreGenerations(db, "run-1")).toHaveLength(1);
    expect(countStoreCompletedRuns(db, "grid_ctf")).toBe(1);
    expect(getStoreMatchesForRun(db, "run-1")).toHaveLength(1);
    expect(getStoreMatchesForGeneration(db, "run-1", 1)[0]).toMatchObject({
      seed: 42,
      winner: "challenger",
    });
    expect(getStoreAgentOutputs(db, "run-1", 1)[0]).toMatchObject({
      role: "competitor",
    });
    expect(getStoreScoreTrajectory(db, "run-1")[0]).toMatchObject({
      generation_index: 1,
      delta: 0.7,
      scoring_backend: "glicko",
      rating_uncertainty: 80,
    });
    expect(listStoreRuns(db, 10)).toHaveLength(1);
    expect(listStoreRunsForScenario(db, "grid_ctf")).toHaveLength(1);
    expect(getStoreBestGenerationForScenario(db, "grid_ctf")).toMatchObject({
      run_id: "run-1",
      best_score: 0.7,
    });
    expect(getStoreBestMatchForScenario(db, "grid_ctf")).toMatchObject({
      score: 0.9,
      strategy_json: '{"aggression":0.8}',
    });
  });
});
