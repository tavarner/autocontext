import { z } from "zod";

import type { LLMProvider } from "../types/index.js";
import { ArtifactStore } from "../knowledge/artifact-store.js";
import { GenerationRunner } from "../loop/generation-runner.js";
import { assertFamilyContract } from "../scenarios/family-interfaces.js";
import { SCENARIO_REGISTRY } from "../scenarios/registry.js";
import type { SQLiteStore } from "../storage/index.js";

interface JsonToolResponse {
  content: Array<{
    type: "text";
    text: string;
  }>;
}

type McpToolRegistrar = {
  tool: (...args: any[]) => unknown;
};

type ScenarioLike = object;
type ScenarioConstructor = new () => ScenarioLike;
type ScenarioRegistry = Record<string, ScenarioConstructor>;

interface GenerationLike {
  generation_index: number;
  [key: string]: unknown;
}

interface AgentOutputLike {
  role: string;
  content: string;
}

interface RunControlSettings {
  maxRetries: number;
  backpressureMinDelta: number;
  playbookMaxVersions: number;
  contextBudgetTokens: number;
  curatorEnabled: boolean;
  curatorConsolidateEveryNGens: number;
  skillMaxLessons: number;
  deadEndTrackingEnabled: boolean;
  deadEndMaxEntries: number;
  stagnationResetEnabled: boolean;
  stagnationRollbackThreshold: number;
  stagnationPlateauWindow: number;
  stagnationPlateauEpsilon: number;
  stagnationDistillTopLessons: number;
  explorationMode: string;
  notifyWebhookUrl?: string | null;
  notifyOn?: string;
}

interface RunManagementInternals {
  createArtifactStore(opts: { runsRoot: string; knowledgeRoot: string }): {
    readPlaybook(scenarioName: string): string;
  };
  loadScenarioRegistry(): ScenarioRegistry;
  assertFamilyContract(scenario: ScenarioLike, family: "game", label: string): void;
  createRunner(args: {
    provider: LLMProvider;
    scenario: ScenarioLike;
    store: SQLiteStore;
    runsRoot: string;
    knowledgeRoot: string;
    matchesPerGeneration: number;
    settings: RunControlSettings;
  }): {
    run(runId: string, generations: number): Promise<unknown>;
  };
  createRunId(): string;
}

const defaultInternals: RunManagementInternals = {
  createArtifactStore: (opts) => new ArtifactStore(opts),
  loadScenarioRegistry: () => SCENARIO_REGISTRY as unknown as ScenarioRegistry,
  assertFamilyContract,
  createRunner: (args) =>
    new GenerationRunner({
      provider: args.provider,
      scenario: args.scenario as ConstructorParameters<typeof GenerationRunner>[0]["scenario"],
      store: args.store,
      runsRoot: args.runsRoot,
      knowledgeRoot: args.knowledgeRoot,
      matchesPerGeneration: args.matchesPerGeneration,
      maxRetries: args.settings.maxRetries,
      minDelta: args.settings.backpressureMinDelta,
      playbookMaxVersions: args.settings.playbookMaxVersions,
      contextBudgetTokens: args.settings.contextBudgetTokens,
      curatorEnabled: args.settings.curatorEnabled,
      curatorConsolidateEveryNGens: args.settings.curatorConsolidateEveryNGens,
      skillMaxLessons: args.settings.skillMaxLessons,
      deadEndTrackingEnabled: args.settings.deadEndTrackingEnabled,
      deadEndMaxEntries: args.settings.deadEndMaxEntries,
      stagnationResetEnabled: args.settings.stagnationResetEnabled,
      stagnationRollbackThreshold: args.settings.stagnationRollbackThreshold,
      stagnationPlateauWindow: args.settings.stagnationPlateauWindow,
      stagnationPlateauEpsilon: args.settings.stagnationPlateauEpsilon,
      stagnationDistillTopLessons: args.settings.stagnationDistillTopLessons,
      explorationMode: args.settings.explorationMode,
      notifyWebhookUrl: args.settings.notifyWebhookUrl,
      notifyOn: args.settings.notifyOn,
    }),
  createRunId: () => `mcp-${Date.now()}`,
};

function jsonText(payload: unknown, indent?: number): JsonToolResponse {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, indent),
      },
    ],
  };
}

export function buildRunNotFoundPayload(): { error: string } {
  return { error: "Run not found" };
}

