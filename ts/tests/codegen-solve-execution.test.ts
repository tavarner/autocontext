import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { executeCodegenSolve } from "../src/knowledge/codegen-solve-execution.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "ac-codegen-solve-"));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("codegen solve execution", () => {
  it("generates, persists, executes, and packages a codegen scenario", async () => {
    const generateSource = vi.fn(async () => ({
      source: "export const scenario = {};",
      validation: {
        valid: true,
        errors: [],
        durationMs: 17,
        executedMethods: ["initialState", "getResult"],
      },
    }));
    const executeScenario = vi.fn(async () => ({
      family: "simulation",
      stepsExecuted: 3,
      finalState: { deployed: true },
      records: [
        { action: { name: "provision", parameters: {} }, result: { success: true } },
        { action: { name: "deploy", parameters: {} }, result: { success: true } },
      ],
      score: 0.88,
      reasoning: "Provisioned infrastructure before deploying successfully.",
      dimensionScores: { correctness: 0.9, reliability: 0.86 },
    }));

    const result = await executeCodegenSolve({
      knowledgeRoot: tmpDir,
      created: {
        name: "saved_sim",
        family: "simulation",
        spec: {
          description: "Deploy a tiny service",
          max_steps: "5",
        },
      },
      deps: {
        generateSource,
        executeScenario,
      },
    });

    expect(generateSource).toHaveBeenCalledWith("simulation", {
      description: "Deploy a tiny service",
      max_steps: "5",
    }, "saved_sim");
    expect(executeScenario).toHaveBeenCalledWith({
      source: "export const scenario = {};",
      family: "simulation",
      name: "saved_sim",
      maxSteps: 5,
    });
    expect(result.progress).toBe(3);
    expect(result.result.scenario_name).toBe("saved_sim");
    expect(result.result.best_score).toBe(0.88);
    expect((result.result.metadata as Record<string, unknown>).family).toBe("simulation");

    const scenarioPath = join(tmpDir, "_custom_scenarios", "saved_sim", "scenario.js");
    expect(existsSync(scenarioPath)).toBe(true);
    expect(readFileSync(scenarioPath, "utf-8")).toBe("export const scenario = {};");
  });

  it("defaults maxSteps to 20 when the created spec does not provide one", async () => {
    const executeScenario = vi.fn(async () => ({
      family: "investigation",
      stepsExecuted: 1,
      finalState: {},
      records: [],
      score: 0.7,
      reasoning: "Investigated outage.",
      dimensionScores: {},
    }));

    await executeCodegenSolve({
      knowledgeRoot: tmpDir,
      created: {
        name: "outage_investigation",
        family: "investigation",
        spec: {
          description: "Investigate outage",
        },
      },
      deps: {
        generateSource: async () => ({
          source: "module.exports = {};",
          validation: {
            valid: true,
            errors: [],
            durationMs: 5,
            executedMethods: ["initialState"],
          },
        }),
        executeScenario,
      },
    });

    expect(executeScenario).toHaveBeenCalledWith({
      source: "module.exports = {};",
      family: "investigation",
      name: "outage_investigation",
      maxSteps: 20,
    });
  });
});
