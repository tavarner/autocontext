/**
 * Tests for AC-402: Built-in deterministic scenarios beyond grid_ctf.
 *
 * - OthelloScenario (game scenario, port from Python)
 * - ResourceTrader (deterministic simulation with fixed rules)
 * - Both work through the real no-key CLI loop
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const CLI = join(import.meta.dirname, "..", "src", "cli", "index.ts");

function runCli(
  args: string[],
  opts: { cwd?: string } = {},
): { stdout: string; stderr: string; exitCode: number } {
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_NO_WARNINGS: "1" };
  delete env.ANTHROPIC_API_KEY;
  delete env.OPENAI_API_KEY;
  delete env.AUTOCONTEXT_API_KEY;
  delete env.AUTOCONTEXT_AGENT_API_KEY;
  delete env.AUTOCONTEXT_PROVIDER;
  delete env.AUTOCONTEXT_AGENT_PROVIDER;
  delete env.AUTOCONTEXT_MODEL;
  delete env.AUTOCONTEXT_AGENT_DEFAULT_MODEL;
  delete env.AUTOCONTEXT_DB_PATH;
  delete env.AUTOCONTEXT_RUNS_ROOT;
  delete env.AUTOCONTEXT_KNOWLEDGE_ROOT;
  delete env.AUTOCONTEXT_CONFIG_DIR;

  const result = spawnSync("npx", ["tsx", CLI, ...args], {
    cwd: opts.cwd,
    encoding: "utf8",
    timeout: 15000,
    env,
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    exitCode: result.status ?? 1,
  };
}

function writeProjectConfig(dir: string): void {
  writeFileSync(
    join(dir, ".autoctx.json"),
    JSON.stringify({
      default_scenario: "grid_ctf",
      provider: "deterministic",
      gens: 1,
      knowledge_dir: "./knowledge",
      runs_dir: "./runs",
    }, null, 2) + "\n",
    "utf-8",
  );
}

// ---------------------------------------------------------------------------
// SCENARIO_REGISTRY
// ---------------------------------------------------------------------------

describe("Registries", () => {
  it("SCENARIO_REGISTRY contains grid_ctf, othello, resource_trader", async () => {
    const { SCENARIO_REGISTRY } = await import("../src/scenarios/registry.js");
    expect(SCENARIO_REGISTRY.grid_ctf).toBeDefined();
    expect(SCENARIO_REGISTRY.othello).toBeDefined();
    expect(SCENARIO_REGISTRY.resource_trader).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// OthelloScenario
// ---------------------------------------------------------------------------

describe("OthelloScenario", () => {
  it("exports OthelloScenario class", async () => {
    const { OthelloScenario } = await import("../src/scenarios/othello.js");
    expect(OthelloScenario).toBeDefined();
  });

  it("has name 'othello'", async () => {
    const { OthelloScenario } = await import("../src/scenarios/othello.js");
    const scenario = new OthelloScenario();
    expect(scenario.name).toBe("othello");
  });

  it("describeRules returns non-empty string", async () => {
    const { OthelloScenario } = await import("../src/scenarios/othello.js");
    const scenario = new OthelloScenario();
    expect(scenario.describeRules().length).toBeGreaterThan(0);
  });

  it("initialState produces deterministic state from seed", async () => {
    const { OthelloScenario } = await import("../src/scenarios/othello.js");
    const scenario = new OthelloScenario();
    const s1 = scenario.initialState(42);
    const s2 = scenario.initialState(42);
    expect(s1).toEqual(s2);
    expect(s1.terminal).toBe(false);
  });

  it("validateActions accepts valid strategy", async () => {
    const { OthelloScenario } = await import("../src/scenarios/othello.js");
    const scenario = new OthelloScenario();
    const state = scenario.initialState(1);
    const [valid, msg] = scenario.validateActions(state, "challenger", {
      mobility_weight: 0.5,
      corner_weight: 0.3,
      stability_weight: 0.2,
    });
    expect(valid).toBe(true);
  });

  it("validateActions rejects missing fields", async () => {
    const { OthelloScenario } = await import("../src/scenarios/othello.js");
    const scenario = new OthelloScenario();
    const state = scenario.initialState(1);
    const [valid, msg] = scenario.validateActions(state, "challenger", {});
    expect(valid).toBe(false);
    expect(msg).toContain("mobility_weight");
  });

  it("step produces terminal state with score", async () => {
    const { OthelloScenario } = await import("../src/scenarios/othello.js");
    const scenario = new OthelloScenario();
    const state = scenario.initialState(1);
    const next = scenario.step(state, {
      mobility_weight: 0.6,
      corner_weight: 0.8,
      stability_weight: 0.5,
    });
    expect(next.terminal).toBe(true);
    expect(typeof next.score).toBe("number");
  });

  it("executeMatch returns deterministic Result from seed", async () => {
    const { OthelloScenario } = await import("../src/scenarios/othello.js");
    const scenario = new OthelloScenario();
    const r1 = scenario.executeMatch({ mobility_weight: 0.5, corner_weight: 0.5, stability_weight: 0.5 }, 100);
    const r2 = scenario.executeMatch({ mobility_weight: 0.5, corner_weight: 0.5, stability_weight: 0.5 }, 100);
    expect(r1.score).toBe(r2.score);
    expect(r1.score).toBeGreaterThanOrEqual(0);
    expect(r1.score).toBeLessThanOrEqual(1);
  });

  it("scoringDimensions returns mobility, corner_pressure, stability", async () => {
    const { OthelloScenario } = await import("../src/scenarios/othello.js");
    const scenario = new OthelloScenario();
    const dims = scenario.scoringDimensions()!;
    expect(dims.length).toBe(3);
    const names = dims.map((d) => d.name);
    expect(names).toContain("mobility");
    expect(names).toContain("corner_pressure");
    expect(names).toContain("stability");
  });
});

// ---------------------------------------------------------------------------
// ResourceTrader (deterministic simulation)
// ---------------------------------------------------------------------------

describe("ResourceTrader", () => {
  it("exports ResourceTrader class", async () => {
    const { ResourceTrader } = await import("../src/scenarios/resource-trader.js");
    expect(ResourceTrader).toBeDefined();
  });

  it("has name 'resource_trader'", async () => {
    const { ResourceTrader } = await import("../src/scenarios/resource-trader.js");
    const scenario = new ResourceTrader();
    expect(scenario.name).toBe("resource_trader");
  });

  it("initialState produces deterministic state from seed", async () => {
    const { ResourceTrader } = await import("../src/scenarios/resource-trader.js");
    const scenario = new ResourceTrader();
    const s1 = scenario.initialState(42);
    const s2 = scenario.initialState(42);
    expect(s1).toEqual(s2);
    expect(s1.terminal).toBe(false);
    expect(typeof s1.gold).toBe("number");
  });

  it("validateActions accepts valid trade", async () => {
    const { ResourceTrader } = await import("../src/scenarios/resource-trader.js");
    const scenario = new ResourceTrader();
    const state = scenario.initialState(1);
    const [valid] = scenario.validateActions(state, "player", {
      buy: "wood",
      sell: "stone",
      amount: 2,
    });
    expect(valid).toBe(true);
  });

  it("validateActions rejects invalid resource names", async () => {
    const { ResourceTrader } = await import("../src/scenarios/resource-trader.js");
    const scenario = new ResourceTrader();
    const state = scenario.initialState(1);
    const [valid, msg] = scenario.validateActions(state, "player", {
      buy: "diamonds",
      sell: "stone",
      amount: 1,
    });
    expect(valid).toBe(false);
  });

  it("step updates resources and advances turn", async () => {
    const { ResourceTrader } = await import("../src/scenarios/resource-trader.js");
    const scenario = new ResourceTrader();
    const state = scenario.initialState(1);
    const next = scenario.step(state, { buy: "wood", sell: "stone", amount: 1 });
    expect(next.turn).toBe((state.turn as number) + 1);
  });

  it("executeMatch returns deterministic Result", async () => {
    const { ResourceTrader } = await import("../src/scenarios/resource-trader.js");
    const scenario = new ResourceTrader();
    const r1 = scenario.executeMatch({ buy: "wood", sell: "stone", amount: 2 }, 100);
    const r2 = scenario.executeMatch({ buy: "wood", sell: "stone", amount: 2 }, 100);
    expect(r1.score).toBe(r2.score);
    expect(r1.score).toBeGreaterThanOrEqual(0);
    expect(r1.score).toBeLessThanOrEqual(1);
  });

  it("game terminates after fixed number of turns", async () => {
    const { ResourceTrader } = await import("../src/scenarios/resource-trader.js");
    const scenario = new ResourceTrader();
    let state = scenario.initialState(1);
    const strategy = { buy: "wood", sell: "stone", amount: 1 };
    for (let i = 0; i < 20; i++) {
      if (scenario.isTerminal(state)) break;
      state = scenario.step(state, strategy);
    }
    expect(scenario.isTerminal(state)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Real consumer paths
// ---------------------------------------------------------------------------

describe("AC-402 consumer paths", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ac-builtin-scenarios-"));
    writeProjectConfig(dir);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("capabilities and run manager agree on the built-in scenario inventory", async () => {
    const { stdout, exitCode } = runCli(["capabilities"], { cwd: dir });
    expect(exitCode).toBe(0);
    const capabilities = JSON.parse(stdout) as { scenarios: string[] };

    const { RunManager } = await import("../src/server/run-manager.js");
    const mgr = new RunManager({
      dbPath: join(dir, "runs", "autocontext.sqlite3"),
      migrationsDir: join(import.meta.dirname, "..", "migrations"),
      runsRoot: join(dir, "runs"),
      knowledgeRoot: join(dir, "knowledge"),
      providerType: "deterministic",
    });

    expect(capabilities.scenarios).toEqual(
      mgr.getEnvironmentInfo().scenarios.map((scenario) => scenario.name).sort(),
    );
    expect(capabilities.scenarios).toEqual(["grid_ctf", "othello", "resource_trader"]);
  });

  it("othello works through run, list, replay, and export with deterministic provider", { timeout: 60000 }, () => {
    const runId = "othello_e2e";

    const runResult = runCli([
      "run",
      "--scenario", "othello",
      "--provider", "deterministic",
      "--gens", "1",
      "--matches", "1",
      "--run-id", runId,
      "--json",
    ], { cwd: dir });
    expect(runResult.exitCode).toBe(0);
    const runPayload = JSON.parse(runResult.stdout) as { runId: string; generationsCompleted: number };
    expect(runPayload.runId).toBe(runId);
    expect(runPayload.generationsCompleted).toBe(1);

    const listResult = runCli(["list", "--json", "--scenario", "othello"], { cwd: dir });
    expect(listResult.exitCode).toBe(0);
    const runs = JSON.parse(listResult.stdout) as Array<{ run_id: string; scenario: string; status: string }>;
    expect(runs.some((row) => row.run_id === runId && row.scenario === "othello" && row.status === "completed")).toBe(true);

    const replayResult = runCli(["replay", "--run-id", runId, "--generation", "1"], { cwd: dir });
    expect(replayResult.exitCode).toBe(0);
    const replay = JSON.parse(replayResult.stdout) as { scenario: string; generation: number };
    expect(replay.scenario).toBe("othello");
    expect(replay.generation).toBe(1);

    const exportResult = runCli(["export", "--scenario", "othello"], { cwd: dir });
    expect(exportResult.exitCode).toBe(0);
    const exported = JSON.parse(exportResult.stdout) as { scenario_name?: string; scenarioName?: string };
    expect(exported.scenario_name ?? exported.scenarioName).toBe("othello");
  });
});
