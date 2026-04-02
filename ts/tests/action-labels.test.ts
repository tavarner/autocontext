import { describe, expect, it } from "vitest";
import { ActionLabel, labelFromEvent, labelsFromCoordinator } from "../src/session/action-labels.js";
import { Coordinator, CoordinatorEventType } from "../src/session/coordinator.js";

describe("ActionLabel", () => {
  it("creates from text", () => {
    const l = ActionLabel.create("Wrote unit tests");
    expect(l.text).toBe("Wrote unit tests");
    expect(l.category).toBe("action");
  });

  it("truncates long text", () => {
    const l = ActionLabel.create("x".repeat(500));
    expect(l.text.length).toBeLessThanOrEqual(120);
    expect(l.text.endsWith("…")).toBe(true);
  });

  it("noop label", () => {
    const l = ActionLabel.noop("No changes");
    expect(l.category).toBe("noop");
  });
});

describe("labelFromEvent", () => {
  it("labels coordinator event", () => {
    const coord = Coordinator.create("s1", "test");
    const w = coord.delegate("t1", "r1");
    w.start();
    coord.completeWorker(w.workerId, "done");
    const completedEvent = coord.events.find((e) => e.eventType === CoordinatorEventType.WORKER_COMPLETED)!;
    const label = labelFromEvent(completedEvent);
    expect(label.text.toLowerCase()).toContain("completed");
  });
});

describe("labelsFromCoordinator", () => {
  it("generates batch labels", () => {
    const coord = Coordinator.create("s1", "test");
    const w = coord.delegate("t1", "r1");
    w.start();
    coord.completeWorker(w.workerId, "done");
    const labels = labelsFromCoordinator(coord, 10);
    expect(labels.length).toBeGreaterThanOrEqual(2);
  });

  it("respects max_labels", () => {
    const coord = Coordinator.create("s1", "test");
    for (let i = 0; i < 20; i++) coord.delegate(`task-${i}`, "r1");
    const labels = labelsFromCoordinator(coord, 5);
    expect(labels.length).toBeLessThanOrEqual(5);
  });
});
