/**
 * Operator-loop scenario creator (AC-432).
 *
 * Creates runnable operator-in-the-loop scenarios from plain-language descriptions.
 * Replaces the previous stub that threw OPERATOR_LOOP_SCAFFOLDING_UNSUPPORTED.
 */

import type { LLMProvider } from "../types/index.js";
import type { OperatorLoopSpec } from "./operator-loop-spec.js";
import { designOperatorLoop } from "./operator-loop-designer.js";
import { generateOperatorLoopSource } from "./codegen/operator-loop-codegen.js";

export interface OperatorLoopCreatorOpts {
  provider: LLMProvider;
  model?: string;
  knowledgeRoot: string;
}

export interface OperatorLoopScenarioHandle {
  family: "operator_loop";
  name: string;
  spec: OperatorLoopSpec;
  /** The generated JS source (ready for secure-exec or eval) */
  generatedSource: string;
}

export class OperatorLoopCreator {
  private provider: LLMProvider;
  private model: string;
  private knowledgeRoot: string;

  constructor(opts: OperatorLoopCreatorOpts) {
    this.provider = opts.provider;
    this.model = opts.model ?? opts.provider.defaultModel();
    this.knowledgeRoot = opts.knowledgeRoot;
  }

  async create(description: string, name: string): Promise<OperatorLoopScenarioHandle> {
    // Design spec from NL description
    // Adapt LLMProvider to the (system, user) => string function signature
    const llmFn = async (system: string, user: string): Promise<string> => {
      const result = await this.provider.complete({ systemPrompt: system, userPrompt: user });
      return result.text;
    };
    const spec = await designOperatorLoop(description, llmFn);

    // Generate executable JS source
    const generatedSource = generateOperatorLoopSource(
      {
        description: spec.description,
        environment_description: spec.environmentDescription,
        initial_state_description: spec.initialStateDescription,
        escalation_policy: spec.escalationPolicy,
        success_criteria: spec.successCriteria,
        failure_modes: spec.failureModes,
        actions: spec.actions,
        max_steps: spec.maxSteps,
      },
      name,
    );

    return {
      family: "operator_loop",
      name,
      spec,
      generatedSource,
    };
  }
}
