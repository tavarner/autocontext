import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

import type { HumanFeedbackRow, SQLiteStore } from "../storage/index.js";

interface JsonToolResponse {
  content: Array<{
    type: "text";
    text: string;
  }>;
}

type McpToolRegistrar = {
  tool: (...args: any[]) => unknown;
};

interface FeedbackReplayInternals {
  readReplayArtifact(runsRoot: string, runId: string, generation: number): Record<string, unknown>;
}

const defaultInternals: FeedbackReplayInternals = {
  readReplayArtifact,
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

export function readReplayArtifact(
  runsRoot: string,
  runId: string,
  generation: number,
): Record<string, unknown> {
  const replayDir = join(
    runsRoot,
    runId,
    "generations",
    `gen_${generation}`,
    "replays",
  );
  if (!existsSync(replayDir)) {
    return { error: `no replay directory for run=${runId} gen=${generation}` };
  }
  const replayFiles = readdirSync(replayDir)
    .filter((name) => name.endsWith(".json"))
    .sort();
  if (replayFiles.length === 0) {
    return { error: `no replay files under ${replayDir}` };
  }

  return JSON.parse(
    readFileSync(join(replayDir, replayFiles[0]), "utf-8"),
  ) as Record<string, unknown>;
}

export function registerFeedbackReplayTools(
  server: McpToolRegistrar,
  opts: {
    store: Pick<SQLiteStore, "insertHumanFeedback" | "getHumanFeedback">;
    runsRoot: string;
    internals?: Partial<FeedbackReplayInternals>;
  },
): void {
  const internals: FeedbackReplayInternals = {
    ...defaultInternals,
    ...opts.internals,
  };

  server.tool(
    "record_feedback",
    "Record human feedback for a scenario evaluation",
    {
      scenario: z.string(),
      agentOutput: z.string(),
      score: z.number().min(0).max(1).optional(),
      notes: z.string().default(""),
      generationId: z.string().optional(),
    },
    async (args: Record<string, unknown>) => {
      const feedbackId = opts.store.insertHumanFeedback(
        args.scenario as string,
        args.agentOutput as string,
        (args.score as number | undefined) ?? null,
        (args.notes as string | undefined) ?? "",
        (args.generationId as string | undefined) ?? null,
      );
      return jsonText({ feedbackId, scenario: args.scenario });
    },
  );

  server.tool(
    "get_feedback",
    "Retrieve human feedback for a scenario",
    {
      scenario: z.string(),
      limit: z.number().int().default(10),
    },
    async (args: Record<string, unknown>) => {
      const feedback = opts.store.getHumanFeedback(
        args.scenario as string,
        args.limit as number,
      ) as HumanFeedbackRow[];
      return jsonText(feedback, 2);
    },
  );

  server.tool(
    "run_replay",
    "Read replay JSON for a specific generation",
    {
      runId: z.string(),
      generation: z.number().int(),
    },
    async (args: Record<string, unknown>) => {
      const payload = internals.readReplayArtifact(
        opts.runsRoot,
        args.runId as string,
        args.generation as number,
      );
      return jsonText(payload, 2);
    },
  );
}
