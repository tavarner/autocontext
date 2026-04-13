import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

import { ArtifactStore } from "../knowledge/artifact-store.js";
import { exportStrategyPackage } from "../knowledge/package.js";
import { ScoreTrajectoryBuilder, type TrajectoryRow } from "../knowledge/trajectory.js";
import { extractDelimitedSection } from "../agents/roles.js";
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

type AgentOutputRow = {
  role: string;
  content: string;
};

type GenerationRow = {
  generation_index: number;
  best_score: number;
};

type RunRow = {
  run_id: string;
  scenario: string;
};

interface KnowledgeReadbackInternals {
  createArtifactStore(opts: { runsRoot: string; knowledgeRoot: string }): Pick<ArtifactStore, "readPlaybook">;
  extractDelimitedSection(content: string, startMarker: string, endMarker: string): string | null;
  exportStrategyPackage(opts: {
    scenarioName: string;
    artifacts: ArtifactStore;
    store: SQLiteStore;
  }): Record<string, unknown>;
  buildTrajectory(rows: TrajectoryRow[]): string;
}

const defaultInternals: KnowledgeReadbackInternals = {
  createArtifactStore: (opts) => new ArtifactStore(opts),
  extractDelimitedSection,
  exportStrategyPackage,
  buildTrajectory: (rows) => new ScoreTrajectoryBuilder(rows).build(),
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

export function registerKnowledgeReadbackTools(
  server: McpToolRegistrar,
  opts: {
    store: Pick<
      SQLiteStore,
      "getScoreTrajectory" | "getAgentOutputs" | "listRuns" | "getGenerations"
    >;
    runsRoot: string;
    knowledgeRoot: string;
    artifactExportStore: SQLiteStore;
    internals?: Partial<KnowledgeReadbackInternals>;
  },
): void {
  const internals: KnowledgeReadbackInternals = {
    ...defaultInternals,
    ...opts.internals,
  };

  server.tool(
    "read_trajectory",
    "Read the score trajectory for a run as markdown",
    { runId: z.string() },
    async (args: Record<string, unknown>) => {
      const trajectory = opts.store.getScoreTrajectory(args.runId as string) as TrajectoryRow[];
      const markdown = internals.buildTrajectory(trajectory);
      return {
        content: [{ type: "text", text: markdown || "No trajectory data." }],
      };
    },
  );

  server.tool(
    "read_hints",
    "Read competitor hints for a scenario",
    { scenario: z.string() },
    async (args: Record<string, unknown>) => {
      const artifacts = internals.createArtifactStore({
        runsRoot: opts.runsRoot,
        knowledgeRoot: opts.knowledgeRoot,
      });
      const playbook = artifacts.readPlaybook(args.scenario as string);
      const hints = internals.extractDelimitedSection(
        playbook,
        "<!-- COMPETITOR_HINTS_START -->",
        "<!-- COMPETITOR_HINTS_END -->",
      ) ?? "";
      return {
        content: [{ type: "text", text: hints || "No hints available." }],
      };
    },
  );

  server.tool(
    "read_analysis",
    "Read the analyst output for a specific generation",
    { runId: z.string(), generation: z.number().int() },
    async (args: Record<string, unknown>) => {
      const outputs = opts.store.getAgentOutputs(
        args.runId as string,
        args.generation as number,
      ) as AgentOutputRow[];
      const analyst = outputs.find((output) => output.role === "analyst");
      return {
        content: [{ type: "text", text: analyst?.content ?? "No analysis found." }],
      };
    },
  );

  server.tool(
    "read_tools",
    "Read architect-generated tools for a scenario",
    { scenario: z.string() },
    async (args: Record<string, unknown>) => {
      const toolsDir = join(opts.knowledgeRoot, args.scenario as string, "tools");
      if (!existsSync(toolsDir)) {
        return { content: [{ type: "text", text: "No tools directory." }] };
      }
      const tools = readdirSync(toolsDir)
        .filter((name) => name.endsWith(".py") || name.endsWith(".ts"))
        .map((name) => ({
          name,
          code: readFileSync(join(toolsDir, name), "utf-8"),
        }));
      return jsonText(tools, 2);
    },
  );

  server.tool(
    "read_skills",
    "Read skill notes for a scenario",
    { scenario: z.string() },
    async (args: Record<string, unknown>) => {
      const skillPath = join(opts.knowledgeRoot, args.scenario as string, "SKILL.md");
      return {
        content: [{
          type: "text",
          text: existsSync(skillPath)
            ? readFileSync(skillPath, "utf-8")
            : "No skill notes found.",
        }],
      };
    },
  );

  server.tool(
    "export_skill",
    "Export a portable skill package with markdown for agent install",
    { scenario: z.string() },
    async (args: Record<string, unknown>) => {
      const scenarioName = args.scenario as string;
      const artifacts = new ArtifactStore({
        runsRoot: opts.runsRoot,
        knowledgeRoot: opts.knowledgeRoot,
      });
      const pkg = internals.exportStrategyPackage({
        scenarioName,
        artifacts,
        store: opts.artifactExportStore,
      });
      return jsonText(
        {
          ...pkg,
          suggested_filename: `${scenarioName.replace(/_/g, "-")}-knowledge.md`,
        },
        2,
      );
    },
  );

  server.tool(
    "list_solved",
    "List scenarios with exported knowledge or completed runs",
    {},
    async () => {
      const solved: Array<{ scenario: string; hasPlaybook: boolean }> = [];
      if (existsSync(opts.knowledgeRoot)) {
        for (const name of readdirSync(opts.knowledgeRoot)) {
          if (name.startsWith("_")) {
            continue;
          }
          const hasPlaybook = existsSync(join(opts.knowledgeRoot, name, "playbook.md"));
          if (hasPlaybook) {
            solved.push({ scenario: name, hasPlaybook });
          }
        }
      }
      return jsonText(solved, 2);
    },
  );

  server.tool(
    "search_strategies",
    "Search past strategies by keyword",
    { query: z.string(), limit: z.number().int().default(5) },
    async (args: Record<string, unknown>) => {
      const queryLower = (args.query as string).toLowerCase();
      const limit = args.limit as number;
      const runs = opts.store.listRuns(100) as RunRow[];
      const results: Array<{
        runId: string;
        scenario: string;
        generation: number;
        score: number;
        strategy: string;
      }> = [];

      for (const run of runs) {
        const generations = opts.store.getGenerations(run.run_id) as GenerationRow[];
        for (const generation of generations) {
          const outputs = opts.store.getAgentOutputs(
            run.run_id,
            generation.generation_index,
          ) as AgentOutputRow[];
          const competitor = outputs.find((output) => output.role === "competitor");
          if (competitor && competitor.content.toLowerCase().includes(queryLower)) {
            results.push({
              runId: run.run_id,
              scenario: run.scenario,
              generation: generation.generation_index,
              score: generation.best_score,
              strategy: competitor.content.slice(0, 200),
            });
            if (results.length >= limit) {
              break;
            }
          }
        }
        if (results.length >= limit) {
          break;
        }
      }

      return jsonText(results, 2);
    },
  );
}
