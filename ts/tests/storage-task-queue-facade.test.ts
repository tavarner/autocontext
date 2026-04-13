import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  completeStoreTask,
  countPendingStoreTasks,
  dequeueStoreTask,
  enqueueStoreTask,
  failStoreTask,
  getStoreTask,
} from "../src/storage/storage-task-queue-facade.js";
import { migrateDatabase } from "../src/storage/storage-migration-workflow.js";

const MIGRATIONS_DIR = join(import.meta.dirname, "..", "migrations");

describe("storage task queue facade", () => {
  let dir: string;
  let db: Database.Database;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ac-storage-task-queue-facade-"));
    db = new Database(join(dir, "test.db"));
    migrateDatabase(db, MIGRATIONS_DIR);
  });

  afterEach(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("preserves task queue lifecycle semantics through the store facade", () => {
    enqueueStoreTask(db, "task-low", "spec", 1);
    enqueueStoreTask(db, "task-high", "spec", 10, { task_prompt: "Prompt" });

    expect(countPendingStoreTasks(db)).toBe(2);
    expect(dequeueStoreTask(db)?.id).toBe("task-high");

    completeStoreTask(db, "task-high", 0.91, "Best output", 4, true, '{"ok":true}');
    expect(getStoreTask(db, "task-high")).toMatchObject({
      status: "completed",
      best_score: 0.91,
      total_rounds: 4,
      met_threshold: 1,
    });

    expect(dequeueStoreTask(db)?.id).toBe("task-low");
    failStoreTask(db, "task-low", "boom");
    expect(getStoreTask(db, "task-low")).toMatchObject({
      status: "failed",
      error: "boom",
    });
    expect(countPendingStoreTasks(db)).toBe(0);
  });
});
