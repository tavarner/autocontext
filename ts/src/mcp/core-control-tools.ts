import { z } from "zod";

import type { LLMProvider } from "../types/index.js";
import { LLMJudge } from "../judge/llm-judge.js";
import {
  DelegatedJudge,
  SequentialDelegatedJudge,
  type DelegatedResult,
} from "../judge/delegated.js";
import { ImprovementLoop } from "../execution/improvement-loop.js";
import { enqueueTask, SimpleAgentTask } from "../execution/task-runner.js";
import type { SQLiteStore, TaskQueueRow } from "../storage/index.js";
import { runAgentTaskRlmSession } from "../rlm/agent-task.js";
import { getCapabilities } from "./capabilities.js";

interface JsonToolResponse {
  content: Array<{
    type: "text";
    text: string;
  }>;
}

type McpToolRegistrar = {
  tool: (...args: any[]) => unknown;
};

interface JudgeLike {
  evaluate(input: {
    taskPrompt: string;
    agentOutput: string;
    referenceContext?: string;
    requiredConcepts?: string[];
  }): Promise<{
    score: number;
    reasoning: string;
    dimensionScores?: Record<string, number>;
  }>;
}

interface AgentTaskLike {
  generateOutput(input: {
    referenceContext?: string;
    requiredConcepts?: string[];
  }): Promise<string>;
  getRlmSessions(): unknown[];
}

interface ImprovementLoopLike {
  run(input: {
    initialOutput: string;
    state: Record<string, unknown>;
    referenceContext?: string;
    requiredConcepts?: string[];
  }): Promise<{
    totalRounds: number;
    metThreshold: boolean;
    bestScore: number;
    bestRound: number;
    judgeFailures: number;
    rounds: Array<{
      roundNumber: number;
      score: number;
      isRevision: boolean;
      judgeFailed: boolean;
      reasoning: string;
    }>;
    bestOutput: string;
  }>;
}

interface CoreControlToolInternals {
  createJudge(args: {
    provider: LLMProvider;
    model: string;
    rubric: string;
  }): JudgeLike;
  createDelegatedJudge(result: DelegatedResult, rubric: string): JudgeLike;
  createSequentialDelegatedJudge(
    results: DelegatedResult[],
    rubric: string,
  ): unknown;
  createAgentTask(args: {
    taskPrompt: string;
    rubric: string;
    provider: LLMProvider;
    model: string;
    delegatedJudge?: unknown;
    rlm: {
      enabled: boolean;
      model?: string;
      maxTurns?: number;
      maxTokensPerTurn?: number;
      temperature?: number;
      maxStdoutChars?: number;
      codeTimeoutMs?: number;
      memoryLimitMb?: number;
    };
  }): AgentTaskLike;
  createImprovementLoop(args: {
    task: AgentTaskLike;
    maxRounds: number;
    qualityThreshold: number;
  }): ImprovementLoopLike;
  runReplSession(args: {
    provider: LLMProvider;
    model: string;
    config: {
      enabled: true;
      model?: string;
      maxTurns: number;
      maxTokensPerTurn: number;
      temperature: number;
      maxStdoutChars: number;
      codeTimeoutMs: number;
      memoryLimitMb: number;
    };
    phase: "generate" | "revise";
    taskPrompt: string;
    rubric: string;
    currentOutput?: string;
    referenceContext?: string;
    requiredConcepts?: string[];
  }): Promise<Record<string, unknown>>;
  enqueueTask: typeof enqueueTask;
  getCapabilities(): Record<string, unknown>;
}

