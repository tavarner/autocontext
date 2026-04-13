import type { AgentTaskSpec } from "./agent-task-spec.js";
import { buildAgentTaskPersistedSpecFields } from "./materialize-agent-task-planning.js";

export function buildAgentTaskValidationErrors(messages: string[]): string[] {
  return messages.map((message) => `agent_task spec validation: ${message}`);
}

export function buildInvalidAgentTaskMaterializationResult(opts: {
  persistedSpec: Record<string, unknown>;
  messages: string[];
}): {
  persistedSpec: Record<string, unknown>;
  agentTaskSpec: AgentTaskSpec | null;
  source: string | null;
  generatedSource: boolean;
  errors: string[];
} {
  return {
    persistedSpec: opts.persistedSpec,
    agentTaskSpec: null,
    source: null,
    generatedSource: false,
    errors: buildAgentTaskValidationErrors(opts.messages),
  };
}

export function buildSuccessfulAgentTaskMaterializationResult(opts: {
  persistedSpec: Record<string, unknown>;
  agentTaskSpec: AgentTaskSpec;
}): {
  persistedSpec: Record<string, unknown>;
  agentTaskSpec: AgentTaskSpec;
  source: string | null;
  generatedSource: boolean;
  errors: string[];
} {
  return {
    persistedSpec: {
      ...opts.persistedSpec,
      ...buildAgentTaskPersistedSpecFields(opts.agentTaskSpec),
    },
    agentTaskSpec: opts.agentTaskSpec,
    source: null,
    generatedSource: false,
    errors: [],
  };
}
