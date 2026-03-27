/**
 * Simulation engine — first-class `simulate` surface (AC-446).
 *
 * Takes a plain-language description, builds a simulation spec via LLM,
 * executes one or more trajectories (optionally across a sweep grid),
 * and returns structured findings with assumptions and warnings.
 *
 * Built on top of existing scenario families (simulation, operator_loop)
 * and the codegen/materialization pipeline.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { LLMProvider } from "../types/index.js";
import type { ScenarioFamilyName } from "../scenarios/families.js";
import { detectScenarioFamily } from "../scenarios/scenario-creator.js";
import { generateScenarioSource } from "../scenarios/codegen/index.js";
import { validateGeneratedScenario } from "../scenarios/codegen/execution-validator.js";
import { healSpec } from "../scenarios/spec-auto-heal.js";
import { getScenarioTypeMarker } from "../scenarios/families.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SimulationRequest {
  description: string;
  variables?: Record<string, unknown>;
  sweep?: SweepDimension[];
  runs?: number;
  maxSteps?: number;
  saveAs?: string;
}

export interface SweepDimension {
  name: string;
  values: number[];
}

export interface SweepResult {
  dimensions: SweepDimension[];
  runs: number;
  results: Array<{
    variables: Record<string, unknown>;
    score: number;
    reasoning: string;
    dimensionScores: Record<string, number>;
  }>;
}

export interface SimulationSummary {
  score: number;
  reasoning: string;
  dimensionScores: Record<string, number>;
  bestCase?: { score: number; variables: Record<string, unknown> };
  worstCase?: { score: number; variables: Record<string, unknown> };
  mostSensitiveVariables?: string[];
}

export interface SimulationResult {
  id: string;
  name: string;
  family: ScenarioFamilyName;
  status: "completed" | "failed";
  description: string;
  assumptions: string[];
  variables: Record<string, unknown>;
  sweep?: SweepResult;
  summary: SimulationSummary;
  artifacts: {
    scenarioDir: string;
    reportPath?: string;
  };
  warnings: string[];
  error?: string;
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

/**
 * Parse variable overrides from CLI flag: "key=val,key2=val2"
 */
export function parseVariableOverrides(input: string): Record<string, unknown> {
  if (!input.trim()) return {};
  const vars: Record<string, unknown> = {};
  for (const pair of input.split(",")) {
    const [key, ...rest] = pair.split("=");
    const val = rest.join("=");
    if (!key?.trim()) continue;
    const num = Number(val);
    vars[key.trim()] = isNaN(num) || val.trim() === "" ? val.trim() : num;
  }
  return vars;
}

/**
 * Parse sweep spec from CLI flag: "key=min:max:step,key2=min:max:step"
 */
