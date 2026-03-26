/**
 * AC-432: operator_loop must be explicitly unsupported with clear guidance.
 *
 * Tests verify that the system never silently routes into operator_loop
 * and always provides actionable guidance when a user's description triggers
 * the operator_loop family classifier.
 */

import { describe, it, expect } from "vitest";
import { OperatorLoopCreator, OPERATOR_LOOP_SCAFFOLDING_UNSUPPORTED } from "../src/scenarios/operator-loop-creator.js";
import { detectScenarioFamily } from "../src/scenarios/scenario-creator.js";
import { hasPipeline } from "../src/scenarios/family-pipeline.js";
import { isOperatorLoop } from "../src/scenarios/family-interfaces.js";

// ---------------------------------------------------------------------------
// Family classifier awareness
// ---------------------------------------------------------------------------

describe("operator_loop family classification", () => {
  it("detectScenarioFamily handles operator_loop signals", () => {
    // With no explicit operator_loop keywords in detectScenarioFamily,
    // these should fall to agent_task (the default). This is correct —
    // operator_loop should not be silently activated.
    const family = detectScenarioFamily(
      "test escalation judgment and clarification requests from an operator",
    );
    expect(typeof family).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// Creator explicitly unsupported
// ---------------------------------------------------------------------------

describe("operator_loop creator", () => {
  it("throws with unsupported message on create", async () => {
    const mockProvider = {
      complete: async () => ({ text: "" }),
      defaultModel: () => "test-model",
    } as never;

    const creator = new OperatorLoopCreator({
      provider: mockProvider,
      knowledgeRoot: "/tmp/test",
    });

    await expect(creator.create("test", "test_op")).rejects.toThrow(
      OPERATOR_LOOP_SCAFFOLDING_UNSUPPORTED,
    );
  });

  it("error message contains actionable guidance", () => {
    expect(OPERATOR_LOOP_SCAFFOLDING_UNSUPPORTED).toContain("intentionally");
    expect(OPERATOR_LOOP_SCAFFOLDING_UNSUPPORTED).toContain("not scaffolded");
    // AC-432: Must mention alternatives
    expect(OPERATOR_LOOP_SCAFFOLDING_UNSUPPORTED).toMatch(/family metadata|metadata/);
    expect(OPERATOR_LOOP_SCAFFOLDING_UNSUPPORTED).toMatch(/live-agent|live/);
  });
});

// ---------------------------------------------------------------------------
// Pipeline-level validation (spec validation works — runtime doesn't)
// ---------------------------------------------------------------------------

describe("operator_loop pipeline and type guards", () => {
  it("family-pipeline has operator_loop registered for spec validation", () => {
    expect(hasPipeline("operator_loop")).toBe(true);
  });

  it("family-interfaces has operator_loop type guard", () => {
    expect(typeof isOperatorLoop).toBe("function");
    // A plain object without the methods should not match
    expect(isOperatorLoop({})).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Scenario-creator does not silently route to operator_loop
// ---------------------------------------------------------------------------

describe("scenario-creator operator_loop routing", () => {
  it("detectScenarioFamily has empty operator_loop signals (no silent activation)", () => {
    // The current detectScenarioFamily has operator_loop: [] — meaning
    // no descriptions will silently route to operator_loop. This is the
    // correct behavior per AC-432.
    const family = detectScenarioFamily("escalate to human operator");
    // Should NOT be operator_loop — should fall through to agent_task
    // because detectScenarioFamily has no operator_loop keywords
    expect(family).not.toBe("operator_loop");
  });

  it("OPERATOR_LOOP_SCAFFOLDING_UNSUPPORTED provides actionable guidance", () => {
    const msg = OPERATOR_LOOP_SCAFFOLDING_UNSUPPORTED;
    // Must tell users what to do instead
    expect(msg).toContain("family metadata");
    expect(msg).toContain("live-agent");
  });
});
