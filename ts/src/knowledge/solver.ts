/**
 * Solve-on-demand manager — submit, track, and retrieve solve jobs (AC-370).
 * Mirrors Python's autocontext/knowledge/solver.py.
 */

import type { LLMProvider } from "../types/index.js";
import type { SQLiteStore } from "../storage/index.js";

export interface SolveManagerOpts {
  provider: LLMProvider;
  store: SQLiteStore;
  runsRoot: string;
  knowledgeRoot: string;
}

export interface SolveJob {
  jobId: string;
  description: string;
  generations: number;
  status: "pending" | "running" | "completed" | "failed";
  result?: Record<string, unknown>;
  error?: string;
}

export class SolveManager {
  private provider: LLMProvider;
  private store: SQLiteStore;
  private runsRoot: string;
  private knowledgeRoot: string;
  private jobs = new Map<string, SolveJob>();

  constructor(opts: SolveManagerOpts) {
    this.provider = opts.provider;
    this.store = opts.store;
    this.runsRoot = opts.runsRoot;
    this.knowledgeRoot = opts.knowledgeRoot;
  }

  submit(description: string, generations: number): string {
    const jobId = `solve_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const job: SolveJob = {
      jobId,
      description,
      generations,
      status: "pending",
    };
    this.jobs.set(jobId, job);

    // Fire and forget — run in background
    this.runJob(job).catch((err) => {
      job.status = "failed";
      job.error = err instanceof Error ? err.message : String(err);
    });

    return jobId;
  }

  getStatus(jobId: string): { status: string; jobId: string; error?: string } {
    const job = this.jobs.get(jobId);
    if (!job) return { status: "not_found", jobId };
    return { status: job.status, jobId, error: job.error };
  }

  getResult(jobId: string): Record<string, unknown> | null {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== "completed") return null;
    return job.result ?? null;
  }

  private async runJob(job: SolveJob): Promise<void> {
    job.status = "running";
    try {
      const { createScenarioFromDescription } = await import("../scenarios/scenario-creator.js");
      const created = await createScenarioFromDescription(job.description, this.provider);

      const { GenerationRunner } = await import("../loop/generation-runner.js");
      const { SCENARIO_REGISTRY } = await import("../scenarios/registry.js");

      const ScenarioClass = SCENARIO_REGISTRY[created.name] ?? SCENARIO_REGISTRY.grid_ctf;
      const runner = new GenerationRunner({
        provider: this.provider,
        scenario: new ScenarioClass(),
        store: this.store,
        runsRoot: this.runsRoot,
        knowledgeRoot: this.knowledgeRoot,
        matchesPerGeneration: 2,
        maxRetries: 0,
        minDelta: 0,
      });

      const runId = `solve_${job.jobId}`;
      const result = await runner.run(runId, job.generations);
      job.status = "completed";
      job.result = {
        runId,
        scenario: created.name,
        family: created.family,
        bestScore: result.bestScore,
        elo: result.currentElo,
        spec: created.spec,
      };
    } catch (err) {
      job.status = "failed";
      job.error = err instanceof Error ? err.message : String(err);
    }
  }
}
