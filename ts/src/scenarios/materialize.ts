/**
 * Scenario materialization — persist runnable artifacts from specs (AC-433).
 *
 * This is the missing glue between "spec created" and "runnable scenario on disk."
 * Called by the CLI new-scenario command, MCP tools, and programmatic API.
 *
 * For each family:
 * - Writes spec.json (full spec, camelCase)
 * - Writes scenario_type.txt (family marker)
 * - For agent_task: writes agent_task_spec.json (snake_case for custom-loader)
 * - For codegen families: generates scenario.js via the codegen pipeline
 * - Validates generated code by execution before persisting
 *
 * After materialization, the scenario is discoverable by loadCustomScenarios()
 * and runnable through the appropriate execution path.
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getScenarioTypeMarker, type ScenarioFamilyName } from "./families.js";
import { hasCodegen, generateScenarioSource } from "./codegen/index.js";
import { validateGeneratedScenario } from "./codegen/execution-validator.js";
import { healSpec } from "./spec-auto-heal.js";
import { AgentTaskSpecSchema, type AgentTaskSpec } from "./agent-task-spec.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MaterializeOpts {
  /** Scenario name (used as directory name under _custom_scenarios/) */
  name: string;
  /** Scenario family */
  family: string;
  /** The scenario spec (taskPrompt, rubric, description, plus family-specific fields) */
  spec: Record<string, unknown>;
  /** Root knowledge directory (e.g., "./knowledge") */
  knowledgeRoot: string;
}

export interface MaterializeResult {
  /** Whether artifacts were persisted to disk */
  persisted: boolean;
  /** Whether executable JS source was generated (codegen families) */
  generatedSource: boolean;
  /** Absolute path to the scenario directory */
  scenarioDir: string;
  /** The family that was materialized */
  family: string;
  /** The scenario name */
  name: string;
  /** Validation errors, if any (empty = success) */
  errors: string[];
}

// Families that get an agent_task_spec.json for backward compat with custom-loader
const AGENT_TASK_FAMILY = "agent_task";

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

/**
 * Materialize a scenario spec into durable on-disk artifacts.
 *
 * After this call, the scenario is:
 * - Discoverable by loadCustomScenarios()
 * - Runnable through the appropriate execution path
 * - Persisted with all required metadata
 */
