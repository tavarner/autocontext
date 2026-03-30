/**
 * AC-456: Candidate-shadow-active promotion lifecycle.
 *
 * Tests the staged deployment pipeline that prevents distilled models
 * from becoming live defaults without quantitative validation.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  ACTIVATION_STATES,
  ModelRegistry,
  PromotionEngine,
  type PromotionDecision,
} from "../src/index.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "ac-456-test-"));
});
afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Activation states
// ---------------------------------------------------------------------------

describe("activation states", () => {
  it("defines the promotion lifecycle", () => {
    expect(ACTIVATION_STATES).toContain("candidate");
    expect(ACTIVATION_STATES).toContain("shadow");
    expect(ACTIVATION_STATES).toContain("active");
    expect(ACTIVATION_STATES).toContain("disabled");
    expect(ACTIVATION_STATES).toContain("deprecated");
  });
});

// ---------------------------------------------------------------------------
// ModelRegistry
// ---------------------------------------------------------------------------

describe("ModelRegistry", () => {
  it("registers a new model as candidate by default", () => {
    const registry = new ModelRegistry();
    const id = registry.register({
      scenario: "grid_ctf",
      family: "game",
      backend: "cuda",
      checkpointDir: join(tmpDir, "checkpoint"),
    });

    const record = registry.get(id);
    expect(record).not.toBeNull();
    expect(record!.activationState).toBe("candidate");
  });

  it("lists models by scenario", () => {
    const registry = new ModelRegistry();
    registry.register({ scenario: "grid_ctf", family: "game", backend: "mlx", checkpointDir: tmpDir });
    registry.register({ scenario: "grid_ctf", family: "game", backend: "cuda", checkpointDir: tmpDir });
    registry.register({ scenario: "othello", family: "game", backend: "mlx", checkpointDir: tmpDir });

    expect(registry.listForScenario("grid_ctf").length).toBe(2);
    expect(registry.listForScenario("othello").length).toBe(1);
  });

  it("resolves the active model for a scenario", () => {
    const registry = new ModelRegistry();
    const id1 = registry.register({ scenario: "test", family: "game", backend: "mlx", checkpointDir: tmpDir });
    const id2 = registry.register({ scenario: "test", family: "game", backend: "cuda", checkpointDir: tmpDir });

    // Neither is active yet
    expect(registry.resolveActive("test")).toBeNull();

    // Promote one
    registry.setState(id1, "active");
    expect(registry.resolveActive("test")?.artifactId).toBe(id1);
  });

  it("prevents two active models for the same scenario", () => {
    const registry = new ModelRegistry();
    const id1 = registry.register({ scenario: "test", family: "game", backend: "mlx", checkpointDir: tmpDir });
    const id2 = registry.register({ scenario: "test", family: "game", backend: "cuda", checkpointDir: tmpDir });

    registry.setState(id1, "active");
    registry.setState(id2, "active");

    // First should be demoted to disabled
    expect(registry.get(id1)!.activationState).toBe("disabled");
    expect(registry.get(id2)!.activationState).toBe("active");
  });

  it("records promotion provenance", () => {
    const registry = new ModelRegistry();
    const id = registry.register({ scenario: "test", family: "game", backend: "mlx", checkpointDir: tmpDir });

    registry.setState(id, "shadow", { reason: "Passed held-out eval", evidence: { heldOutScore: 0.92 } });

    const record = registry.get(id)!;
    expect(record.promotionHistory.length).toBe(1);
    expect(record.promotionHistory[0].to).toBe("shadow");
    expect(record.promotionHistory[0].reason).toContain("held-out");
  });
});

// ---------------------------------------------------------------------------
// PromotionEngine
// ---------------------------------------------------------------------------

describe("PromotionEngine", () => {
  it("promotes candidate → shadow when held-out eval passes", () => {
    const engine = new PromotionEngine();
    const decision = engine.evaluate({
      currentState: "candidate",
      heldOutScore: 0.92,
      incumbentScore: 0.90,
      parseFailureRate: 0,
      validationFailureRate: 0,
    });

    expect(decision.promote).toBe(true);
    expect(decision.targetState).toBe("shadow");
    expect(decision.reasoning).toBeTruthy();
  });

  it("promotes shadow → active when shadow-run delta is acceptable", () => {
    const engine = new PromotionEngine();
    const decision = engine.evaluate({
      currentState: "shadow",
      heldOutScore: 0.92,
      incumbentScore: 0.90,
      shadowRunScore: 0.88,
      parseFailureRate: 0.01,
      validationFailureRate: 0.02,
    });

    expect(decision.promote).toBe(true);
    expect(decision.targetState).toBe("active");
  });

  it("blocks promotion when held-out score is too low", () => {
    const engine = new PromotionEngine();
    const decision = engine.evaluate({
      currentState: "candidate",
      heldOutScore: 0.50,
      incumbentScore: 0.90,
      parseFailureRate: 0,
      validationFailureRate: 0,
    });

    expect(decision.promote).toBe(false);
    expect(decision.reasoning).toContain("below");
  });

  it("blocks promotion on high parse failure rate", () => {
    const engine = new PromotionEngine();
    const decision = engine.evaluate({
      currentState: "candidate",
      heldOutScore: 0.95,
      incumbentScore: 0.90,
      parseFailureRate: 0.15,
      validationFailureRate: 0,
    });

    expect(decision.promote).toBe(false);
    expect(decision.reasoning).toContain("parse");
  });

  it("triggers rollback when active model regresses", () => {
    const engine = new PromotionEngine();
    const decision = engine.evaluate({
      currentState: "active",
      heldOutScore: 0.60,
      incumbentScore: 0.90,
      shadowRunScore: 0.55,
      parseFailureRate: 0.20,
      validationFailureRate: 0.10,
    });

    expect(decision.promote).toBe(false);
    expect(decision.rollback).toBe(true);
    expect(decision.targetState).toBe("disabled");
  });

  it("triggers rollback when a shadow run regresses badly even if held-out looked good", () => {
    const engine = new PromotionEngine();
    const decision = engine.evaluate({
      currentState: "shadow",
      heldOutScore: 0.95,
      incumbentScore: 1.0,
      shadowRunScore: 0.20,
      parseFailureRate: 0,
      validationFailureRate: 0,
    });

    expect(decision.promote).toBe(false);
    expect(decision.rollback).toBe(true);
    expect(decision.targetState).toBe("disabled");
  });

  it("runShadow requires a real incumbent baseline and does not fabricate one", async () => {
    const engine = new PromotionEngine({
      shadowExecutor: async () => ({
        score: 0.20,
        parseFailureRate: 0,
        validationFailureRate: 0,
        samplesRun: 10,
      }),
    });

    await expect(engine.runShadow("artifact-1", "grid_ctf", {
      incumbentScore: 0,
      heldOutScore: 0.95,
    })).rejects.toThrow("incumbentScore");
  });

  it("runShadow returns a complete promotion check that evaluates safely", async () => {
    const engine = new PromotionEngine({
      shadowExecutor: async () => ({
        score: 0.20,
        parseFailureRate: 0,
        validationFailureRate: 0,
        samplesRun: 10,
      }),
    });

    const check = await engine.runShadow("artifact-1", "grid_ctf", {
      incumbentScore: 1.0,
      heldOutScore: 0.95,
    });
    const decision = engine.evaluate(check!);

    expect(check?.incumbentScore).toBe(1.0);
    expect(check?.shadowRunScore).toBe(0.20);
    expect(decision.promote).toBe(false);
    expect(decision.rollback).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// PromotionDecision shape
// ---------------------------------------------------------------------------

describe("PromotionDecision shape", () => {
  it("has all required fields", () => {
    const engine = new PromotionEngine();
    const decision: PromotionDecision = engine.evaluate({
      currentState: "candidate",
      heldOutScore: 0.85,
      incumbentScore: 0.90,
      parseFailureRate: 0,
      validationFailureRate: 0,
    });

    expect(decision).toHaveProperty("promote");
    expect(decision).toHaveProperty("targetState");
    expect(decision).toHaveProperty("reasoning");
    expect(decision).toHaveProperty("rollback");
    expect(typeof decision.promote).toBe("boolean");
    expect(typeof decision.reasoning).toBe("string");
  });
});

describe("public package surface", () => {
  it("exports the promotion lifecycle APIs from the root entrypoint", async () => {
    const pkg = await import("../src/index.js");
    expect(pkg.ACTIVATION_STATES).toBeDefined();
    expect(pkg.ModelRegistry).toBeDefined();
    expect(pkg.PromotionEngine).toBeDefined();
  });
});
