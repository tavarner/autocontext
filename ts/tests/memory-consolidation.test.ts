import { describe, expect, it } from "vitest";
import {
  ConsolidationTrigger,
  ConsolidationResult,
  MemoryConsolidator,
} from "../src/session/memory-consolidation.js";

describe("ConsolidationTrigger", () => {
  it("not triggered below threshold", () => {
    const t = new ConsolidationTrigger({ minCompletedTurns: 5 });
    expect(t.shouldRun({ completedTurns: 2, completedSessions: 0 })).toBe(false);
  });

  it("triggered by turn count", () => {
    const t = new ConsolidationTrigger({ minCompletedTurns: 5 });
    expect(t.shouldRun({ completedTurns: 6, completedSessions: 0 })).toBe(true);
  });

  it("force overrides threshold", () => {
    const t = new ConsolidationTrigger({ minCompletedTurns: 100 });
    expect(t.shouldRun({ completedTurns: 1, completedSessions: 0, force: true })).toBe(true);
  });
});

describe("ConsolidationResult", () => {
  it("tracks promotions", () => {
    const r = new ConsolidationResult({ promotedLessons: ["l1"], promotedHints: ["h1", "h2"] });
    expect(r.totalPromoted).toBe(3);
    expect(r.wasProductive).toBe(true);
  });

  it("noop result", () => {
    const r = new ConsolidationResult({ skippedReason: "weak signal" });
    expect(r.wasProductive).toBe(false);
  });
});

describe("MemoryConsolidator", () => {
  it("skips when threshold not met", () => {
    const c = new MemoryConsolidator(new ConsolidationTrigger({ minCompletedTurns: 100 }));
    const r = c.run({ completedTurns: 2, completedSessions: 0, artifacts: {} });
    expect(r.wasProductive).toBe(false);
    expect(r.skippedReason).toContain("threshold");
  });

  it("runs when triggered", () => {
    const c = new MemoryConsolidator(new ConsolidationTrigger({ minCompletedTurns: 1 }));
    const r = c.run({
      completedTurns: 5,
      completedSessions: 1,
      artifacts: { session_reports: ["good strategy for auth flow found"] },
    });
    expect(r.skippedReason).toBe("");
  });
});
