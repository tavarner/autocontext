import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SQLiteStore, type TaskQueueRow } from "../src/storage/index.js";
import {
  completeTaskRecord,
  countPendingTaskRecords,
  dequeueTaskRecord,
  enqueueTaskRecord,
  failTaskRecord,
  getTaskRecord,
} from "../src/storage/task-queue-store.js";

const MIGRATIONS_DIR = join(import.meta.dirname, "..", "migrations");

describe("task queue store workflow", () => {
  let dir: string;
  let db: Database.Database;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ac-task-queue-store-"));
    const dbPath = join(dir, "test.db");
    const store = new SQLiteStore(dbPath);
    store.migrate(MIGRATIONS_DIR);
    store.close();
    db = new Database(dbPath);
  });

  afterEach(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("enqueues, dequeues, counts, completes, and fetches task records", () => {
    enqueueTaskRecord(db, "task-low", "spec", 1);
    enqueueTaskRecord(db, "task-high", "spec", 10, { task_prompt: "Prompt" });

    expect(countPendingTaskRecords(db)).toBe(2);

    const dequeued = dequeueTaskRecord<TaskQueueRow>(db);
    expect(dequeued?.id).toBe("task-high");
    expect(dequeued?.status).toBe("running");

    completeTaskRecord(db, "task-high", 0.92, "Best", 3, true, "{\"ok\":true}");
    expect(getTaskRecord<TaskQueueRow>(db, "task-high")).toMatchObject({
      status: "completed",
      best_score: 0.92,
      met_threshold: 1,
      total_rounds: 3,
    });
    expect(countPendingTaskRecords(db)).toBe(1);
  });

  it("fails tasks and respects future scheduling when dequeuing", () => {
    enqueueTaskRecord(db, "future", "spec", 10, undefined, "2099-01-01T00:00:00");
    enqueueTaskRecord(db, "now", "spec", 1);

    expect(dequeueTaskRecord<TaskQueueRow>(db)?.id).toBe("now");
    failTaskRecord(db, "now", "boom");

    expect(getTaskRecord<TaskQueueRow>(db, "now")).toMatchObject({
      status: "failed",
      error: "boom",
    });
    expect(dequeueTaskRecord<TaskQueueRow>(db)).toBeNull();
  });
});
