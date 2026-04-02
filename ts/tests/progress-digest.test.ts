import { describe, expect, it } from "vitest";
import { Coordinator, Worker } from "../src/session/coordinator.js";
import { Session } from "../src/session/types.js";
import { ProgressDigest, WorkerDigest } from "../src/session/progress-digest.js";

describe("WorkerDigest", () => {
  it("from running worker", () => {
    const w = Worker.create({ task: "Research auth", role: "researcher" });
    w.start();
    const d = WorkerDigest.fromWorker(w);
    expect(d.status).toBe("running");
    expect(d.currentAction).toBe("Research auth");
  });
});

describe("ProgressDigest", () => {
  it("from coordinator with workers", () => {
    const coord = Coordinator.create("s1", "Build API");
    const w1 = coord.delegate("Research auth", "researcher");
    const w2 = coord.delegate("Research DB", "researcher");
    w1.start(); w2.start(); w1.complete("OAuth2");
    const digest = ProgressDigest.fromCoordinator(coord);
    expect(digest.activeCount).toBe(1);
    expect(digest.completedCount).toBe(1);
    expect(digest.summary.length).toBeLessThanOrEqual(300);
  });

  it("from session without coordinator", () => {
    const session = Session.create({ goal: "Simple task" });
    session.submitTurn({ prompt: "do it", role: "competitor" });
    const digest = ProgressDigest.fromSession(session);
    expect(digest.turnCount).toBe(1);
  });

  it("empty fallback", () => {
    const digest = ProgressDigest.empty();
    expect(digest.summary).toBeTruthy();
    expect(digest.activeCount).toBe(0);
  });
});
