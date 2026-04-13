import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { SQLiteStore } from "../storage/index.js";
import { assertFamilyContract } from "../scenarios/family-interfaces.js";
import { SCENARIO_REGISTRY } from "../scenarios/registry.js";
import type { PersistedPackageMetadata } from "./package-types.js";

export function displayNameForScenario(scenarioName: string): string {
  return scenarioName.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function descriptionForScenario(scenarioName: string): string {
  const ScenarioClass = SCENARIO_REGISTRY[scenarioName];
  if (!ScenarioClass) {
    return `Exported knowledge for ${scenarioName}`;
  }
  const scenario = new ScenarioClass();
  assertFamilyContract(scenario, "game", `scenario '${scenarioName}'`);
  return scenario.describeRules();
}

export function packageMetadataPath(knowledgeRoot: string, scenarioName: string): string {
  return join(knowledgeRoot, scenarioName, "package_metadata.json");
}

export function readPackageMetadata(
  knowledgeRoot: string,
  scenarioName: string,
): PersistedPackageMetadata {
  const path = packageMetadataPath(knowledgeRoot, scenarioName);
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8")) as PersistedPackageMetadata;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function writePackageMetadata(
  knowledgeRoot: string,
  scenarioName: string,
  payload: PersistedPackageMetadata,
): void {
  const path = packageMetadataPath(knowledgeRoot, scenarioName);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(payload, null, 2) + "\n", "utf-8");
}

export function bestStrategyForScenario(
  store: SQLiteStore,
  scenarioName: string,
  persisted: PersistedPackageMetadata,
): Record<string, unknown> | null {
  const bestMatch = store.getBestMatchForScenario(scenarioName);
  if (bestMatch?.strategy_json) {
    try {
      return JSON.parse(bestMatch.strategy_json) as Record<string, unknown>;
    } catch {
      // fall through to persisted metadata
    }
  }
  return persisted.best_strategy ?? null;
}
