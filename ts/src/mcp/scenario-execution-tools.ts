import { z } from "zod";

import { TournamentRunner } from "../execution/tournament.js";

interface JsonToolResponse {
  content: Array<{
    type: "text";
    text: string;
  }>;
}

type McpToolRegistrar = {
  tool: (...args: any[]) => unknown;
};

interface ScenarioExecutionResult {
  score: number;
  winner?: string | null;
  passedValidation?: boolean;
  validationErrors?: string[];
}

interface ScenarioExecutionEntry {
  initialState(seed: number): unknown;
  validateActions(
    state: unknown,
    actor: string,
    strategy: Record<string, unknown>,
  ): [boolean, string];
  executeMatch(
    strategy: Record<string, unknown>,
    seed: number,
  ): ScenarioExecutionResult;
}

type ScenarioExecutionConstructor = new () => ScenarioExecutionEntry;
type ScenarioExecutionRegistry = Record<string, ScenarioExecutionConstructor>;

interface ScenarioExecutionInternals {
  loadScenarioRegistry(): Promise<ScenarioExecutionRegistry>;
  createTournamentRunner(
    scenario: ScenarioExecutionEntry,
    opts: { matchCount: number; seedBase: number },
  ): {
    run(strategy: Record<string, unknown>): {
      meanScore: number;
      bestScore: number;
      elo: number;
      wins: number;
      losses: number;
    };
  };
}

const defaultInternals: ScenarioExecutionInternals = {
  loadScenarioRegistry: async () => {
    const { SCENARIO_REGISTRY } = await import("../scenarios/registry.js");
    return SCENARIO_REGISTRY as unknown as ScenarioExecutionRegistry;
  },
  createTournamentRunner: (scenario, opts) =>
    new TournamentRunner(
      scenario as unknown as ConstructorParameters<typeof TournamentRunner>[0],
      opts,
    ),
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

function resolveScenario(
  registry: ScenarioExecutionRegistry,
  name: string,
): ScenarioExecutionEntry | JsonToolResponse {
  const ScenarioClass = registry[name];
  if (!ScenarioClass) {
    return jsonText({ error: `Unknown scenario: ${name}` });
  }
  return new ScenarioClass();
}

function parseStrategy(strategy: string): Record<string, unknown> | JsonToolResponse {
  try {
    return JSON.parse(strategy) as Record<string, unknown>;
  } catch {
    return jsonText({ error: "Invalid JSON" });
  }
}

export function registerScenarioExecutionTools(
  server: McpToolRegistrar,
  opts?: {
    internals?: Partial<ScenarioExecutionInternals>;
  },
): void {
  const internals: ScenarioExecutionInternals = {
    ...defaultInternals,
    ...opts?.internals,
  };

  server.tool(
    "validate_strategy",
    "Validate a strategy JSON against a scenario's constraints",
    { scenario: z.string(), strategy: z.string() },
    async (args: Record<string, unknown>) => {
      const registry = await internals.loadScenarioRegistry();
      const scenario = resolveScenario(registry, args.scenario as string);
      if ("content" in scenario) {
        return scenario;
      }

      let strategy = parseStrategy(args.strategy as string);
      if ("content" in strategy) {
        return jsonText({ valid: false, reason: "Invalid JSON" });
      }

      const [valid, reason] = scenario.validateActions(
        scenario.initialState(42),
        "challenger",
        strategy,
      );
      return jsonText({ valid, reason });
    },
  );

  server.tool(
    "run_match",
    "Execute a single match for a scenario",
    { scenario: z.string(), strategy: z.string(), seed: z.number().int().default(42) },
    async (args: Record<string, unknown>) => {
      const registry = await internals.loadScenarioRegistry();
      const scenario = resolveScenario(registry, args.scenario as string);
      if ("content" in scenario) {
        return scenario;
      }

      const strategy = parseStrategy(args.strategy as string);
      if ("content" in strategy) {
        return strategy;
      }

      return jsonText(
        scenario.executeMatch(strategy, args.seed as number),
        2,
      );
    },
  );

  server.tool(
    "run_tournament",
    "Run N matches with Elo scoring",
    {
      scenario: z.string(),
      strategy: z.string(),
      matches: z.number().int().default(3),
      seedBase: z.number().int().default(1000),
    },
    async (args: Record<string, unknown>) => {
      const registry = await internals.loadScenarioRegistry();
      const scenario = resolveScenario(registry, args.scenario as string);
      if ("content" in scenario) {
        return scenario;
      }

      const strategy = parseStrategy(args.strategy as string);
      if ("content" in strategy) {
        return strategy;
      }

      const result = internals.createTournamentRunner(scenario, {
        matchCount: args.matches as number,
        seedBase: args.seedBase as number,
      }).run(strategy);

      return jsonText(
        {
          meanScore: result.meanScore,
          bestScore: result.bestScore,
          elo: result.elo,
          wins: result.wins,
          losses: result.losses,
        },
        2,
      );
    },
  );
}
