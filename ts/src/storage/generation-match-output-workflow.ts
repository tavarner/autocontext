import type Database from "better-sqlite3";

import type { RecordMatchRecordOpts } from "./generation-record-contracts.js";

export function getBestMatchForScenarioRecord<T>(
  db: Database.Database,
  scenario: string,
): T | null {
  return ((db.prepare(
    `SELECT m.*
     FROM matches m
     JOIN runs r ON r.run_id = m.run_id
     WHERE r.scenario = ?
       AND r.status = 'completed'
       AND m.strategy_json != ''
     ORDER BY m.score DESC, m.created_at DESC
     LIMIT 1`,
  ).get(scenario) as T | undefined) ?? null);
}

export function recordMatchRecord(
  db: Database.Database,
  runId: string,
  generationIndex: number,
  opts: RecordMatchRecordOpts,
): void {
  db.prepare(
    `INSERT INTO matches(
       run_id, generation_index, seed, score,
       passed_validation, validation_errors,
       winner, strategy_json, replay_json
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    runId,
    generationIndex,
    opts.seed,
    opts.score,
    opts.passedValidation ? 1 : 0,
    opts.validationErrors,
    opts.winner ?? "",
    opts.strategyJson ?? "",
    opts.replayJson ?? "",
  );
}

export function getMatchesForRunRecord<T>(db: Database.Database, runId: string): T[] {
  return db.prepare("SELECT * FROM matches WHERE run_id = ? ORDER BY id").all(runId) as T[];
}

export function appendAgentOutputRecord(
  db: Database.Database,
  runId: string,
  generationIndex: number,
  role: string,
  content: string,
): void {
  db.prepare(
    `INSERT INTO agent_outputs(run_id, generation_index, role, content)
     VALUES (?, ?, ?, ?)`,
  ).run(runId, generationIndex, role, content);
}

export function getAgentOutputRecords<T>(
  db: Database.Database,
  runId: string,
  generationIndex: number,
): T[] {
  return db.prepare(
    `SELECT * FROM agent_outputs
     WHERE run_id = ? AND generation_index = ?
     ORDER BY id`,
  ).all(runId, generationIndex) as T[];
}

export function getMatchesForGenerationRecord<T>(
  db: Database.Database,
  runId: string,
  generationIndex: number,
): T[] {
  return db.prepare(
    `SELECT * FROM matches WHERE run_id = ? AND generation_index = ? ORDER BY id`,
  ).all(runId, generationIndex) as T[];
}
