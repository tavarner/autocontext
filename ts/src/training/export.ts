/**
 * Training data export — Python-compatible JSONL format (AC-366).
 * Mirrors Python's autocontext/training/export.py + types.py.
 *
 * Field names use snake_case to match the Python contract so that
 * downstream training pipelines can consume TS-generated data without
 * field-name translation.
 */

import type { SQLiteStore } from "../storage/index.js";

/**
 * One strategy-level training record — matches Python's TrainingRecord.
 * All fields are snake_case for cross-language compatibility.
 */
export interface TrainingRecord {
  run_id: string;
  scenario: string;
  generation_index: number;
  strategy: string;
  score: number;
  gate_decision: string;
  context: Record<string, unknown>;
  matches?: MatchRecord[];
}

/**
 * One match result — matches Python's MatchRecord.
 */
export interface MatchRecord {
  run_id: string;
  generation_index: number;
  seed: number;
  score: number;
  passed_validation: boolean;
  validation_errors: string;
  winner: string | null;
  strategy: string;
  replay_json: string;
}

export interface ExportOpts {
  runId?: string;
  scenario?: string;
  keptOnly?: boolean;
  includeMatches?: boolean;
}

export function exportTrainingData(
  store: SQLiteStore,
  opts: ExportOpts,
): TrainingRecord[] {
  const records: TrainingRecord[] = [];

  let runs: Array<{ run_id: string; scenario: string }>;
  if (opts.runId) {
    const run = store.getRun(opts.runId);
    if (!run) return [];
    runs = [{ run_id: run.run_id, scenario: run.scenario }];
  } else if (opts.scenario) {
    runs = store.listRuns(1000, opts.scenario).map((r) => ({
      run_id: r.run_id,
      scenario: r.scenario,
    }));
  } else {
    return [];
  }

  for (const run of runs) {
    const generations = store.getGenerations(run.run_id);

    for (const gen of generations) {
      if (gen.status !== "completed") continue;
      if (opts.keptOnly && gen.gate_decision !== "advance") continue;

      const outputs = store.getAgentOutputs(run.run_id, gen.generation_index);
      const competitorOutput = outputs.find((o) => o.role === "competitor");
      const strategyStr = competitorOutput?.content ?? "";

      const record: TrainingRecord = {
        run_id: run.run_id,
        scenario: run.scenario,
        generation_index: gen.generation_index,
        strategy: strategyStr,
        score: gen.best_score,
        gate_decision: gen.gate_decision,
        context: {
          mean_score: gen.mean_score,
          elo: gen.elo,
          wins: gen.wins,
          losses: gen.losses,
        },
      };

      if (opts.includeMatches) {
        const matches = store.getMatchesForGeneration(run.run_id, gen.generation_index);
        record.matches = matches.map((m) => ({
          run_id: run.run_id,
          generation_index: gen.generation_index,
          seed: m.seed,
          score: m.score,
          passed_validation: !!m.passed_validation,
          validation_errors: m.validation_errors,
          winner: m.winner || null,
          strategy: m.strategy_json,
          replay_json: m.replay_json,
        }));
      }

      records.push(record);
    }
  }

  return records;
}
