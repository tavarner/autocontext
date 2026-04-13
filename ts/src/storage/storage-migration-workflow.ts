import type Database from "better-sqlite3";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export function migrateDatabase(
  db: Database.Database,
  migrationsDir: string,
): void {
  db.exec(
    `CREATE TABLE IF NOT EXISTS schema_version (
       filename TEXT PRIMARY KEY,
       applied_at TEXT NOT NULL DEFAULT (datetime('now'))
     )`,
  );

  const applied = new Set(
    (db.prepare("SELECT filename FROM schema_version").all() as Array<{ filename: string }>)
      .map((row) => row.filename),
  );

  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    db.exec(sql);
    db.prepare("INSERT INTO schema_version(filename) VALUES (?)").run(file);
  }
}
