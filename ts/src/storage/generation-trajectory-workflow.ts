import type Database from "better-sqlite3";

export type GenerationTrajectoryRow = {
  generation_index: number;
  mean_score: number;
  best_score: number;
  elo: number;
  gate_decision: string;
  scoring_backend: string;
  rating_uncertainty: number | null;
  dimension_summary_json: string | null;
};

export function parseDimensionSummaryJson(
  raw: string | null,
): Record<string, unknown> {
  if (typeof raw !== "string" || raw.length === 0) {
    return {};
  }
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function getScoreTrajectoryRecords<T extends GenerationTrajectoryRow>(
  db: Database.Database,
  runId: string,
): Array<T & { delta: number; dimension_summary: Record<string, unknown> }> {
  const rows = db.prepare(
    `SELECT
       generation_index, mean_score, best_score, elo,
       gate_decision, dimension_summary_json,
       scoring_backend, rating_uncertainty
     FROM generations
     WHERE run_id = ? AND status = 'completed'
     ORDER BY generation_index`,
  ).all(runId) as T[];

  const result: Array<T & { delta: number; dimension_summary: Record<string, unknown> }> = [];
  let previousBest = 0;
  for (const row of rows) {
    const delta = row.best_score - previousBest;
    previousBest = row.best_score;
    result.push({
      ...row,
      delta,
      dimension_summary: parseDimensionSummaryJson(row.dimension_summary_json),
    });
  }
  return result;
}