const defaultInternals: CoreControlToolInternals = {
  createJudge: ({ provider, model, rubric }) =>
    new LLMJudge({ provider, model, rubric }),
  createDelegatedJudge: (result, rubric) =>
    new DelegatedJudge(result, rubric),
  createSequentialDelegatedJudge: (results, rubric) =>
    new SequentialDelegatedJudge(results, rubric),
  createAgentTask: ({ taskPrompt, rubric, provider, model, delegatedJudge, rlm }) =>
    new SimpleAgentTask(
      taskPrompt,
      rubric,
      provider,
      model,
      undefined,
      rlm,
      delegatedJudge as unknown as ConstructorParameters<typeof SimpleAgentTask>[6],
    ) as unknown as AgentTaskLike,
  createImprovementLoop: ({ task, maxRounds, qualityThreshold }) =>
    new ImprovementLoop({
      task: task as unknown as ConstructorParameters<typeof ImprovementLoop>[0]["task"],
      maxRounds,
      qualityThreshold,
    }) as unknown as ImprovementLoopLike,
  runReplSession: runAgentTaskRlmSession,
  enqueueTask,
  getCapabilities: () => getCapabilities() as unknown as Record<string, unknown>,
};

export const DelegatedResultArgSchema = z.object({
  score: z.number().min(0).max(1),
  reasoning: z.string(),
  dimensionScores: z.record(z.number().min(0).max(1)).optional(),
});

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

function buildTaskResultPayload(task: TaskQueueRow): Record<string, unknown> {
  const result: Record<string, unknown> = {
    id: task.id,
    specName: task.spec_name,
    status: task.status,
    priority: task.priority,
    createdAt: task.created_at,
  };

  if (task.status === "completed") {
    result.bestScore = task.best_score;
    result.totalRounds = task.total_rounds;
    result.metThreshold = !!task.met_threshold;
    result.bestOutput = task.best_output;
    result.completedAt = task.completed_at;
  } else if (task.status === "failed") {
    result.error = task.error;
  }

  return result;
}

