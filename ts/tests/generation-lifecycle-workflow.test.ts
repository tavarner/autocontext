import { describe, expect, it } from "vitest";

import type { GenerationAttempt } from "../src/loop/generation-attempt-state.js";
import {
  awaitGenerationCompetitorResult,
  awaitGenerationTournamentResult,
  finalizeGenerationAttemptDecision,
} from "../src/loop/generation-attempt-orchestrator.js";
import {
  completeGenerationLifecycleWorkflow,
  createGenerationLifecycleWorkflow,
  runGenerationLifecycleWorkflow,
  type GenerationLifecycleWorkflow,
} from "../src/loop/generation-lifecycle-workflow.js";
import {
  createGenerationLoopOrchestration,
  type GenerationLoopOrchestration,
} from "../src/loop/generation-loop-orchestrator.js";
import type { GenerationLoopEventSequenceItem } from "../src/loop/generation-side-effect-coordinator.js";

function makeAttempt(
  gateDecision: GenerationAttempt["gateDecision"],
  bestScore: number,
  elo = 1000 + bestScore * 100,
): GenerationAttempt {
  return {
    competitorPrompt: "prompt",
    competitorResultText: '{"aggression":0.5}',
    strategy: { aggression: 0.5 },
    tournamentResult: {
      matches: [],
      meanScore: bestScore,
      bestScore,
      wins: 1,
      losses: 0,
      elo,
    },
    gateDecision,
  };
}

describe("generation lifecycle workflow", () => {
  function createRunOrchestration(): GenerationLoopOrchestration {
    return createGenerationLoopOrchestration({
      runId: "run-1",
      scenarioName: "grid_ctf",
      targetGenerations: 2,
      startedAtMs: 100,
    });
  }

  it("runs generation attempts until one finalizes", async () => {
    let attempts = 0;

    const lifecycle = await runGenerationLifecycleWorkflow(
      createGenerationLifecycleWorkflow({
        orchestration: createRunOrchestration(),
        curatorEnabled: false,
        maxRetries: 1,
        runAttempt: async ({
          attemptOrchestration,
          runId,
          generation,
        }: Parameters<GenerationLifecycleWorkflow["runAttempt"]>[0]) => {
          attempts += 1;
          const decision = attempts === 1 ? "retry" : "advance";
          const score = attempts === 1 ? 0.51 : 0.72;
          const next = finalizeGenerationAttemptDecision(
            awaitGenerationTournamentResult(
              awaitGenerationCompetitorResult(attemptOrchestration),
            ),
            {
              runId,
              generation,
              attempt: makeAttempt(decision, score, attempts === 1 ? 1020 : 1088),
              delta: attempts === 1 ? 0.001 : 0.2,
              threshold: 0.005,
            },
          );

          return {
            attemptOrchestration: next,
            events: [
              {
                event: "gate_decided",
                payload: next.events.gateDecided!,
              },
            ],
          };
        },
      }),
    );

    expect(attempts).toBe(2);
    expect(lifecycle.generation).toBe(1);
    expect(lifecycle.finalizedAttempt.gateDecision).toBe("advance");
    expect(lifecycle.orchestration.runState.bestScore).toBe(0.72);
    expect(
      lifecycle.events.map((event: GenerationLoopEventSequenceItem) => event.event),
    ).toEqual([
      "generation_started",
      "agents_started",
      "gate_decided",
      "gate_decided",
    ]);
  });

  it("completes generation lifecycle with stable completion payloads", async () => {
    const lifecycle = await runGenerationLifecycleWorkflow(
      createGenerationLifecycleWorkflow({
        orchestration: createRunOrchestration(),
        curatorEnabled: true,
        maxRetries: 0,
        runAttempt: async ({
          attemptOrchestration,
          runId,
          generation,
        }: Parameters<GenerationLifecycleWorkflow["runAttempt"]>[0]) => {
          const next = finalizeGenerationAttemptDecision(
            awaitGenerationTournamentResult(
              awaitGenerationCompetitorResult(attemptOrchestration),
            ),
            {
              runId,
              generation,
              attempt: makeAttempt("advance", 0.68, 1068),
              delta: 0.18,
              threshold: 0.005,
            },
          );

          return {
            attemptOrchestration: next,
            events: [],
          };
        },
      }),
    );
    const completed = completeGenerationLifecycleWorkflow(lifecycle);

    expect(completed.orchestration.cycleState.completedGenerations).toBe(1);
    expect(completed.orchestration.events.generationCompleted).toEqual({
      run_id: "run-1",
      generation: 1,
      mean_score: 0.68,
      best_score: 0.68,
      elo: 1068,
      gate_decision: "advance",
    });
    expect(
      completed.events.map((event: GenerationLoopEventSequenceItem) => event.event),
    ).toEqual([
      "generation_started",
      "agents_started",
      "generation_completed",
    ]);
  });
});
