import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  findProjectConfigLocation,
  findProjectConfigPath,
  loadProjectConfig,
  parseProjectConfigRaw,
} from "../src/config/project-config.js";

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "ac-project-config-"));
}

describe("project config workflow", () => {
  let dir: string;

  beforeEach(() => {
    dir = makeTempDir();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("prefers .autoctx.json over package.json autoctx during discovery", () => {
    writeFileSync(join(dir, ".autoctx.json"), JSON.stringify({
      default_scenario: "grid_ctf",
      provider: "deterministic",
    }, null, 2));
    writeFileSync(join(dir, "package.json"), JSON.stringify({
      name: "demo",
      autoctx: {
        defaultScenario: "othello",
        provider: "ollama",
      },
    }, null, 2));

    expect(findProjectConfigPath(dir)).toBe(join(dir, ".autoctx.json"));
    expect(findProjectConfigLocation(dir)).toEqual({
      path: join(dir, ".autoctx.json"),
      source: "autoctx_json",
    });
    expect(loadProjectConfig(dir)).toEqual({
      defaultScenario: "grid_ctf",
      provider: "deterministic",
    });
  });

  it("finds package.json autoctx from nested directories", () => {
    writeFileSync(join(dir, "package.json"), JSON.stringify({
      name: "demo",
      autoctx: {
        defaultScenario: "grid_ctf",
        provider: "deterministic",
      },
    }, null, 2));
    const nested = join(dir, "packages", "demo", "src");
    mkdirSync(nested, { recursive: true });

    expect(findProjectConfigPath(nested)).toBeNull();
    expect(findProjectConfigLocation(nested)).toEqual({
      path: join(dir, "package.json"),
      source: "package_json",
    });
    expect(loadProjectConfig(nested)).toEqual({
      defaultScenario: "grid_ctf",
      provider: "deterministic",
    });
  });

  it("parses snake_case and camelCase fields and derives dbPath from runsDir", () => {
    const parsed = parseProjectConfigRaw({
      defaultScenario: "investigation",
      provider: "anthropic",
      model: "claude-opus",
      knowledge_dir: "./knowledge",
      runsDir: "./runs",
      gens: "4",
    }, dir);

    expect(parsed).toEqual({
      defaultScenario: "investigation",
      provider: "anthropic",
      model: "claude-opus",
      knowledgeDir: join(dir, "knowledge"),
      runsDir: join(dir, "runs"),
      dbPath: join(dir, "runs", "autocontext.sqlite3"),
      gens: 4,
    });
  });

  it("returns null when no project config source exists", () => {
    expect(findProjectConfigPath(dir)).toBeNull();
    expect(findProjectConfigLocation(dir)).toBeNull();
    expect(loadProjectConfig(dir)).toBeNull();
  });
});
