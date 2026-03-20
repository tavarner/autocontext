/**
 * Agent orchestrator — dispatches roles in sequence (AC-345 Task 18).
 * Mirrors Python's autocontext/agents/orchestrator.py (simplified).
 *
 * Competitor → Translator (implicit) → [Analyst, Coach, Architect] in parallel.
 */

import type { LLMProvider } from "../types/index.js";
import {
  parseAnalystOutput,
  parseArchitectOutput,
  parseCoachOutput,
  parseCompetitorOutput,
} from "./roles.js";
import type {
  AnalystOutput,
  ArchitectOutput,
  CoachOutput,
  CompetitorOutput,
} from "./roles.js";

export interface GenerationPrompts {
  competitorPrompt: string;
  analystPrompt: string;
  coachPrompt: string;
  architectPrompt?: string;
}

export interface GenerationResult {
  competitorOutput: CompetitorOutput;
  analystOutput: AnalystOutput;
  coachOutput: CoachOutput;
  architectOutput: ArchitectOutput;
}

export class AgentOrchestrator {
  private provider: LLMProvider;

  constructor(provider: LLMProvider) {
    this.provider = provider;
  }

  async runGeneration(prompts: GenerationPrompts): Promise<GenerationResult> {
    // Phase 1: Competitor
    const competitorResult = await this.provider.complete({
      systemPrompt: "",
      userPrompt: prompts.competitorPrompt,
    });
    let strategy: Record<string, unknown> = {};
    try {
      strategy = JSON.parse(competitorResult.text);
    } catch {
      strategy = { raw: competitorResult.text };
    }
    const competitorOutput = parseCompetitorOutput(competitorResult.text, strategy);

    // Phase 2: Analyst, Coach, Architect in parallel
    const [analystResult, coachResult, architectResult] = await Promise.all([
      this.provider.complete({
        systemPrompt: "",
        userPrompt: prompts.analystPrompt,
      }),
      this.provider.complete({
        systemPrompt: "",
        userPrompt: prompts.coachPrompt,
      }),
      prompts.architectPrompt
        ? this.provider.complete({
            systemPrompt: "",
            userPrompt: prompts.architectPrompt,
          })
        : Promise.resolve({ text: "", usage: {} }),
    ]);

    return {
      competitorOutput,
      analystOutput: parseAnalystOutput(analystResult.text),
      coachOutput: parseCoachOutput(coachResult.text),
      architectOutput: parseArchitectOutput(architectResult.text),
    };
  }
}
