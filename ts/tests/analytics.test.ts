/**
 * Tests for AC-381: Analytics module — run traces, rubric drift, credit assignment.
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Run trace types
// ---------------------------------------------------------------------------

describe("RunTrace types", () => {
  it("exports ActorRef, TraceEvent, RunTrace", async () => {
    const mod = await import("../src/analytics/run-trace.js");
    expect(mod.ActorRef).toBeDefined();
    expect(mod.TraceEvent).toBeDefined();
    expect(mod.RunTrace).toBeDefined();
  });

  it("ActorRef serializes to/from dict", async () => {
    const { ActorRef } = await import("../src/analytics/run-trace.js");
    const actor = new ActorRef("role", "competitor", "Competitor Agent");
    const dict = actor.toDict();
    expect(dict.actor_type).toBe("role");
    const restored = ActorRef.fromDict(dict);
    expect(restored.actorId).toBe("competitor");
  });

  it("TraceEvent records timestamped events", async () => {
    const { TraceEvent, ActorRef } = await import("../src/analytics/run-trace.js");
    const event = new TraceEvent({
      eventType: "agent_output",
      actor: new ActorRef("role", "analyst", "Analyst"),
      payload: { content: "Analysis complete." },
    });
    expect(event.eventType).toBe("agent_output");
    expect(event.timestamp).toBeDefined();
  });

  it("RunTrace collects events", async () => {
    const { RunTrace, TraceEvent, ActorRef } = await import("../src/analytics/run-trace.js");
    const trace = new RunTrace("run-1", "grid_ctf");
    trace.addEvent(new TraceEvent({
      eventType: "generation_started",
      actor: new ActorRef("system", "loop", "GenerationRunner"),
      payload: { generation: 1 },
    }));
    expect(trace.events.length).toBe(1);
    expect(trace.runId).toBe("run-1");
  });

  it("RunTrace serializes to/from JSON", async () => {
    const { RunTrace, TraceEvent, ActorRef } = await import("../src/analytics/run-trace.js");
    const trace = new RunTrace("run-1", "grid_ctf");
    trace.addEvent(new TraceEvent({
      eventType: "test",
      actor: new ActorRef("system", "test", "Test"),
      payload: {},
    }));
    const json = trace.toJSON();
    const restored = RunTrace.fromJSON(json);
    expect(restored.events.length).toBe(1);
    expect(restored.runId).toBe("run-1");
  });
});

// ---------------------------------------------------------------------------
// Rubric drift detection
// ---------------------------------------------------------------------------

describe("Rubric drift", () => {
  it("exports RubricDriftMonitor", async () => {
    const { RubricDriftMonitor } = await import("../src/analytics/rubric-drift.js");
    expect(RubricDriftMonitor).toBeDefined();
  });

  it("detects score inflation", async () => {
    const { RubricDriftMonitor } = await import("../src/analytics/rubric-drift.js");
    const monitor = new RubricDriftMonitor();

    // Add a window of scores trending upward
    monitor.recordScore(0.5);
    monitor.recordScore(0.6);
    monitor.recordScore(0.7);
    monitor.recordScore(0.85);
    monitor.recordScore(0.95);
    monitor.recordScore(0.98);

    const report = monitor.analyze();
    expect(report.warnings.length).toBeGreaterThan(0);
    expect(report.warnings.some((w) => w.type === "score_inflation" || w.type === "near_perfect_rate")).toBe(true);
  });

  it("reports no drift for stable scores", async () => {
    const { RubricDriftMonitor } = await import("../src/analytics/rubric-drift.js");
    const monitor = new RubricDriftMonitor();

    // Stable scores around 0.7
    for (let i = 0; i < 10; i++) {
      monitor.recordScore(0.65 + Math.random() * 0.1);
    }

    const report = monitor.analyze();
    expect(report.stable).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Credit assignment
// ---------------------------------------------------------------------------

describe("Credit assignment", () => {
  it("exports CreditAssigner", async () => {
    const { CreditAssigner } = await import("../src/analytics/credit-assignment.js");
    expect(CreditAssigner).toBeDefined();
  });

  it("assigns credit to components based on score impact", async () => {
    const { CreditAssigner } = await import("../src/analytics/credit-assignment.js");
    const assigner = new CreditAssigner();

    // Record component contributions
    assigner.recordContribution("competitor", 0.3);
    assigner.recordContribution("analyst", 0.15);
    assigner.recordContribution("coach", 0.1);
    assigner.recordContribution("competitor", 0.4);

    const credits = assigner.getCredits();
    expect(credits.competitor).toBeGreaterThan(credits.analyst);
    expect(credits.competitor).toBeGreaterThan(credits.coach);
  });
});

// ---------------------------------------------------------------------------
// Timeline inspector
// ---------------------------------------------------------------------------

describe("Timeline inspector", () => {
  it("exports TimelineInspector", async () => {
    const { TimelineInspector } = await import("../src/analytics/timeline-inspector.js");
    expect(TimelineInspector).toBeDefined();
  });

  it("inspects generation timeline from events", async () => {
    const { TimelineInspector } = await import("../src/analytics/timeline-inspector.js");
    const inspector = new TimelineInspector();

    inspector.addEvent({ type: "generation_started", generation: 1, timestamp: "2026-01-01T00:00:00Z" });
    inspector.addEvent({ type: "tournament_completed", generation: 1, mean_score: 0.65, timestamp: "2026-01-01T00:01:00Z" });
    inspector.addEvent({ type: "gate_decided", generation: 1, decision: "advance", timestamp: "2026-01-01T00:01:05Z" });

    const summary = inspector.summarize();
    expect(summary.generations.length).toBe(1);
    expect(summary.generations[0].gateDecision).toBe("advance");
  });
});
