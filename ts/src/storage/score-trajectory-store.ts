export interface ScoreTrajectorySourceRow {
  generation_index: number;
  mean_score: number;
  best_score: number;
  elo: number;
  gate_decision: string;
  delta: number;
  dimension_summary: Record<string, unknown>;
  scoring_backend?: string | null;
  rating_uncertainty?: number | null;
}

export interface ScoreTrajectoryRecord {
  generation_index: number;
  mean_score: number;
  best_score: number;
  elo: number;
  gate_decision: string;
  delta: number;
  dimension_summary: Record<string, unknown>;
  scoring_backend: string;
  rating_uncertainty: number | null;
}

export function buildScoreTrajectoryRecords(
  rows: ScoreTrajectorySourceRow[],
): ScoreTrajectoryRecord[] {
  return rows.map((row) => ({
    generation_index: row.generation_index,
    mean_score: row.mean_score,
    best_score: row.best_score,
    elo: row.elo,
    gate_decision: row.gate_decision,
    delta: row.delta,
    dimension_summary: row.dimension_summary,
    scoring_backend: row.scoring_backend ?? "elo",
    rating_uncertainty: row.rating_uncertainty ?? null,
  }));
}
