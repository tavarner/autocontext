/**
 * Generation runner — core loop (AC-346 Task 21).
 * Mirrors Python's loop/generation_runner.py (simplified).
 *
 * Loop: for each generation:
 *   1. Build prompts from scenario + knowledge
 *   2. Orchestrate agents (competitor → analyst/coach/architect)
 *   3. Extract strategy → run tournament
 *   4. Backpressure gate (advance/retry/rollback)
 *   5. Persist to SQLite + artifacts
 */

import type { LLMProvider } from "../types/index.js";
import type { ScenarioInterface } from "../scenarios/game-interface.js";
import type { SQLiteStore } from "../storage/index.js";
import { TournamentRunner } from "../execution/tournament.js";
import { BackpressureGate } from "./backpressure.js";

export interface GenerationRunnerOpts {
  provider: LLMProvider;
  scenario: ScenarioInterface;
  store: SQLiteStore;
  runsRoot: string;
  knowledgeRoot: string;
  matchesPerGeneration?: number;
  maxRetries?: number;
  minDelta?: number;
  seedBase?: number;
}

export interface RunResult {
  runId: string;
  generationsCompleted: number;
  bestScore: number;
  currentElo: number;
}

export class GenerationRunner {
  private provider: LLMProvider;
  private scenario: ScenarioInterface;
  private store: SQLiteStore;
  private matchesPerGeneration: number;
  private maxRetries: number;
  private gate: BackpressureGate;
  private seedBase: number;

  constructor(opts: GenerationRunnerOpts) {
    this.provider = opts.provider;
    this.scenario = opts.scenario;
    this.store = opts.store;
    this.matchesPerGeneration = opts.matchesPerGeneration ?? 3;
    this.maxRetries = opts.maxRetries ?? 2;
    this.gate = new BackpressureGate(opts.minDelta ?? 0.005);
    this.seedBase = opts.seedBase ?? 1000;
  }

  async run(runId: string, generations: number): Promise<RunResult> {
    // Create run record
    this.store.createRun(runId, this.scenario.name, generations, "local");

    let previousBest = 0;
    let currentElo = 1000;
    let bestScoreOverall = 0;

    for (let gen = 1; gen <= generations; gen++) {
      let retryCount = 0;
      let gateDecision = "advance";

      // Retry loop for this generation
      while (retryCount <= this.maxRetries) {
        // Step 1: Get strategy from provider (competitor role)
        const competitorResult = await this.provider.complete({
          systemPrompt: "",
          userPrompt: `Describe your strategy for the ${this.scenario.name} scenario. Return JSON with the strategy parameters.`,
        });

        let strategy: Record<string, unknown>;
        try {
          strategy = JSON.parse(competitorResult.text);
        } catch {
          strategy = { aggression: 0.5, defense: 0.5, path_bias: 0.5 };
        }

        // Step 2: Run tournament
        const seedForGen = this.seedBase + (gen - 1) * this.matchesPerGeneration;
        const tournament = new TournamentRunner(this.scenario, {
          matchCount: this.matchesPerGeneration,
          seedBase: seedForGen,
          initialElo: currentElo,
        });
        const tournamentResult = tournament.run(strategy);

        // Step 3: Backpressure gate
        const decision = this.gate.evaluate(
          previousBest,
          tournamentResult.bestScore,
          retryCount,
          this.maxRetries,
        );
        gateDecision = decision.decision;

        // Step 4: Persist generation + matches
        this.store.upsertGeneration(runId, gen, {
          meanScore: tournamentResult.meanScore,
          bestScore: tournamentResult.bestScore,
          elo: tournamentResult.elo,
          wins: tournamentResult.wins,
          losses: tournamentResult.losses,
          gateDecision,
          status: "completed",
        });

        for (const match of tournamentResult.matches) {
          this.store.recordMatch(runId, gen, {
            seed: match.seed,
            score: match.score,
            passedValidation: match.passedValidation,
            validationErrors: match.validationErrors.join("; "),
            winner: match.winner ?? "",
          });
        }

        // Store competitor output
        this.store.appendAgentOutput(runId, gen, "competitor", competitorResult.text);

        // Step 5: Apply gate decision
        if (gateDecision === "advance") {
          previousBest = tournamentResult.bestScore;
          currentElo = tournamentResult.elo;
          if (tournamentResult.bestScore > bestScoreOverall) {
            bestScoreOverall = tournamentResult.bestScore;
          }
          break;
        }

        if (gateDecision === "retry") {
          retryCount++;
          continue;
        }

        // rollback — don't update previousBest, move to next gen
        break;
      }

      // Run analyst/coach/architect (fire and forget for now — results stored)
      await this.runSupportRoles(runId, gen);
    }

    return {
      runId,
      generationsCompleted: generations,
      bestScore: bestScoreOverall,
      currentElo,
    };
  }

  private async runSupportRoles(runId: string, gen: number): Promise<void> {
    const [analystResult, coachResult] = await Promise.all([
      this.provider.complete({
        systemPrompt: "",
        userPrompt: `Analyze strengths/failures of the current strategy for ${this.scenario.name}.`,
      }),
      this.provider.complete({
        systemPrompt: "",
        userPrompt: `You are the playbook coach. Update the playbook for ${this.scenario.name}.`,
      }),
    ]);

    this.store.appendAgentOutput(runId, gen, "analyst", analystResult.text);
    this.store.appendAgentOutput(runId, gen, "coach", coachResult.text);
  }
}