export function parseSweepSpec(input: string): SweepDimension[] {
  if (!input.trim()) return [];
  const dims: SweepDimension[] = [];
  for (const pair of input.split(",")) {
    const [name, range] = pair.split("=");
    if (!name?.trim() || !range) continue;
    const [minStr, maxStr, stepStr] = range.split(":");
    const min = Number(minStr);
    const max = Number(maxStr);
    const step = Number(stepStr);
    if (isNaN(min) || isNaN(max) || isNaN(step) || step <= 0) continue;
    const values: number[] = [];
    for (let v = min; v <= max + step / 2; v += step) {
      values.push(Math.round(v * 10000) / 10000);
    }
    dims.push({ name: name.trim(), values });
  }
  return dims;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

function generateId(): string {
  return `sim_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const SIMULATION_FAMILIES: Set<string> = new Set([
  "simulation", "operator_loop", "coordination",
]);

export class SimulationEngine {
  private provider: LLMProvider;
  private knowledgeRoot: string;

  constructor(provider: LLMProvider, knowledgeRoot: string) {
    this.provider = provider;
    this.knowledgeRoot = knowledgeRoot;
  }

  /**
   * Run a simulation from a plain-language description.
   */
  async run(request: SimulationRequest): Promise<SimulationResult> {
    const id = generateId();
    const name = request.saveAs ?? this.deriveName(request.description);

    try {
      // Step 1: Infer family
      const family = this.inferFamily(request.description);

      // Step 2: Build spec via LLM
      const spec = await this.buildSpec(request.description, family);

      // Step 3: Apply auto-heal + variable overrides
      let healedSpec = healSpec(spec, family);
      if (request.variables) {
        healedSpec = { ...healedSpec, ...request.variables };
      }

      // Step 4: Generate + validate code
      const source = generateScenarioSource(family as ScenarioFamilyName, healedSpec, name);
      const validation = await validateGeneratedScenario(source, family, name);
      if (!validation.valid) {
        return this.failedResult(id, name, family as ScenarioFamilyName, request, validation.errors);
      }

      // Step 5: Persist artifacts
      const scenarioDir = this.persistArtifacts(name, family, healedSpec, source);

      // Step 6: Execute — single or sweep
      let summary: SimulationSummary;
      let sweepResult: SweepResult | undefined;

      if (request.sweep && request.sweep.length > 0) {
        const sweepData = await this.executeSweep(source, family as ScenarioFamilyName, name, request);
        sweepResult = sweepData;
        summary = this.aggregateSweep(sweepData);
      } else {
        const runs = request.runs ?? 1;
        const results = await this.executeRuns(source, family as ScenarioFamilyName, name, runs, request.maxSteps);
        summary = this.aggregateRuns(results);
      }

      // Step 7: Build assumptions and warnings
      const assumptions = this.buildAssumptions(healedSpec, family);
      const warnings = this.buildWarnings(family);

      // Step 8: Save report
      const reportPath = join(scenarioDir, "report.json");
      const resultObj: SimulationResult = {
        id, name,
        family: family as ScenarioFamilyName,
        status: "completed",
        description: request.description,
        assumptions,
        variables: request.variables ?? {},
        sweep: sweepResult,
        summary,
        artifacts: { scenarioDir, reportPath },
        warnings,
      };
      writeFileSync(reportPath, JSON.stringify(resultObj, null, 2), "utf-8");

      return resultObj;
    } catch (err) {
      return {
        id, name,
        family: "simulation",
        status: "failed",
        description: request.description,
        assumptions: [],
        variables: request.variables ?? {},
        summary: { score: 0, reasoning: "", dimensionScores: {} },
        artifacts: { scenarioDir: "" },
        warnings: [],
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private failedResult(
    id: string, name: string, family: ScenarioFamilyName,
    request: SimulationRequest, errors: string[],
  ): SimulationResult {
    return {
      id, name, family,
      status: "failed",
      description: request.description,
      assumptions: [],
      variables: request.variables ?? {},
      summary: { score: 0, reasoning: errors.join("; "), dimensionScores: {} },
      artifacts: { scenarioDir: "" },
      warnings: [],
      error: errors.join("; "),
    };
  }

  private inferFamily(description: string): string {
    const family = detectScenarioFamily(description);
    // Coerce to simulation-like families
    if (SIMULATION_FAMILIES.has(family)) return family;
    // Escalation/operator keywords → operator_loop
    const lower = description.toLowerCase();
    if (/escalat|operator|human.in.the.loop|clarification/i.test(lower)) return "operator_loop";
    return "simulation";
  }

  private async buildSpec(description: string, family: string): Promise<Record<string, unknown>> {
    const systemPrompt = `You are a simulation designer. Given a plain-language description, produce a ${family} spec as a JSON object.

Required fields:
- description: scenario summary
- environment_description: system context
- initial_state_description: starting state
- success_criteria: array of strings
- failure_modes: array of strings
- max_steps: positive integer
- actions: array of {name, description, parameters, preconditions, effects}
${family === "operator_loop" ? '- escalation_policy: {escalation_threshold, max_escalations}' : ""}

Output ONLY the JSON object, no markdown fences.`;

    const result = await this.provider.complete({
      systemPrompt,
      userPrompt: `Simulation request: ${description}`,
    });

    return this.parseJSON(result.text) ?? {
      description,
      environment_description: "Simulated environment",
      initial_state_description: "Initial state",
      success_criteria: ["achieve objective"],
      failure_modes: ["timeout"],
      max_steps: 10,
      actions: [
        { name: "act", description: "Take action", parameters: {}, preconditions: [], effects: [] },
      ],
    };
  }

  private async executeRuns(
    source: string, family: ScenarioFamilyName, name: string,
    runs: number, maxSteps?: number,
  ): Promise<Array<{ score: number; reasoning: string; dimensionScores: Record<string, number> }>> {
    const results: Array<{ score: number; reasoning: string; dimensionScores: Record<string, number> }> = [];
    for (let seed = 0; seed < runs; seed++) {
      const result = await this.executeSingle(source, family, name, seed, maxSteps);
      results.push(result);
    }
    return results;
  }

  private async executeSweep(
    source: string, family: ScenarioFamilyName, name: string,
    request: SimulationRequest,
  ): Promise<SweepResult> {
    const dimensions = request.sweep ?? [];
    const runResults: SweepResult["results"] = [];

    // Generate cartesian product of sweep values
    const combos = this.cartesianProduct(dimensions);
    for (let i = 0; i < combos.length; i++) {
      const variables = combos[i];
      const result = await this.executeSingle(source, family, name, i, request.maxSteps);
      runResults.push({ variables, ...result });
    }

    return { dimensions, runs: runResults.length, results: runResults };
  }

  private async executeSingle(
    source: string, family: ScenarioFamilyName, name: string,
    seed: number, maxSteps?: number,
  ): Promise<{ score: number; reasoning: string; dimensionScores: Record<string, number> }> {
    // Execute via eval (validation already passed)
    const moduleObj = { exports: {} as Record<string, unknown> };
    const fn = new Function("module", "exports", source);
    fn(moduleObj, moduleObj.exports);
    const scenario = (moduleObj.exports as { scenario: Record<string, (...args: unknown[]) => unknown> }).scenario;

    let state = scenario.initialState(seed) as Record<string, unknown>;
    const limit = maxSteps ?? 20;
    let steps = 0;
    const records: Array<{ result: { success: boolean } }> = [];

    while (steps < limit) {
      const terminal = scenario.isTerminal(state) as boolean;
      if (terminal) break;
      const actions = scenario.getAvailableActions(state) as Array<{ name: string }>;
      if (!actions || actions.length === 0) break;
      const actionResult = scenario.executeAction(state, { name: actions[0].name, parameters: {} }) as {
        result: Record<string, unknown>; state: Record<string, unknown>;
      };
      records.push({ result: { success: !!actionResult.result?.success } });
      state = actionResult.state;
      steps++;
    }

    const evalResult = scenario.getResult(state, { records }) as {
      score: number; reasoning: string; dimensionScores?: Record<string, number>;
    };

    return {
      score: evalResult.score ?? 0,
      reasoning: evalResult.reasoning ?? "",
      dimensionScores: evalResult.dimensionScores ?? {},
    };
  }

  private aggregateRuns(
    results: Array<{ score: number; reasoning: string; dimensionScores: Record<string, number> }>,
  ): SimulationSummary {
    if (results.length === 0) return { score: 0, reasoning: "No runs completed", dimensionScores: {} };
    if (results.length === 1) return results[0];

    const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
    const best = results.reduce((a, b) => a.score > b.score ? a : b);
    const worst = results.reduce((a, b) => a.score < b.score ? a : b);

    return {
      score: Math.round(avgScore * 10000) / 10000,
      reasoning: `Average across ${results.length} runs`,
      dimensionScores: results[0].dimensionScores,
      bestCase: { score: best.score, variables: {} },
      worstCase: { score: worst.score, variables: {} },
    };
  }

  private aggregateSweep(sweep: SweepResult): SimulationSummary {
    const results = sweep.results;
    if (results.length === 0) return { score: 0, reasoning: "No sweep runs completed", dimensionScores: {} };

    const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
    const best = results.reduce((a, b) => a.score > b.score ? a : b);
    const worst = results.reduce((a, b) => a.score < b.score ? a : b);

    // Sensitivity analysis: for each dimension, how much does score vary?
    const sensitivity: Array<{ name: string; variance: number }> = [];
    for (const dim of sweep.dimensions) {
      const scoresByValue = new Map<number, number[]>();
      for (const r of results) {
        const val = r.variables[dim.name] as number;
        if (val != null) {
          const scores = scoresByValue.get(val) ?? [];
          scores.push(r.score);
          scoresByValue.set(val, scores);
        }
      }
      const means = [...scoresByValue.values()].map((s) => s.reduce((a, b) => a + b, 0) / s.length);
      if (means.length > 1) {
        const range = Math.max(...means) - Math.min(...means);
        sensitivity.push({ name: dim.name, variance: range });
      }
    }
    sensitivity.sort((a, b) => b.variance - a.variance);

    return {
      score: Math.round(avgScore * 10000) / 10000,
      reasoning: `Sweep across ${sweep.dimensions.length} dimension(s), ${results.length} runs`,
      dimensionScores: results[0].dimensionScores,
      bestCase: { score: best.score, variables: best.variables },
      worstCase: { score: worst.score, variables: worst.variables },
      mostSensitiveVariables: sensitivity.map((s) => s.name),
    };
  }

  private buildAssumptions(spec: Record<string, unknown>, family: string): string[] {
    const assumptions: string[] = [];
    assumptions.push(`Modeled as a ${family} scenario with ${(spec.actions as unknown[])?.length ?? 0} actions`);
    if (spec.max_steps || spec.maxSteps) {
      assumptions.push(`Bounded to ${spec.max_steps ?? spec.maxSteps} maximum steps`);
    }
    if (spec.success_criteria || spec.successCriteria) {
      const criteria = (spec.success_criteria ?? spec.successCriteria) as string[];
      assumptions.push(`Success defined as: ${criteria.join(", ")}`);
    }
    assumptions.push("Agent selects actions greedily (first available)");
    assumptions.push("Environment is deterministic given the same seed");
    return assumptions;
  }

  private buildWarnings(family: string): string[] {
    return [
      "Model-driven result only; not empirical evidence.",
      `Simulated using the ${family} family with generated action logic.`,
      "Outcomes depend on the quality of the LLM-generated scenario spec.",
      "Variable sensitivity analysis is based on score variance across sweep values, not causal attribution.",
    ];
  }

  private persistArtifacts(
    name: string, family: string, spec: Record<string, unknown>, source: string,
  ): string {
    const scenarioDir = join(this.knowledgeRoot, "_simulations", name);
    if (!existsSync(scenarioDir)) mkdirSync(scenarioDir, { recursive: true });

    writeFileSync(join(scenarioDir, "spec.json"), JSON.stringify({ name, family, ...spec }, null, 2), "utf-8");
    writeFileSync(join(scenarioDir, "scenario.js"), source, "utf-8");
    writeFileSync(join(scenarioDir, "scenario_type.txt"), getScenarioTypeMarker(family as ScenarioFamilyName), "utf-8");

    return scenarioDir;
  }

  private deriveName(description: string): string {
    return description
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .slice(0, 4)
      .join("_") || "simulation";
  }

  private parseJSON(text: string): Record<string, unknown> | null {
    const trimmed = text.trim();
    try { return JSON.parse(trimmed); } catch { /* continue */ }
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try { return JSON.parse(trimmed.slice(start, end + 1)); } catch { /* continue */ }
    }
    return null;
  }

  private cartesianProduct(dimensions: SweepDimension[]): Array<Record<string, unknown>> {
    if (dimensions.length === 0) return [{}];
    const [first, ...rest] = dimensions;
    const restCombos = this.cartesianProduct(rest);
    const combos: Array<Record<string, unknown>> = [];
    for (const val of first.values) {
      for (const rest of restCombos) {
        combos.push({ [first.name]: val, ...rest });
      }
    }
    return combos;
  }
}