export function registerCoreControlPlaneTools(
  server: McpToolRegistrar,
  opts: {
    store: Pick<SQLiteStore, "pendingTaskCount" | "getTask">;
    provider: LLMProvider;
    model?: string;
    internals?: Partial<CoreControlToolInternals>;
  },
): void {
  const model = opts.model ?? "";
  const internals: CoreControlToolInternals = {
    ...defaultInternals,
    ...opts.internals,
  };

  server.tool(
    "evaluate_output",
    "One-shot evaluation of output against a rubric",
    {
      taskPrompt: z.string().describe("The task the agent was given"),
      agentOutput: z.string().describe("The agent's output to evaluate"),
      rubric: z.string().describe("Evaluation rubric"),
      referenceContext: z.string().optional().describe("Authoritative reference for fact-checking"),
      requiredConcepts: z.array(z.string()).optional().describe("Concepts the output must address"),
      delegatedResult: DelegatedResultArgSchema.optional().describe("Pre-computed evaluation from the calling agent"),
    },
    async (args: Record<string, unknown>) => {
      const judge = args.delegatedResult
        ? internals.createDelegatedJudge(args.delegatedResult as DelegatedResult, args.rubric as string)
        : internals.createJudge({
            provider: opts.provider,
            model,
            rubric: args.rubric as string,
          });
      const result = await judge.evaluate({
        taskPrompt: args.taskPrompt as string,
        agentOutput: args.agentOutput as string,
        referenceContext: args.referenceContext as string | undefined,
        requiredConcepts: args.requiredConcepts as string[] | undefined,
      });
      return jsonText(
        {
          score: result.score,
          reasoning: result.reasoning,
          dimensionScores: result.dimensionScores,
        },
        2,
      );
    },
  );

  server.tool(
    "run_improvement_loop",
    "Run multi-round improvement loop on agent output",
    {
      taskPrompt: z.string().describe("The task prompt"),
      rubric: z.string().describe("Evaluation rubric"),
      initialOutput: z.string().optional().describe("Starting output to improve"),
      maxRounds: z.number().int().default(5).describe("Maximum improvement rounds"),
      qualityThreshold: z.number().default(0.9).describe("Score threshold to stop"),
      referenceContext: z.string().optional(),
      requiredConcepts: z.array(z.string()).optional(),
      delegatedResults: z.array(DelegatedResultArgSchema).optional()
        .describe("Pre-computed per-round evaluations from the calling agent"),
      rlmEnabled: z.boolean().optional().describe("Use REPL-loop mode for generation and revisions"),
      rlmModel: z.string().optional().describe("Optional model override for REPL-loop mode"),
      rlmMaxTurns: z.number().int().positive().optional(),
      rlmMaxTokensPerTurn: z.number().int().positive().optional(),
      rlmTemperature: z.number().min(0).max(2).optional(),
      rlmMaxStdoutChars: z.number().int().positive().optional(),
      rlmCodeTimeoutMs: z.number().int().positive().optional(),
      rlmMemoryLimitMb: z.number().int().positive().optional(),
    },
    async (args: Record<string, unknown>) => {
      const delegatedJudge = Array.isArray(args.delegatedResults) && args.delegatedResults.length > 0
        ? internals.createSequentialDelegatedJudge(
            args.delegatedResults as DelegatedResult[],
            args.rubric as string,
          )
        : undefined;
      const task = internals.createAgentTask({
        taskPrompt: args.taskPrompt as string,
        rubric: args.rubric as string,
        provider: opts.provider,
        model,
        delegatedJudge,
        rlm: {
          enabled: (args.rlmEnabled as boolean | undefined) ?? false,
          model: args.rlmModel as string | undefined,
          maxTurns: args.rlmMaxTurns as number | undefined,
          maxTokensPerTurn: args.rlmMaxTokensPerTurn as number | undefined,
          temperature: args.rlmTemperature as number | undefined,
          maxStdoutChars: args.rlmMaxStdoutChars as number | undefined,
          codeTimeoutMs: args.rlmCodeTimeoutMs as number | undefined,
          memoryLimitMb: args.rlmMemoryLimitMb as number | undefined,
        },
      });
      const initialOutput = typeof args.initialOutput === "string"
        ? args.initialOutput
        : await task.generateOutput({
            referenceContext: args.referenceContext as string | undefined,
            requiredConcepts: args.requiredConcepts as string[] | undefined,
          });
      const loop = internals.createImprovementLoop({
        task,
        maxRounds: args.maxRounds as number,
        qualityThreshold: args.qualityThreshold as number,
      });
      const result = await loop.run({
        initialOutput,
        state: {},
        referenceContext: args.referenceContext as string | undefined,
        requiredConcepts: args.requiredConcepts as string[] | undefined,
      });
      const rlmSessions = task.getRlmSessions();

      return jsonText(
        {
          totalRounds: result.totalRounds,
          metThreshold: result.metThreshold,
          bestScore: result.bestScore,
          bestRound: result.bestRound,
          judgeFailures: result.judgeFailures,
          rounds: result.rounds.map((round) => ({
            round: round.roundNumber,
            score: round.score,
            isRevision: round.isRevision,
            judgeFailed: round.judgeFailed,
            reasoningPreview: round.reasoning.slice(0, 200),
          })),
          bestOutputPreview: result.bestOutput.slice(0, 500),
          ...(rlmSessions.length > 0 ? { rlmSessions } : {}),
        },
        2,
      );
    },
  );

  server.tool(
    "run_repl_session",
    "Run a direct REPL-loop session for agent-task generation or revision",
    {
      taskPrompt: z.string().describe("The task prompt"),
      rubric: z.string().describe("Evaluation rubric"),
      phase: z.enum(["generate", "revise"]).default("generate"),
      currentOutput: z.string().optional().describe("Current output when revising"),
      referenceContext: z.string().optional(),
      requiredConcepts: z.array(z.string()).optional(),
      rlmModel: z.string().optional().describe("Optional model override for REPL-loop mode"),
      rlmMaxTurns: z.number().int().positive().optional(),
      rlmMaxTokensPerTurn: z.number().int().positive().optional(),
      rlmTemperature: z.number().min(0).max(2).optional(),
      rlmMaxStdoutChars: z.number().int().positive().optional(),
      rlmCodeTimeoutMs: z.number().int().positive().optional(),
      rlmMemoryLimitMb: z.number().int().positive().optional(),
    },
    async (args: Record<string, unknown>) => {
      if (args.phase === "revise" && !args.currentOutput) {
        return jsonText({ error: "currentOutput is required when phase=revise" }, 2);
      }

      const result = await internals.runReplSession({
        provider: opts.provider,
        model,
        config: {
          enabled: true,
          model: args.rlmModel as string | undefined,
          maxTurns: (args.rlmMaxTurns as number | undefined) ?? 6,
          maxTokensPerTurn: (args.rlmMaxTokensPerTurn as number | undefined) ?? 2048,
          temperature: (args.rlmTemperature as number | undefined) ?? 0.2,
          maxStdoutChars: (args.rlmMaxStdoutChars as number | undefined) ?? 8192,
          codeTimeoutMs: (args.rlmCodeTimeoutMs as number | undefined) ?? 10000,
          memoryLimitMb: (args.rlmMemoryLimitMb as number | undefined) ?? 64,
        },
        phase: args.phase as "generate" | "revise",
        taskPrompt: args.taskPrompt as string,
        rubric: args.rubric as string,
        currentOutput: args.currentOutput as string | undefined,
        referenceContext: args.referenceContext as string | undefined,
        requiredConcepts: args.requiredConcepts as string[] | undefined,
      });

      return jsonText(result, 2);
    },
  );

  server.tool(
    "queue_task",
    "Add a task to the background runner queue",
    {
      specName: z.string().describe("Task spec name / identifier"),
      taskPrompt: z.string().optional(),
      rubric: z.string().optional(),
      initialOutput: z.string().optional(),
      delegatedResults: z.array(DelegatedResultArgSchema).optional(),
      maxRounds: z.number().int().optional(),
      qualityThreshold: z.number().optional(),
      priority: z.number().int().default(0),
      rlmEnabled: z.boolean().optional(),
      rlmModel: z.string().optional(),
      rlmMaxTurns: z.number().int().positive().optional(),
      rlmMaxTokensPerTurn: z.number().int().positive().optional(),
      rlmTemperature: z.number().min(0).max(2).optional(),
      rlmMaxStdoutChars: z.number().int().positive().optional(),
      rlmCodeTimeoutMs: z.number().int().positive().optional(),
      rlmMemoryLimitMb: z.number().int().positive().optional(),
    },
    async (args: Record<string, unknown>) => {
      const taskId = internals.enqueueTask(opts.store as SQLiteStore, args.specName as string, {
        taskPrompt: args.taskPrompt as string | undefined,
        rubric: args.rubric as string | undefined,
        initialOutput: args.initialOutput as string | undefined,
        delegatedResults: args.delegatedResults as DelegatedResult[] | undefined,
        maxRounds: args.maxRounds as number | undefined,
        qualityThreshold: args.qualityThreshold as number | undefined,
        priority: args.priority as number,
        rlmEnabled: args.rlmEnabled as boolean | undefined,
        rlmModel: args.rlmModel as string | undefined,
        rlmMaxTurns: args.rlmMaxTurns as number | undefined,
        rlmMaxTokensPerTurn: args.rlmMaxTokensPerTurn as number | undefined,
        rlmTemperature: args.rlmTemperature as number | undefined,
        rlmMaxStdoutChars: args.rlmMaxStdoutChars as number | undefined,
        rlmCodeTimeoutMs: args.rlmCodeTimeoutMs as number | undefined,
        rlmMemoryLimitMb: args.rlmMemoryLimitMb as number | undefined,
      });
      return jsonText({ taskId, specName: args.specName, status: "queued" });
    },
  );

  server.tool(
    "get_queue_status",
    "Get task queue status summary",
    {},
    async () => jsonText({ pendingCount: opts.store.pendingTaskCount() }),
  );

  server.tool(
    "get_task_result",
    "Get the result of a queued task by ID",
    {
      taskId: z.string().describe("Task ID to look up"),
    },
    async (args: Record<string, unknown>) => {
      const task = opts.store.getTask(args.taskId as string);
      if (!task) {
        return jsonText({ error: "Task not found" });
      }
      return jsonText(buildTaskResultPayload(task), 2);
    },
  );

  server.tool(
    "capabilities",
    "Return capability metadata for this autocontext instance",
    {},
    async () => jsonText(internals.getCapabilities(), 2),
  );
}
