/**
 * Derived progress digests (AC-512 TS parity).
 */

import type { Coordinator, Worker } from "./coordinator.js";
import { WorkerStatus } from "./coordinator.js";
import type { Session } from "./types.js";

export class WorkerDigest {
  readonly workerId: string;
  readonly role: string;
  readonly status: string;
  readonly currentAction: string;
  readonly lastResult: string;

  constructor(opts: { workerId: string; role: string; status: string; currentAction: string; lastResult?: string }) {
    this.workerId = opts.workerId;
    this.role = opts.role;
    this.status = opts.status;
    this.currentAction = opts.currentAction;
    this.lastResult = opts.lastResult ?? "";
  }

  static fromWorker(worker: Worker): WorkerDigest {
    return new WorkerDigest({
      workerId: worker.workerId,
      role: worker.role,
      status: worker.status,
      currentAction: worker.task.slice(0, 200),
      lastResult: worker.result?.slice(0, 200) ?? "",
    });
  }
}

export class ProgressDigest {
  readonly goal: string;
  readonly summary: string;
  readonly activeCount: number;
  readonly completedCount: number;
  readonly failedCount: number;
  readonly redirectedCount: number;
  readonly turnCount: number;
  readonly workerDigests: WorkerDigest[];
  readonly recentChanges: string[];

  constructor(opts: {
    goal?: string; summary?: string; activeCount?: number;
    completedCount?: number; failedCount?: number; redirectedCount?: number;
    turnCount?: number; workerDigests?: WorkerDigest[]; recentChanges?: string[];
  }) {
    this.goal = opts.goal ?? "";
    this.summary = opts.summary ?? "";
    this.activeCount = opts.activeCount ?? 0;
    this.completedCount = opts.completedCount ?? 0;
    this.failedCount = opts.failedCount ?? 0;
    this.redirectedCount = opts.redirectedCount ?? 0;
    this.turnCount = opts.turnCount ?? 0;
    this.workerDigests = opts.workerDigests ?? [];
    this.recentChanges = opts.recentChanges ?? [];
  }

  static fromCoordinator(coord: Coordinator, maxRecentEvents: number = 10): ProgressDigest {
    const digests = coord.workers.map(WorkerDigest.fromWorker);
    const active = coord.workers.filter((w) => w.isActive);
    const completed = coord.workers.filter((w) => w.status === WorkerStatus.COMPLETED);
    const failed = coord.workers.filter((w) => w.status === WorkerStatus.FAILED);
    const redirected = coord.workers.filter((w) => w.status === WorkerStatus.REDIRECTED);
    const parts: string[] = [];
    if (!coord.workers.length) parts.push("Idle — no workers.");
    else {
      if (active.length) parts.push(`${active.length} active: ${active.slice(0, 3).map((w) => w.task.slice(0, 50)).join(", ")}`);
      if (completed.length) parts.push(`${completed.length} completed`);
      if (failed.length) parts.push(`${failed.length} failed`);
      if (redirected.length) parts.push(`${redirected.length} redirected`);
    }

    const recentChanges = coord.events
      .slice(-maxRecentEvents)
      .map((event) => `${event.eventType.replace(/_/g, " ")}: ${compactPayload(event.payload)}`);

    return new ProgressDigest({
      goal: coord.goal,
      summary: parts.join(". ").slice(0, 300),
      activeCount: active.length,
      completedCount: completed.length,
      failedCount: failed.length,
      redirectedCount: redirected.length,
      workerDigests: digests,
      recentChanges,
    });
  }

  static fromSession(session: Session): ProgressDigest {
    return new ProgressDigest({ goal: session.goal, summary: `Session with ${session.turns.length} turn(s).`, turnCount: session.turns.length });
  }

  static empty(): ProgressDigest {
    return new ProgressDigest({ summary: "No active work." });
  }
}

function compactPayload(payload: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(payload)) {
    if (key === "coordinatorId") continue;
    parts.push(`${key}=${String(value).slice(0, 60)}`);
  }
  return parts.slice(0, 4).join(", ");
}
