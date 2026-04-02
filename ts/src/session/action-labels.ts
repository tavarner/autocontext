/**
 * Compact action labels (AC-513 TS parity).
 */

import type { Coordinator, CoordinatorEvent } from "./coordinator.js";
import type { SessionEvent } from "./types.js";

const MAX_LABEL_LEN = 120;

const FAILURE_TYPES = new Set(["worker_failed", "turn_failed", "turn_interrupted", "session_failed", "session_canceled"]);

const EVENT_LABEL_MAP: Record<string, string> = {
  coordinator_created: "Coordinator started",
  worker_delegated: "Worker delegated",
  worker_completed: "Worker completed",
  worker_failed: "Worker failed",
  worker_redirected: "Worker redirected",
  fan_out: "Fan-out dispatched",
  fan_in: "Fan-in collected",
  session_created: "Session started",
  turn_submitted: "Turn submitted",
  turn_completed: "Turn completed",
  turn_interrupted: "Turn interrupted",
  turn_failed: "Turn failed",
};

function truncate(text: string): string {
  const clean = text.trim().replace(/\n/g, " ");
  if (clean.length <= MAX_LABEL_LEN) return clean;
  return clean.slice(0, MAX_LABEL_LEN - 1) + "…";
}

export class ActionLabel {
  readonly text: string;
  readonly category: string;

  constructor(text: string, category: string = "action") {
    this.text = text;
    this.category = category;
  }

  static create(text: string, category: string = "action"): ActionLabel {
    return new ActionLabel(truncate(text), category);
  }

  static noop(reason: string = "No changes"): ActionLabel {
    return new ActionLabel(truncate(reason), "noop");
  }
}

export function labelFromEvent(event: CoordinatorEvent | SessionEvent): ActionLabel {
  const eventType = event.eventType;
  const base = EVENT_LABEL_MAP[eventType] ?? eventType.replace(/_/g, " ");
  const payload = event.payload;
  const details: string[] = [];
  for (const key of ["task", "role", "reason", "error", "workerId", "turnId"]) {
    const val = payload[key];
    if (val) details.push(`${key}=${String(val).slice(0, 40)}`);
  }
  const text = details.length ? `${base}: ${details.slice(0, 3).join(", ")}` : base;
  const category = FAILURE_TYPES.has(eventType) ? "failure" : "action";
  return ActionLabel.create(text, category);
}

export function labelsFromCoordinator(coord: Coordinator, maxLabels: number = 20): ActionLabel[] {
  return coord.events.slice(-maxLabels).map(labelFromEvent);
}
