import { describe, expect, it } from "vitest";

import {
  createSolveJob,
  failSolveJob,
  getCompletedSolveJobResult,
  getSolveJobStatus,
} from "../src/knowledge/solve-job-workflow.js";

describe("solve job workflow", () => {
  it("creates jobs, reports status payloads, and hides incomplete results", () => {
    const job = createSolveJob("solve_123", "Summarize outage escalations", 3);

    expect(job).toMatchObject({
      jobId: "solve_123",
      description: "Summarize outage escalations",
      generations: 3,
      status: "pending",
    });
    expect(getSolveJobStatus("solve_123", job)).toMatchObject({
      jobId: "solve_123",
      status: "pending",
      progress: 0,
      scenarioName: null,
      family: null,
    });
    expect(getCompletedSolveJobResult(job)).toBeNull();

    failSolveJob(job, new Error("boom"));
    expect(job).toMatchObject({ status: "failed", error: "boom" });
    expect(getCompletedSolveJobResult(job)).toBeNull();
    expect(getSolveJobStatus("missing", undefined)).toMatchObject({
      jobId: "missing",
      status: "not_found",
    });
  });
});