export function buildGenerationNotFoundPayload(): { error: string } {
  return { error: "Generation not found" };
}

export function buildRunScenarioUnknownPayload(scenarioName: string): { error: string } {
  return { error: `Unknown scenario: ${scenarioName}` };
}

export function registerRunManagementTools(
  server: McpToolRegistrar,
  opts: {
    store: SQLiteStore;
    provider: LLMProvider;
    runsRoot: string;
    knowledgeRoot: string;
    settings: RunControlSettings;
    internals?: Partial<RunManagementInternals>;
  },
): void {
  const internals: RunManagementInternals = {
    ...defaultInternals,
    ...opts.internals,
  };

  server.tool(
    "list_runs",
    "List recent runs with optional filters",
    {
      limit: z.number().int().default(50).describe("Max runs to return"),
      scenario: z.string().optional().describe("Filter by scenario name"),
    },
    async (args: Record<string, unknown>) =>
      jsonText(
        {
          runs: opts.store.listRuns(args.limit as number, args.scenario as string | undefined),
        },
        2,
      ),
  );

  server.tool(
    "get_run_status",
    "Get run progress, scores, and generation details",
    {
      runId: z.string().describe("Run ID"),
    },
    async (args: Record<string, unknown>) => {
      const run = opts.store.getRun(args.runId as string);
      if (!run) {
        return jsonText(buildRunNotFoundPayload());
      }

      return jsonText(
        {
          ...run,
          generations: opts.store.getGenerations(args.runId as string),
        },
        2,
      );
    },
  );

  server.tool(
    "get_playbook",
    "Read the accumulated playbook for a scenario",
    {
      scenario: z.string().describe("Scenario name"),
    },
    async (args: Record<string, unknown>) => {
      const artifacts = internals.createArtifactStore({
        runsRoot: opts.runsRoot,
        knowledgeRoot: opts.knowledgeRoot,
      });

      return jsonText(
        {
          scenario: args.scenario,
          content: artifacts.readPlaybook(args.scenario as string),
        },
        2,
      );
    },
  );

  server.tool(
    "run_scenario",
    "Kick off a scenario run with configuration options",
    {
      scenario: z.string().describe("Scenario name"),
      generations: z.number().int().default(1).describe("Number of generations"),
      runId: z.string().optional().describe("Custom run ID"),
      matchesPerGeneration: z.number().int().default(3).describe("Matches per generation"),
    },
    async (args: Record<string, unknown>) => {
      const registry = internals.loadScenarioRegistry();
      const ScenarioClass = registry[args.scenario as string];
      if (!ScenarioClass) {
        return jsonText(buildRunScenarioUnknownPayload(args.scenario as string));
      }

      const runId = (args.runId as string | undefined) ?? internals.createRunId();
      const scenario = new ScenarioClass();
      internals.assertFamilyContract(scenario, "game", `scenario '${args.scenario as string}'`);
      const runner = internals.createRunner({
        provider: opts.provider,
        scenario,
        store: opts.store,
        runsRoot: opts.runsRoot,
        knowledgeRoot: opts.knowledgeRoot,
        matchesPerGeneration: args.matchesPerGeneration as number,
        settings: opts.settings,
      });

      runner.run(runId, args.generations as number).catch(() => {});

      return jsonText({
        runId,
        scenario: args.scenario,
        generations: args.generations,
        status: "started",
      });
    },
  );

  server.tool(
    "get_generation_detail",
    "Get detailed results for a specific generation",
    {
      runId: z.string().describe("Run ID"),
      generation: z.number().int().describe("Generation index"),
    },
    async (args: Record<string, unknown>) => {
      const generations = opts.store.getGenerations(args.runId as string) as unknown as GenerationLike[];
      const generation = generations.find((entry) => entry.generation_index === (args.generation as number));
      if (!generation) {
        return jsonText(buildGenerationNotFoundPayload());
      }

      const agentOutputs = opts.store.getAgentOutputs(
        args.runId as string,
        args.generation as number,
      ) as unknown as AgentOutputLike[];

      return jsonText(
        {
          generation,
          matches: opts.store.getMatchesForGeneration(args.runId as string, args.generation as number),
          agentOutputs: agentOutputs.map((output) => ({
            role: output.role,
            contentPreview: output.content.slice(0, 500),
          })),
        },
        2,
      );
    },
  );
}
