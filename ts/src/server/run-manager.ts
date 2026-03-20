/**
 * Run manager — manages run lifecycle for interactive server (AC-347 Task 26).
 * Mirrors Python's autocontext/server/run_manager.py.
 */

import { SCENARIO_REGISTRY } from "../scenarios/registry.js";
import { SQLiteStore } from "../storage/index.js";
import { GenerationRunner } from "../loop/generation-runner.js";
import { createProvider } from "../providers/index.js";

export interface RunManagerOpts {
  dbPath: string;
  migrationsDir: string;
  runsRoot: string;
  knowledgeRoot: string;
  providerType?: string;
}

export interface EnvironmentInfo {
  scenarios: Array<{ name: string; description: string }>;
  executors: Array<{ mode: string; available: boolean; description: string }>;
  currentExecutor: string;
  agentProvider: string;
}

export class RunManager {
  private opts: RunManagerOpts;
  private _active = false;
  private _runPromise: Promise<void> | null = null;

  constructor(opts: RunManagerOpts) {
    this.opts = opts;
  }

  get isActive(): boolean {
    return this._active;
  }

  listScenarios(): string[] {
    return Object.keys(SCENARIO_REGISTRY).sort();
  }

  getEnvironmentInfo(): EnvironmentInfo {
    const scenarios = this.listScenarios().map((name) => {
      const ScenarioClass = SCENARIO_REGISTRY[name];
      const instance = new ScenarioClass();
      return { name, description: instance.describeRules() };
    });

    return {
      scenarios,
      executors: [
        { mode: "local", available: true, description: "Local subprocess execution" },
      ],
      currentExecutor: "local",
      agentProvider: this.opts.providerType ?? "anthropic",
    };
  }

  async startRun(scenario: string, generations: number, runId?: string): Promise<string> {
    if (this._active) {
      throw new Error("A run is already active");
    }

    const ScenarioClass = SCENARIO_REGISTRY[scenario];
    if (!ScenarioClass) {
      throw new Error(`Unknown scenario: ${scenario}. Available: ${this.listScenarios().join(", ")}`);
    }

    const id = runId ?? `tui_${Date.now().toString(16).slice(-8)}`;
    const provider = createProvider({ providerType: this.opts.providerType ?? "deterministic" });

    const store = new SQLiteStore(this.opts.dbPath);
    store.migrate(this.opts.migrationsDir);

    const runner = new GenerationRunner({
      provider,
      scenario: new ScenarioClass(),
      store,
      runsRoot: this.opts.runsRoot,
      knowledgeRoot: this.opts.knowledgeRoot,
    });

    this._active = true;
    this._runPromise = runner
      .run(id, generations)
      .then(() => {})
      .finally(() => {
        this._active = false;
        store.close();
      });

    return id;
  }
}
