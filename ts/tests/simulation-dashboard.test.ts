/**
 * AC-449: Simulation dashboard — API routes + visualization data.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  buildSimulationApiRoutes,
  type SimulationDashboardData,
} from "../src/server/simulation-api.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "ac449-test-"));
});
afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function writeSimReport(name: string, data: Record<string, unknown>): void {
  const dir = join(tmpDir, "_simulations", name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "report.json"), JSON.stringify(data, null, 2));
}

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------

describe("Simulation API routes", () => {
  it("listSimulations returns empty for no artifacts", () => {
    const routes = buildSimulationApiRoutes(tmpDir);
    expect(routes.listSimulations()).toEqual([]);
  });

  it("listSimulations discovers saved simulations", () => {
    writeSimReport("deploy_sim", {
      id: "sim_001",
      name: "deploy_sim",
      family: "simulation",
      status: "completed",
      summary: { score: 0.85 },
    });
    writeSimReport("pricing_sim", {
      id: "sim_002",
      name: "pricing_sim",
      family: "simulation",
      status: "completed",
      summary: { score: 0.72 },
    });
    const routes = buildSimulationApiRoutes(tmpDir);
    const list = routes.listSimulations();
    expect(list.length).toBe(2);
    expect(list.some((s) => s.name === "deploy_sim")).toBe(true);
  });

  it("getSimulation returns full report", () => {
    writeSimReport("test_sim", {
      id: "sim_001",
      name: "test_sim",
      family: "simulation",
      status: "completed",
      summary: { score: 0.85, reasoning: "Good", dimensionScores: {} },
      assumptions: ["stable network"],
      warnings: [],
    });
    const routes = buildSimulationApiRoutes(tmpDir);
    const result = routes.getSimulation("test_sim");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("test_sim");
    expect(result!.summary.score).toBe(0.85);
  });

  it("getSimulation returns null for missing", () => {
    const routes = buildSimulationApiRoutes(tmpDir);
    expect(routes.getSimulation("nonexistent")).toBeNull();
  });

  it("getDashboardData returns visualization-ready structure", () => {
    writeSimReport("sweep_sim", {
      id: "sim_001",
      name: "sweep_sim",
      family: "simulation",
      status: "completed",
      summary: {
        score: 0.75,
        reasoning: "Mixed",
        dimensionScores: { reliability: 0.8, cost: 0.6 },
        bestCase: { score: 0.95, variables: { timeout: 30 } },
        worstCase: { score: 0.3, variables: { timeout: 5 } },
        mostSensitiveVariables: ["timeout", "retries"],
      },
      sweep: {
        dimensions: [{ variable: "timeout", values: [5, 15, 30] }],
        runs: 3,
        results: [
          {
            variables: { timeout: 5 },
            score: 0.3,
            reasoning: "Too fast",
            dimensionScores: {},
          },
          {
            variables: { timeout: 15 },
            score: 0.75,
            reasoning: "Ok",
            dimensionScores: {},
          },
          {
            variables: { timeout: 30 },
            score: 0.95,
            reasoning: "Best",
            dimensionScores: {},
          },
        ],
      },
      assumptions: ["stable network"],
      warnings: ["timeout sensitive"],
    });

    const routes = buildSimulationApiRoutes(tmpDir);
    const data = routes.getDashboardData("sweep_sim");
    expect(data).not.toBeNull();
    expect(data!.name).toBe("sweep_sim");
    expect(data!.overallScore).toBe(0.75);
    expect(data!.sensitivityRanking).toEqual(["timeout", "retries"]);
    expect(data!.sweepChart).toBeDefined();
    expect(data!.sweepChart!.length).toBe(3);
    expect(data!.dimensionScores).toEqual({ reliability: 0.8, cost: 0.6 });
  });

  it("getDashboardData handles simulation without sweep", () => {
    writeSimReport("simple_sim", {
      id: "sim_001",
      name: "simple_sim",
      family: "simulation",
      status: "completed",
      summary: {
        score: 0.9,
        reasoning: "Great",
        dimensionScores: { quality: 0.9 },
      },
      assumptions: [],
      warnings: [],
    });

    const routes = buildSimulationApiRoutes(tmpDir);
    const data = routes.getDashboardData("simple_sim");
    expect(data).not.toBeNull();
    expect(data!.overallScore).toBe(0.9);
    expect(data!.sweepChart).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Dashboard HTML generation
// ---------------------------------------------------------------------------

describe("Dashboard HTML", () => {
  it("renderDashboardHtml returns valid HTML with chart containers", async () => {
    const { renderDashboardHtml } =
      await import("../src/server/simulation-dashboard.js");
    const html = renderDashboardHtml();
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("simulation-dashboard");
    expect(html).toContain("sweep-chart");
    expect(html).toContain("sensitivity-chart");
  });
});
