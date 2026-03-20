/**
 * Custom scenario loader — scan knowledge dir, load specs, register (AC-348 Task 29).
 * Mirrors Python's autocontext/scenarios/custom/registry.py.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { SCENARIO_REGISTRY } from "./registry.js";
import type { ScenarioInterface } from "./game-interface.js";

export interface CustomScenarioEntry {
  name: string;
  type: string;
  spec: Record<string, unknown>;
  path: string;
}

/**
 * Scan a custom scenarios directory and load spec.json entries.
 * Returns a Map of name → entry for each valid custom scenario found.
 */
export function loadCustomScenarios(customDir: string): Map<string, CustomScenarioEntry> {
  const loaded = new Map<string, CustomScenarioEntry>();

  if (!existsSync(customDir)) return loaded;

  let entries: string[];
  try {
    entries = readdirSync(customDir).sort();
  } catch {
    return loaded;
  }

  for (const name of entries) {
    const entryPath = join(customDir, name);
    try {
      if (!statSync(entryPath).isDirectory()) continue;
    } catch {
      continue;
    }

    const specPath = join(entryPath, "spec.json");
    if (!existsSync(specPath)) continue;

    // Read scenario type (default to agent_task)
    const typePath = join(entryPath, "scenario_type.txt");
    let scenarioType = "agent_task";
    if (existsSync(typePath)) {
      try {
        scenarioType = readFileSync(typePath, "utf-8").trim();
      } catch {
        scenarioType = "agent_task";
      }
    }

    // Read spec
    try {
      const specRaw = readFileSync(specPath, "utf-8");
      const spec = JSON.parse(specRaw);
      loaded.set(name, {
        name,
        type: scenarioType,
        spec,
        path: entryPath,
      });
    } catch {
      // Skip malformed specs
      continue;
    }
  }

  return loaded;
}

/**
 * Register loaded custom scenarios into the SCENARIO_REGISTRY.
 * For agent_task types, creates a factory that returns an AgentTaskInterface-like object.
 */
export function registerCustomScenarios(
  loaded: Map<string, CustomScenarioEntry>,
): void {
  for (const [name, entry] of loaded) {
    if (entry.type === "agent_task") {
      // Create a factory class that implements enough of ScenarioInterface
      // for the registry's dual-interface pattern (isAgentTask guard)
      const spec = entry.spec;
      const factory = class CustomAgentTask {
        readonly name = name;

        getTaskPrompt(): string {
          return (spec.taskPrompt as string) ?? "";
        }

        getRubric(): string {
          return (spec.rubric as string) ?? "";
        }

        describeTask(): string {
          return (spec.description as string) ?? name;
        }

        initialState(): Record<string, unknown> {
          return {};
        }

        async evaluateOutput(): Promise<{ score: number; reasoning: string; dimensionScores: Record<string, number> }> {
          return { score: 0, reasoning: "not evaluated", dimensionScores: {} };
        }
      };

      (SCENARIO_REGISTRY as Record<string, new () => unknown>)[name] = factory as unknown as new () => ScenarioInterface;
    }
  }
}
