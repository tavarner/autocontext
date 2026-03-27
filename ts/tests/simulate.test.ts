/**
 * AC-446: First-class `simulate` command.
 *
 * Tests the simulation engine that takes plain-language descriptions,
 * builds simulation specs, executes trajectories/sweeps, and returns
 * structured findings with assumptions and warnings.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  SimulationEngine,
  parseVariableOverrides,
  parseSweepSpec,
  type SimulationRequest,
  type SimulationResult,
  type SweepDimension,
} from "../src/simulation/engine.js";
import type { LLMProvider } from "../src/types/index.js";

// ---------------------------------------------------------------------------
// Mock provider
// ---------------------------------------------------------------------------

function mockProvider(responses?: string[]): LLMProvider {
  let callIndex = 0;
  const defaultSpec = JSON.stringify({
    description: "Simulated system",
    environment_description: "Test environment",
    initial_state_description: "Starting state",
    success_criteria: ["achieve goal"],
    failure_modes: ["timeout"],
    max_steps: 10,
    actions: [
      { name: "step_a", description: "First step", parameters: {}, preconditions: [], effects: ["a_done"] },
      { name: "step_b", description: "Second step", parameters: {}, preconditions: ["step_a"], effects: ["b_done"] },
    ],
  });
  return {
    complete: async () => {
      const text = responses?.[callIndex % (responses?.length ?? 1)] ?? defaultSpec;
      callIndex++;
      return { text };
    },
    defaultModel: () => "test-model",
  } as unknown as LLMProvider;
}

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "ac-446-test-"));
});
afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Variable override parsing
// ---------------------------------------------------------------------------

describe("parseVariableOverrides", () => {
  it("parses key=value pairs", () => {
    const vars = parseVariableOverrides("threshold=0.7,budget=100,delay=2");
    expect(vars).toEqual({ threshold: 0.7, budget: 100, delay: 2 });
  });

  it("handles string values that aren't numbers", () => {
    const vars = parseVariableOverrides("mode=aggressive,name=test");
    expect(vars).toEqual({ mode: "aggressive", name: "test" });
  });

  it("returns empty object for empty string", () => {
    expect(parseVariableOverrides("")).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Sweep spec parsing
// ---------------------------------------------------------------------------

describe("parseSweepSpec", () => {
  it("parses min:max:step format", () => {
    const dims = parseSweepSpec("threshold=0.4:0.9:0.1");
    expect(dims.length).toBe(1);
    expect(dims[0].name).toBe("threshold");
    expect(dims[0].values.length).toBeGreaterThan(3);
    expect(dims[0].values[0]).toBeCloseTo(0.4);
  });

  it("parses multiple dimensions", () => {
    const dims = parseSweepSpec("threshold=0.4:0.9:0.1,budget=50:200:50");
    expect(dims.length).toBe(2);
    expect(dims[0].name).toBe("threshold");
    expect(dims[1].name).toBe("budget");
  });

  it("returns empty array for empty string", () => {
    expect(parseSweepSpec("")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// SimulationEngine — single trajectory
// ---------------------------------------------------------------------------

describe("SimulationEngine — single run", () => {
  it("runs a simulation from plain-language description", async () => {
    const engine = new SimulationEngine(mockProvider(), tmpDir);

    const result = await engine.run({
      description: "Simulate deploying a web service with rollback capability",
    });

    expect(result.status).toBe("completed");
    expect(result.id).toBeTruthy();
    expect(result.family).toMatch(/simulation|operator_loop/);
    expect(result.summary).toBeDefined();
    expect(result.assumptions).toBeDefined();
    expect(result.assumptions.length).toBeGreaterThan(0);
    expect(result.warnings).toBeDefined();
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((w: string) => w.toLowerCase().includes("model"))).toBe(true);
  });

  it("persists durable artifacts", async () => {
    const engine = new SimulationEngine(mockProvider(), tmpDir);

    const result = await engine.run({
      description: "Simulate a pipeline deployment",
    });

    expect(result.artifacts).toBeDefined();
    expect(result.artifacts.scenarioDir).toBeTruthy();
    expect(existsSync(result.artifacts.scenarioDir)).toBe(true);
    expect(existsSync(join(result.artifacts.scenarioDir, "spec.json"))).toBe(true);
  });

  it("includes structured findings with score", async () => {
    const engine = new SimulationEngine(mockProvider(), tmpDir);

    const result = await engine.run({
      description: "Simulate something",
    });

    expect(typeof result.summary.score).toBe("number");
    expect(result.summary.score).toBeGreaterThanOrEqual(0);
    expect(result.summary.score).toBeLessThanOrEqual(1);
    expect(typeof result.summary.reasoning).toBe("string");
  });

  it("applies variable overrides", async () => {
    const engine = new SimulationEngine(mockProvider(), tmpDir);

    const result = await engine.run({
      description: "Simulate with custom parameters",
      variables: { threshold: 0.8, budget: 200 },
    });

    expect(result.variables).toBeDefined();
    expect(result.variables.threshold).toBe(0.8);
    expect(result.variables.budget).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// SimulationEngine — sweep execution
// ---------------------------------------------------------------------------

describe("SimulationEngine — sweep", () => {
  it("executes multiple runs across a sweep grid", async () => {
    const engine = new SimulationEngine(mockProvider(), tmpDir);

    const result = await engine.run({
      description: "Simulate a system with varying parameters",
      sweep: [
        { name: "seed", values: [1, 2, 3] },
      ],
      runs: 3,
    });

    expect(result.status).toBe("completed");
    expect(result.sweep).toBeDefined();
    expect(result.sweep!.runs).toBeGreaterThanOrEqual(3);
    expect(result.sweep!.dimensions.length).toBe(1);
  });

  it("produces best/worst case in sweep summary", async () => {
    const engine = new SimulationEngine(mockProvider(), tmpDir);

    const result = await engine.run({
      description: "Simulate with sweep",
      sweep: [{ name: "seed", values: [1, 2, 3] }],
    });

    expect(result.summary.bestCase).toBeDefined();
    expect(result.summary.worstCase).toBeDefined();
    expect(typeof result.summary.bestCase!.score).toBe("number");
    expect(typeof result.summary.worstCase!.score).toBe("number");
  });
});

// ---------------------------------------------------------------------------
// SimulationEngine — family inference
// ---------------------------------------------------------------------------

describe("SimulationEngine — family inference", () => {
  it("infers simulation family for deployment descriptions", async () => {
    const engine = new SimulationEngine(mockProvider(), tmpDir);
    const result = await engine.run({
      description: "Simulate deploying a multi-stage pipeline with rollback",
    });
    expect(result.family).toBe("simulation");
  });

  it("infers operator_loop for escalation descriptions", async () => {
    const specWithEscalation = JSON.stringify({
      description: "Escalation simulation",
      environment_description: "Env",
      initial_state_description: "Start",
      escalation_policy: { escalation_threshold: "high", max_escalations: 3 },
      success_criteria: ["correct judgment"],
      failure_modes: ["over-escalation"],
      max_steps: 10,
      actions: [
        { name: "act", description: "Do", parameters: {}, preconditions: [], effects: [] },
      ],
    });

    const engine = new SimulationEngine(mockProvider([specWithEscalation]), tmpDir);
    const result = await engine.run({
      description: "Simulate when agents should escalate to a human operator versus acting autonomously",
    });
    expect(result.family).toBe("operator_loop");
  });
});

// ---------------------------------------------------------------------------
// SimulationResult shape
// ---------------------------------------------------------------------------

describe("SimulationResult contract", () => {
  it("matches the proposed output contract", async () => {
    const engine = new SimulationEngine(mockProvider(), tmpDir);
    const result: SimulationResult = await engine.run({
      description: "Test result shape",
    });

    // Required fields per AC-446
    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("name");
    expect(result).toHaveProperty("family");
    expect(result).toHaveProperty("status");
    expect(result).toHaveProperty("description");
    expect(result).toHaveProperty("assumptions");
    expect(result).toHaveProperty("variables");
    expect(result).toHaveProperty("summary");
    expect(result).toHaveProperty("artifacts");
    expect(result).toHaveProperty("warnings");

    expect(Array.isArray(result.assumptions)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
    expect(typeof result.summary).toBe("object");
    expect(typeof result.artifacts).toBe("object");
  });
});
