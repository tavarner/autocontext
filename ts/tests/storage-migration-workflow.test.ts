import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { migrateDatabase } from "../src/storage/storage-migration-workflow.js";

const MIGRATIONS_DIR = join(import.meta.dirname, "..", "migrations");

describe("storage migration workflow", () => {
  let dir: string;
  let db: Database.Database;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ac-storage-migration-"));
    db = new Database(join(dir, "test.db"));
  });

  afterEach(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("applies migrations idempotently with schema version tracking", () => {
    migrateDatabase(db, MIGRATIONS_DIR);
    migrateDatabase(db, MIGRATIONS_DIR);

    const versions = db.prepare("SELECT filename FROM schema_version ORDER BY filename").all() as Array<{ filename: string }>;
    expect(versions.length).toBeGreaterThan(0);
    expect(new Set(versions.map((row) => row.filename)).size).toBe(versions.length);
  });
});
