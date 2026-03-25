/**
 * Solve-on-demand manager — submit, track, and retrieve solve jobs (AC-370).
 * Mirrors Python's autocontext/knowledge/solver.py.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { LLMProvider } from "../types/index.js";
import type { SQLiteStore } from "../storage/index.js";
import { assertFamilyContract } from "../scenarios/family-interfaces.js";
import { getScenarioTypeMarker, type ScenarioFamilyName } from "../scenarios/families.js";
import { ArtifactStore } from "./artifact-store.js";
import { exportStrategyPackage } from "./package.js";

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
  status: "pending" | "creating_scenario" | "running" | "completed" | "failed";
  scenarioName?: string;
  family?: string;
  progress?: number;
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

  getStatus(jobId: string): Record<string, unknown> {
    const job = this.jobs.get(jobId);
    if (!job) return { status: "not_found", jobId, error: `Job '${jobId}' not found` };
    return {
      jobId,
      status: job.status,
      description: job.description,
      scenarioName: job.scenarioName ?? null,
      family: job.family ?? null,
      generations: job.generations,
      progress: job.progress ?? 0,
      error: job.error,
    };
  }

  getResult(jobId: string): Record<string, unknown> | null {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== "completed") return null;
    return job.result ?? null;
  }

  private async runJob(job: SolveJob): Promise<void> {
    job.status = "creating_scenario";
    try {
      const { createScenarioFromDescription } = await import("../scenarios/scenario-creator.js");
      const created = await createScenarioFromDescription(job.description, this.provider);
      job.scenarioName = created.name;
      job.family = created.family;

      const { GenerationRunner } = await import("../loop/generation-runner.js");
      const { SCENARIO_REGISTRY } = await import("../scenarios/registry.js");

      const ScenarioClass = SCENARIO_REGISTRY[created.name];
      if (!ScenarioClass) {
        this.persistScenarioScaffold(created);
        throw new Error(
          `Created scenario '${created.name}' (family '${created.family}') is not runnable by the TS solve manager yet`,
        );
      }

      job.status = "running";
      const scenario = new ScenarioClass();
      assertFamilyContract(scenario, "game", `scenario '${created.name}'`);
      const runner = new GenerationRunner({
        provider: this.provider,
        scenario,
        store: this.store,
        runsRoot: this.runsRoot,
        knowledgeRoot: this.knowledgeRoot,
        matchesPerGeneration: 2,
        maxRetries: 0,
        minDelta: 0,
      });

      const runId = `solve_${created.name}_${job.jobId}`;
      const result = await runner.run(runId, job.generations);
      job.progress = result.generationsCompleted;
      const artifacts = new ArtifactStore({
        runsRoot: this.runsRoot,
        knowledgeRoot: this.knowledgeRoot,
      });
      job.status = "completed";
      job.result = exportStrategyPackage({
        scenarioName: created.name,
        artifacts,
        store: this.store,
      });
    } catch (err) {
      job.status = "failed";
      job.error = err instanceof Error ? err.message : String(err);
    }
  }

  private persistScenarioScaffold(created: {
    name: string;
    family: string;
    spec: {
      taskPrompt: string;
      rubric: string;
      description: string;
      [key: string]: unknown;
    };
  }): void {
    const family = this.coerceFamily(created.family);
    const scenarioDir = join(this.knowledgeRoot, "_custom_scenarios", created.name);
    if (!existsSync(scenarioDir)) {
      mkdirSync(scenarioDir, { recursive: true });
    }

    const scenarioType = getScenarioTypeMarker(family);
    writeFileSync(join(scenarioDir, "scenario_type.txt"), scenarioType, "utf-8");
    writeFileSync(
      join(scenarioDir, "spec.json"),
      JSON.stringify(
        {
          name: created.name,
          scenario_type: scenarioType,
          description: created.spec.description,
          taskPrompt: created.spec.taskPrompt,
          rubric: created.spec.rubric,
        },
        null,
        2,
      ),
      "utf-8",
    );

    if (family === "agent_task") {
      writeFileSync(
        join(scenarioDir, "agent_task_spec.json"),
        JSON.stringify(
          {
            task_prompt: created.spec.taskPrompt,
            judge_rubric: created.spec.rubric,
            output_format: "free_text",
            max_rounds: 1,
            quality_threshold: 0.9,
          },
          null,
          2,
        ),
        "utf-8",
      );
    }
  }

  private coerceFamily(family: string): ScenarioFamilyName {
    switch (family) {
      case "simulation":
      case "artifact_editing":
      case "investigation":
      case "workflow":
      case "schema_evolution":
      case "tool_fragility":
      case "negotiation":
      case "operator_loop":
      case "coordination":
      case "agent_task":
        return family;
      default:
        return "agent_task";
    }
  }
}