export async function materializeScenario(opts: MaterializeOpts): Promise<MaterializeResult> {
  const { name, spec, knowledgeRoot } = opts;
  const family = coerceFamily(opts.family);
  const scenarioDir = join(knowledgeRoot, "_custom_scenarios", name);
  const errors: string[] = [];

  // Auto-heal spec before persisting
  const healedSpec = healSpec(spec, family);
  const scenarioType = getScenarioTypeMarker(family);

  if (family === "game") {
    errors.push(
      "custom scenario materialization does not support family 'game'; use a built-in game scenario instead",
    );
    return {
      persisted: false,
      generatedSource: false,
      scenarioDir,
      family,
      name,
      errors,
    };
  }

  let generatedSource = false;
  let source: string | null = null;
  let persistedSpec: Record<string, unknown> = {
    name,
    family,
    scenario_type: scenarioType,
    ...healedSpec,
  };
  let agentTaskSpec: AgentTaskSpec | null = null;

  if (family === AGENT_TASK_FAMILY) {
    const validation = AgentTaskSpecSchema.safeParse({
      taskPrompt: String(healedSpec.taskPrompt ?? healedSpec.task_prompt ?? ""),
      judgeRubric: String(
        healedSpec.judgeRubric ?? healedSpec.judge_rubric ?? healedSpec.rubric ?? "",
      ),
      outputFormat: healedSpec.outputFormat ?? healedSpec.output_format ?? "free_text",
      judgeModel: healedSpec.judgeModel ?? healedSpec.judge_model ?? "",
      difficultyTiers: healedSpec.difficultyTiers ?? healedSpec.difficulty_tiers ?? null,
      referenceContext: healedSpec.referenceContext ?? healedSpec.reference_context ?? null,
      referenceSources: healedSpec.referenceSources ?? healedSpec.reference_sources ?? null,
      requiredConcepts: healedSpec.requiredConcepts ?? healedSpec.required_concepts ?? null,
      calibrationExamples:
        healedSpec.calibrationExamples ?? healedSpec.calibration_examples ?? null,
      contextPreparation:
        healedSpec.contextPreparation ?? healedSpec.context_preparation ?? null,
      requiredContextKeys:
        healedSpec.requiredContextKeys ?? healedSpec.required_context_keys ?? null,
      maxRounds: healedSpec.maxRounds ?? healedSpec.max_rounds ?? 1,
      qualityThreshold:
        healedSpec.qualityThreshold ?? healedSpec.quality_threshold ?? 0.9,
      revisionPrompt: healedSpec.revisionPrompt ?? healedSpec.revision_prompt ?? null,
      sampleInput: healedSpec.sampleInput ?? healedSpec.sample_input ?? null,
    });

    if (!validation.success) {
      errors.push(
        ...validation.error.issues.map((issue) => `agent_task spec validation: ${issue.message}`),
      );
    } else {
      agentTaskSpec = validation.data;
      persistedSpec = {
        ...persistedSpec,
        taskPrompt: agentTaskSpec.taskPrompt,
        judgeRubric: agentTaskSpec.judgeRubric,
        rubric: agentTaskSpec.judgeRubric,
        outputFormat: agentTaskSpec.outputFormat,
        judgeModel: agentTaskSpec.judgeModel,
        difficultyTiers: agentTaskSpec.difficultyTiers ?? null,
        referenceContext: agentTaskSpec.referenceContext ?? null,
        referenceSources: agentTaskSpec.referenceSources ?? null,
        requiredConcepts: agentTaskSpec.requiredConcepts ?? null,
        calibrationExamples: agentTaskSpec.calibrationExamples ?? null,
        contextPreparation: agentTaskSpec.contextPreparation ?? null,
        requiredContextKeys: agentTaskSpec.requiredContextKeys ?? null,
        maxRounds: agentTaskSpec.maxRounds,
        qualityThreshold: agentTaskSpec.qualityThreshold,
        revisionPrompt: agentTaskSpec.revisionPrompt ?? null,
        sampleInput: agentTaskSpec.sampleInput ?? null,
      };
    }
  } else if (hasCodegen(family)) {
    try {
      source = generateScenarioSource(family as ScenarioFamilyName, healedSpec, name);
      const validation = await validateGeneratedScenario(source, family, name);
      if (!validation.valid) {
        errors.push(...validation.errors.map((e) => `codegen validation: ${e}`));
      } else {
        generatedSource = true;
      }
    } catch (err) {
      errors.push(`codegen failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else {
    errors.push(`custom scenario materialization is not supported for family '${family}'`);
  }

  if (errors.length > 0) {
    return {
      persisted: false,
      generatedSource: false,
      scenarioDir,
      family,
      name,
      errors,
    };
  }

  if (!existsSync(scenarioDir)) {
    mkdirSync(scenarioDir, { recursive: true });
  }

  // 1. Write scenario_type.txt
  writeFileSync(join(scenarioDir, "scenario_type.txt"), scenarioType, "utf-8");

  // 2. Write spec.json (full spec)
  writeFileSync(
    join(scenarioDir, "spec.json"),
    JSON.stringify(persistedSpec, null, 2),
    "utf-8",
  );

  // 3. Write agent_task_spec.json for agent_task (custom-loader compat)
  if (family === AGENT_TASK_FAMILY && agentTaskSpec) {
    writeFileSync(
      join(scenarioDir, "agent_task_spec.json"),
      JSON.stringify(
        {
          task_prompt: agentTaskSpec.taskPrompt,
          judge_rubric: agentTaskSpec.judgeRubric,
          output_format: agentTaskSpec.outputFormat,
          judge_model: agentTaskSpec.judgeModel,
          max_rounds: agentTaskSpec.maxRounds,
          quality_threshold: agentTaskSpec.qualityThreshold,
          revision_prompt: agentTaskSpec.revisionPrompt ?? null,
          sample_input: agentTaskSpec.sampleInput ?? null,
          reference_context: agentTaskSpec.referenceContext ?? null,
          reference_sources: agentTaskSpec.referenceSources ?? null,
          required_concepts: agentTaskSpec.requiredConcepts ?? null,
          calibration_examples: agentTaskSpec.calibrationExamples ?? null,
          context_preparation: agentTaskSpec.contextPreparation ?? null,
          required_context_keys: agentTaskSpec.requiredContextKeys ?? null,
          difficulty_tiers: agentTaskSpec.difficultyTiers ?? null,
        },
        null,
        2,
      ),
      "utf-8",
    );
    rmSync(join(scenarioDir, "scenario.js"), { force: true });
  } else if (source) {
    rmSync(join(scenarioDir, "agent_task_spec.json"), { force: true });
    writeFileSync(join(scenarioDir, "scenario.js"), source, "utf-8");
  }

  return {
    persisted: true,
    generatedSource,
    scenarioDir,
    family,
    name,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function coerceFamily(family: string): ScenarioFamilyName {
  const valid: ScenarioFamilyName[] = [
    "game", "agent_task", "simulation", "artifact_editing", "investigation",
    "workflow", "negotiation", "schema_evolution", "tool_fragility",
    "operator_loop", "coordination",
  ];
  if (valid.includes(family as ScenarioFamilyName)) return family as ScenarioFamilyName;
  return "agent_task";
}
