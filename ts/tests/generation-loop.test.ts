/**
 * Tests for AC-346: Generation Loop — Deterministic Provider, Backpressure,
 * Generation Runner, CLI run.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "ac-genloop-"));
}

// ---------------------------------------------------------------------------
// Task 19: Deterministic Provider
// ---------------------------------------------------------------------------

describe("DeterministicProvider", () => {
  it("should be importable", async () => {
    const { DeterministicProvider } = await import("../src/providers/deterministic.js");
    expect(DeterministicProvider).toBeDefined();
  });

  it("implements LLMProvider interface", async () => {
    const { DeterministicProvider } = await import("../src/providers/deterministic.js");
    const provider = new DeterministicProvider();
    expect(provider.name).toBe("deterministic");
    expect(typeof provider.defaultModel).toBe("function");
    expect(typeof provider.complete).toBe("function");
  });

  it("returns canned competitor response for strategy prompts", async () => {
    const { DeterministicProvider } = await import("../src/providers/deterministic.js");
    const provider = new DeterministicProvider();
    const result = await provider.complete({
      systemPrompt: "",
      userPrompt: "Describe your strategy for the grid scenario",
    });
    expect(result.text.length).toBeGreaterThan(0);
    // Should contain JSON-like strategy content
    expect(result.text).toContain("aggression");
  });

  it("returns canned analyst response", async () => {
    const { DeterministicProvider } = await import("../src/providers/deterministic.js");
    const provider = new DeterministicProvider();
    const result = await provider.complete({
      systemPrompt: "",
      userPrompt: "Analyze strengths/failures of the current strategy",
    });
    expect(result.text).toContain("Findings");
  });

  it("returns canned coach response with markers", async () => {
    const { DeterministicProvider } = await import("../src/providers/deterministic.js");
    const provider = new DeterministicProvider();
    const result = await provider.complete({
      systemPrompt: "",
      userPrompt: "You are the playbook coach. Update the playbook.",
    });
    expect(result.text).toContain("<!-- PLAYBOOK_START -->");
    expect(result.text).toContain("<!-- PLAYBOOK_END -->");
    expect(result.text).toContain("<!-- LESSONS_START -->");
    expect(result.text).toContain("<!-- COMPETITOR_HINTS_START -->");
  });

  it("returns default architect response with tools", async () => {
    const { DeterministicProvider } = await import("../src/providers/deterministic.js");
    const provider = new DeterministicProvider();
    const result = await provider.complete({
      systemPrompt: "",
      userPrompt: "Propose tool improvements for the harness",
    });
    expect(result.text).toContain("tools");
  });

  it("is registered in createProvider factory", async () => {
    const { createProvider } = await import("../src/providers/index.js");
    const provider = createProvider({ providerType: "deterministic" });
    expect(provider.name).toBe("deterministic");
  });
});

// ---------------------------------------------------------------------------
// Task 20: Backpressure Gate
// ---------------------------------------------------------------------------

describe("BackpressureGate", () => {
  it("should be importable", async () => {
    const { BackpressureGate } = await import("../src/loop/backpressure.js");
    expect(BackpressureGate).toBeDefined();
  });

  it("advance when delta >= threshold", async () => {
    const { BackpressureGate } = await import("../src/loop/backpressure.js");
    const gate = new BackpressureGate(0.005);
    const decision = gate.evaluate(0.50, 0.60, 0, 2);
    expect(decision.decision).toBe("advance");
    expect(decision.delta).toBeCloseTo(0.10);
  });

  it("retry when delta < threshold and retries remain", async () => {
    const { BackpressureGate } = await import("../src/loop/backpressure.js");
    const gate = new BackpressureGate(0.005);
    const decision = gate.evaluate(0.50, 0.501, 0, 2);
    expect(decision.decision).toBe("retry");
  });

  it("rollback when delta < threshold and retries exhausted", async () => {
    const { BackpressureGate } = await import("../src/loop/backpressure.js");
    const gate = new BackpressureGate(0.005);
    const decision = gate.evaluate(0.50, 0.501, 2, 2);
    expect(decision.decision).toBe("rollback");
  });

  it("advance on exact threshold", async () => {
    const { BackpressureGate } = await import("../src/loop/backpressure.js");
    const gate = new BackpressureGate(0.005);
    const decision = gate.evaluate(0.50, 0.505, 0, 2);
    expect(decision.decision).toBe("advance");
  });

  it("rollback on negative delta (regression)", async () => {
    const { BackpressureGate } = await import("../src/loop/backpressure.js");
    const gate = new BackpressureGate(0.005);
    const decision = gate.evaluate(0.60, 0.50, 2, 2);
    expect(decision.decision).toBe("rollback");
    expect(decision.delta).toBeLessThan(0);
  });
});

describe("TrendAwareGate", () => {
  it("should be importable", async () => {
    const { TrendAwareGate } = await import("../src/loop/backpressure.js");
    expect(TrendAwareGate).toBeDefined();
  });

  it("behaves like simple gate without history", async () => {
    const { TrendAwareGate } = await import("../src/loop/backpressure.js");
    const gate = new TrendAwareGate({ minDelta: 0.005 });
    const decision = gate.evaluate(0.50, 0.60, 0, 2);
    expect(decision.decision).toBe("advance");
  });

  it("relaxes threshold on plateau", async () => {
    const { TrendAwareGate } = await import("../src/loop/backpressure.js");
    const gate = new TrendAwareGate({
      minDelta: 0.01,
      plateauWindow: 3,
      plateauRelaxationFactor: 0.5,
    });
    // Plateau: scores haven't moved
    const history = {
      scores: [0.50, 0.501, 0.502, 0.501],
      gateDecisions: ["retry", "retry", "retry"],
    };
    // Delta of 0.006 is < 0.01 threshold but >= 0.005 relaxed threshold
    const decision = gate.evaluate(0.50, 0.506, 0, 2, history);
    expect(decision.decision).toBe("advance");
  });

  it("relaxes on consecutive rollbacks", async () => {
    const { TrendAwareGate } = await import("../src/loop/backpressure.js");
    const gate = new TrendAwareGate({
      minDelta: 0.01,
      consecutiveRollbackThreshold: 3,
      plateauRelaxationFactor: 0.5,
    });
    const history = {
      scores: [0.50, 0.49, 0.48, 0.47],
      gateDecisions: ["rollback", "rollback", "rollback"],
    };
    const decision = gate.evaluate(0.47, 0.476, 0, 2, history);
    expect(decision.decision).toBe("advance");
  });
});

// ---------------------------------------------------------------------------
// Task 21: Generation Runner
// ---------------------------------------------------------------------------

describe("GenerationRunner", () => {
  let dir: string;

  beforeEach(() => { dir = makeTempDir(); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it("should be importable", async () => {
    const { GenerationRunner } = await import("../src/loop/generation-runner.js");
    expect(GenerationRunner).toBeDefined();
  });

  it("runs a single generation with deterministic provider", async () => {
    const { GenerationRunner } = await import("../src/loop/generation-runner.js");
    const { DeterministicProvider } = await import("../src/providers/deterministic.js");
    const { GridCtfScenario } = await import("../src/scenarios/grid-ctf.js");
    const { SQLiteStore } = await import("../src/storage/index.js");

    const dbPath = join(dir, "test.db");
    const store = new SQLiteStore(dbPath);
    store.migrate(join(__dirname, "..", "migrations"));

    const runner = new GenerationRunner({
      provider: new DeterministicProvider(),
      scenario: new GridCtfScenario(),
      store,
      runsRoot: join(dir, "runs"),
      knowledgeRoot: join(dir, "knowledge"),
      matchesPerGeneration: 2,
      maxRetries: 1,
      minDelta: 0.005,
    });

    const result = await runner.run("test-run", 1);
    expect(result.runId).toBe("test-run");
    expect(result.generationsCompleted).toBe(1);
    expect(typeof result.bestScore).toBe("number");
    expect(result.bestScore).toBeGreaterThanOrEqual(0);

    store.close();
  });

  it("runs multiple generations", async () => {
    const { GenerationRunner } = await import("../src/loop/generation-runner.js");
    const { DeterministicProvider } = await import("../src/providers/deterministic.js");
    const { GridCtfScenario } = await import("../src/scenarios/grid-ctf.js");
    const { SQLiteStore } = await import("../src/storage/index.js");

    const dbPath = join(dir, "test.db");
    const store = new SQLiteStore(dbPath);
    store.migrate(join(__dirname, "..", "migrations"));

    const runner = new GenerationRunner({
      provider: new DeterministicProvider(),
      scenario: new GridCtfScenario(),
      store,
      runsRoot: join(dir, "runs"),
      knowledgeRoot: join(dir, "knowledge"),
      matchesPerGeneration: 2,
      maxRetries: 0,
      minDelta: 0.0,
    });

    const result = await runner.run("test-run-multi", 3);
    expect(result.generationsCompleted).toBe(3);
    expect(result.bestScore).toBeGreaterThanOrEqual(0);

    // Verify storage was populated
    const gens = store.getGenerations("test-run-multi");
    expect(gens.length).toBe(3);

    store.close();
  });

  it("persists matches to storage", async () => {
    const { GenerationRunner } = await import("../src/loop/generation-runner.js");
    const { DeterministicProvider } = await import("../src/providers/deterministic.js");
    const { GridCtfScenario } = await import("../src/scenarios/grid-ctf.js");
    const { SQLiteStore } = await import("../src/storage/index.js");

    const dbPath = join(dir, "test.db");
    const store = new SQLiteStore(dbPath);
    store.migrate(join(__dirname, "..", "migrations"));

    const runner = new GenerationRunner({
      provider: new DeterministicProvider(),
      scenario: new GridCtfScenario(),
      store,
      runsRoot: join(dir, "runs"),
      knowledgeRoot: join(dir, "knowledge"),
      matchesPerGeneration: 3,
      maxRetries: 0,
      minDelta: 0.0,
    });

    await runner.run("test-matches", 1);
    const matches = store.getMatchesForRun("test-matches");
    expect(matches.length).toBe(3);

    store.close();
  });
});

// ---------------------------------------------------------------------------
// Task 22+23: CLI run command
// ---------------------------------------------------------------------------

describe("CLI run command", () => {
  it("help output includes 'run' command", async () => {
    const { execFileSync } = await import("node:child_process");
    const result = execFileSync(
      "npx",
      ["tsx", join(__dirname, "..", "src", "cli", "index.ts"), "--help"],
      { encoding: "utf-8", timeout: 10000 },
    );
    expect(result).toContain("run");
  });
});
