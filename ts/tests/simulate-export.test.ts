/**
 * AC-452: simulate export — portable simulation result packages.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SimulationEngine } from "../src/simulation/engine.js";
import { exportSimulation, type SimulationExportResult } from "../src/simulation/export.js";
import type { LLMProvider } from "../src/types/index.js";

function mockProvider(): LLMProvider {
  const spec = JSON.stringify({
    description: "Export test simulation",
    environment_description: "Env",
    initial_state_description: "Start",
    success_criteria: ["done"],
    failure_modes: ["timeout"],
    max_steps: 10,
    actions: [
      { name: "step_a", description: "A", parameters: {}, preconditions: [], effects: ["a_done"] },
      { name: "step_b", description: "B", parameters: {}, preconditions: ["step_a"], effects: ["b_done"] },
    ],
  });
  return {
    complete: async () => ({ text: spec }),
    defaultModel: () => "test-model",
  } as unknown as LLMProvider;
}

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "ac-452-test-"));
});
afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// JSON export
// ---------------------------------------------------------------------------

describe("simulate export — JSON", () => {
  it("exports a saved simulation as a portable JSON package", async () => {
    const engine = new SimulationEngine(mockProvider(), tmpDir);
    await engine.run({ description: "JSON export test", saveAs: "json_test" });

    const result = exportSimulation({
      id: "json_test",
      knowledgeRoot: tmpDir,
      format: "json",
    });

    expect(result.status).toBe("completed");
    expect(result.outputPath).toBeTruthy();
    expect(existsSync(result.outputPath!)).toBe(true);

    const pkg = JSON.parse(readFileSync(result.outputPath!, "utf-8"));
    expect(pkg.name).toBe("json_test");
    expect(pkg.spec).toBeDefined();
    expect(pkg.results).toBeDefined();
    expect(pkg.assumptions).toBeDefined();
    expect(pkg.variables).toBeDefined();
  });

  it("JSON package includes all assumptions and warnings", async () => {
    const engine = new SimulationEngine(mockProvider(), tmpDir);
    await engine.run({ description: "Assumptions test", saveAs: "assume_test" });

    const result = exportSimulation({ id: "assume_test", knowledgeRoot: tmpDir, format: "json" });
    const pkg = JSON.parse(readFileSync(result.outputPath!, "utf-8"));

    expect(Array.isArray(pkg.assumptions)).toBe(true);
    expect(pkg.assumptions.length).toBeGreaterThan(0);
    expect(Array.isArray(pkg.warnings)).toBe(true);
    expect(pkg.warnings.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Markdown export
// ---------------------------------------------------------------------------

describe("simulate export — Markdown", () => {
  it("exports a saved simulation as a markdown report", async () => {
    const engine = new SimulationEngine(mockProvider(), tmpDir);
    await engine.run({ description: "Markdown export test", saveAs: "md_test" });

    const result = exportSimulation({
      id: "md_test",
      knowledgeRoot: tmpDir,
      format: "markdown",
    });

    expect(result.status).toBe("completed");
    expect(result.outputPath).toBeTruthy();
    expect(result.outputPath!.endsWith(".md")).toBe(true);
    expect(existsSync(result.outputPath!)).toBe(true);

    const content = readFileSync(result.outputPath!, "utf-8");
    expect(content).toContain("# Simulation Report");
    expect(content).toContain("md_test");
    expect(content).toContain("Assumptions");
    expect(content).toContain("Warnings");
  });

  it("markdown includes score and dimension scores", async () => {
    const engine = new SimulationEngine(mockProvider(), tmpDir);
    await engine.run({ description: "Score report", saveAs: "score_md" });

    const result = exportSimulation({ id: "score_md", knowledgeRoot: tmpDir, format: "markdown" });
    const content = readFileSync(result.outputPath!, "utf-8");

    expect(content).toContain("Score");
    expect(content).toMatch(/\d+\.\d+/); // has numeric scores
  });
});

// ---------------------------------------------------------------------------
// CSV export (sweep data)
// ---------------------------------------------------------------------------

describe("simulate export — CSV", () => {
  it("exports sweep data as CSV", async () => {
    const engine = new SimulationEngine(mockProvider(), tmpDir);
    await engine.run({
      description: "CSV test",
      saveAs: "csv_test",
      sweep: [{ name: "seed", values: [1, 2, 3] }],
    });

    const result = exportSimulation({
      id: "csv_test",
      knowledgeRoot: tmpDir,
      format: "csv",
    });

    expect(result.status).toBe("completed");
    expect(result.outputPath!.endsWith(".csv")).toBe(true);
    expect(existsSync(result.outputPath!)).toBe(true);

    const content = readFileSync(result.outputPath!, "utf-8");
    const lines = content.trim().split("\n");
    expect(lines.length).toBeGreaterThanOrEqual(2); // header + at least 1 row
    expect(lines[0]).toContain("score"); // header has score column
  });

  it("CSV for non-sweep sim still works (single row)", async () => {
    const engine = new SimulationEngine(mockProvider(), tmpDir);
    await engine.run({ description: "Single CSV", saveAs: "single_csv" });

    const result = exportSimulation({ id: "single_csv", knowledgeRoot: tmpDir, format: "csv" });

    expect(result.status).toBe("completed");
    const lines = readFileSync(result.outputPath!, "utf-8").trim().split("\n");
    expect(lines.length).toBe(2); // header + 1 data row
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe("simulate export — errors", () => {
  it("fails for nonexistent simulation", () => {
    const result = exportSimulation({ id: "nope", knowledgeRoot: tmpDir, format: "json" });
    expect(result.status).toBe("failed");
    expect(result.error).toContain("not found");
  });

  it("defaults to JSON format when not specified", async () => {
    const engine = new SimulationEngine(mockProvider(), tmpDir);
    await engine.run({ description: "Default format", saveAs: "default_fmt" });

    const result = exportSimulation({ id: "default_fmt", knowledgeRoot: tmpDir });
    expect(result.status).toBe("completed");
    expect(result.outputPath!.endsWith(".json")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Result shape
// ---------------------------------------------------------------------------

describe("SimulationExportResult shape", () => {
  it("has all required fields", async () => {
    const engine = new SimulationEngine(mockProvider(), tmpDir);
    await engine.run({ description: "Shape test", saveAs: "shape_exp" });

    const result: SimulationExportResult = exportSimulation({
      id: "shape_exp", knowledgeRoot: tmpDir, format: "json",
    });

    expect(result).toHaveProperty("status");
    expect(result).toHaveProperty("format");
    expect(result).toHaveProperty("outputPath");
    expect(typeof result.format).toBe("string");
  });
});
