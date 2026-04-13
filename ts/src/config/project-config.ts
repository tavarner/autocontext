import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { isRecord, readJsonObject } from "./config-json-helpers.js";

export const PROJECT_CONFIG_FILE = ".autoctx.json";

export interface ProjectConfig {
  defaultScenario?: string;
  provider?: string;
  model?: string;
  gens?: number;
  knowledgeDir?: string;
  runsDir?: string;
  dbPath?: string;
}

export interface ProjectConfigLocation {
  path: string;
  source: "autoctx_json" | "package_json";
}

function coercePositiveInt(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return undefined;
}

export function findProjectConfigPath(startDir = process.cwd()): string | null {
  let current = resolve(startDir);
  while (true) {
    const candidate = join(current, PROJECT_CONFIG_FILE);
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

function findProjectConfigSource(startDir = process.cwd()): {
  location: ProjectConfigLocation;
  raw: Record<string, unknown>;
} | null {
  let current = resolve(startDir);
  while (true) {
    const configPath = join(current, PROJECT_CONFIG_FILE);
    if (existsSync(configPath)) {
      return {
        location: { path: configPath, source: "autoctx_json" },
        raw: readJsonObject(configPath, PROJECT_CONFIG_FILE),
      };
    }

    const pkgJsonPath = join(current, "package.json");
    if (existsSync(pkgJsonPath)) {
      const pkg = readJsonObject(pkgJsonPath, "package.json");
      if (isRecord(pkg.autoctx)) {
        return {
          location: { path: pkgJsonPath, source: "package_json" },
          raw: pkg.autoctx as Record<string, unknown>,
        };
      }
    }

    const parent = dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

export function findProjectConfigLocation(
  startDir = process.cwd(),
): ProjectConfigLocation | null {
  return findProjectConfigSource(startDir)?.location ?? null;
}

export function parseProjectConfigRaw(
  raw: Record<string, unknown>,
  rootDir: string,
): ProjectConfig {
  const config: ProjectConfig = {};

  if (typeof raw.default_scenario === "string" && raw.default_scenario.trim()) {
    config.defaultScenario = raw.default_scenario.trim();
  }
  if (
    !config.defaultScenario
    && typeof raw.defaultScenario === "string"
    && raw.defaultScenario.trim()
  ) {
    config.defaultScenario = raw.defaultScenario.trim();
  }
  if (typeof raw.provider === "string" && raw.provider.trim()) {
    config.provider = raw.provider.trim();
  }
  if (typeof raw.model === "string" && raw.model.trim()) {
    config.model = raw.model.trim();
  }
  if (typeof raw.knowledge_dir === "string" && raw.knowledge_dir.trim()) {
    config.knowledgeDir = resolve(rootDir, raw.knowledge_dir.trim());
  }
  if (!config.knowledgeDir && typeof raw.knowledgeDir === "string" && raw.knowledgeDir.trim()) {
    config.knowledgeDir = resolve(rootDir, raw.knowledgeDir.trim());
  }
  if (typeof raw.runs_dir === "string" && raw.runs_dir.trim()) {
    config.runsDir = resolve(rootDir, raw.runs_dir.trim());
  }
  if (!config.runsDir && typeof raw.runsDir === "string" && raw.runsDir.trim()) {
    config.runsDir = resolve(rootDir, raw.runsDir.trim());
  }
  if (typeof raw.db_path === "string" && raw.db_path.trim()) {
    config.dbPath = resolve(rootDir, raw.db_path.trim());
  }
  if (!config.dbPath && typeof raw.dbPath === "string" && raw.dbPath.trim()) {
    config.dbPath = resolve(rootDir, raw.dbPath.trim());
  }
  if (!config.dbPath && config.runsDir) {
    config.dbPath = join(config.runsDir, "autocontext.sqlite3");
  }
  config.gens = coercePositiveInt(raw.gens);

  return config;
}

export function loadProjectConfig(
  startDir = process.cwd(),
): ProjectConfig | null {
  const configSource = findProjectConfigSource(startDir);
  if (!configSource) {
    return null;
  }
  return parseProjectConfigRaw(
    configSource.raw,
    dirname(configSource.location.path),
  );
}
