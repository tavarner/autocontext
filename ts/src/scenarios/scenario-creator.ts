/**
 * NL → Scenario creation flow (AC-348 Task 30).
 * Converts a natural language description into a scenario spec via LLM.
 */

import type { LLMProvider } from "../types/index.js";

export interface CreatedScenarioResult {
  name: string;
  family: string;
  spec: {
    taskPrompt: string;
    rubric: string;
    description: string;
    [key: string]: unknown;
  };
}

/**
 * Derive a snake_case scenario name from a description.
 */
function deriveName(description: string): string {
  return description
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 4)
    .join("_") || "custom_task";
}

/**
 * Detect likely family from description keywords.
 */
function detectFamily(description: string): string {
  const lower = description.toLowerCase();
  const signals: Record<string, string[]> = {
    simulation: ["deploy", "pipeline", "orchestrat", "workflow", "incident", "state machine", "mock api"],
    investigation: ["investigat", "debug", "root cause", "diagnos"],
    workflow: ["step by step", "process", "checklist"],
    negotiation: ["negotiat", "bargain", "trade"],
  };

  for (const [family, keywords] of Object.entries(signals)) {
    if (keywords.some((k) => lower.includes(k))) return family;
  }
  return "agent_task";
}

/**
 * Create a scenario spec from a natural language description.
 * Uses the provider to generate a task prompt and rubric from the description.
 */
export async function createScenarioFromDescription(
  description: string,
  provider: LLMProvider,
): Promise<CreatedScenarioResult> {
  const name = deriveName(description);
  const family = detectFamily(description);

  const result = await provider.complete({
    systemPrompt: [
      "You are a scenario designer for an agent evaluation harness.",
      "Given a user's description, generate a JSON spec with these fields:",
      '  - taskPrompt: the task the agent will be given',
      '  - rubric: evaluation criteria for judging the output',
      '  - description: a brief description of what the scenario tests',
      "Respond with ONLY the JSON object, no markdown fences.",
    ].join("\n"),
    userPrompt: description,
  });

  let spec: Record<string, unknown>;
  try {
    // Try to parse JSON from the response
    const text = result.text.trim();
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    if (jsonStart !== -1 && jsonEnd !== -1) {
      spec = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
    } else {
      spec = JSON.parse(text);
    }
  } catch {
    // Fallback: use the description directly
    spec = {
      taskPrompt: description,
      rubric: `Evaluate the quality of the response to: ${description}`,
      description: `Custom scenario: ${description}`,
    };
  }

  // Ensure required fields
  if (!spec.taskPrompt) spec.taskPrompt = description;
  if (!spec.rubric) spec.rubric = `Evaluate the quality of the response.`;
  if (!spec.description) spec.description = `Custom scenario: ${description}`;

  return {
    name,
    family,
    spec: spec as CreatedScenarioResult["spec"],
  };
}
