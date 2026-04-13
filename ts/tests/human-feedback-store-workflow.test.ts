import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  getCalibrationExampleRecords,
  getHumanFeedbackRecords,
  insertHumanFeedbackRecord,
} from "../src/storage/human-feedback-store.js";
import { migrateDatabase } from "../src/storage/storage-migration-workflow.js";

const MIGRATIONS_DIR = join(import.meta.dirname, "..", "migrations");

describe("human feedback store workflow", () => {
  let dir: string;
  let db: Database.Database;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ac-human-feedback-store-"));
    db = new Database(join(dir, "test.db"));
    migrateDatabase(db, MIGRATIONS_DIR);
  });

  afterEach(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("inserts, reads, validates, and filters calibration examples", () => {
    const id = insertHumanFeedbackRecord(db, "scenario", "output", 0.4, "needs work", "gen-1");
    expect(id).toBeGreaterThan(0);

    insertHumanFeedbackRecord(db, "scenario", "second", null, "notes only");
    insertHumanFeedbackRecord(db, "scenario", "third", 0.8, "strong response");

    expect(() => insertHumanFeedbackRecord(db, "scenario", "bad", 1.5)).toThrow(
      "human_score must be in [0.0, 1.0], got 1.5",
    );

    const feedback = getHumanFeedbackRecords(db, "scenario");
    expect(feedback).toHaveLength(3);
    expect(feedback[0]?.generation_id).toBeTruthy();

    const calibration = getCalibrationExampleRecords(db, "scenario");
    expect(calibration.map((row) => row.agent_output)).toContain("output");
    expect(calibration.map((row) => row.agent_output)).toContain("third");
    expect(calibration.map((row) => row.agent_output)).not.toContain("second");
  });
});
