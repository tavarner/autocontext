/**
 * Tests for AC-394 (smart no-args) and AC-397 (package.json autoctx key).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const CLI = join(import.meta.dirname, "..", "src", "cli", "index.ts");

const SANITIZED_KEYS = [
  "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "AUTOCONTEXT_API_KEY",
  "AUTOCONTEXT_AGENT_API_KEY", "AUTOCONTEXT_PROVIDER", "AUTOCONTEXT_AGENT_PROVIDER",
  "AUTOCONTEXT_DB_PATH", "AUTOCONTEXT_RUNS_ROOT", "AUTOCONTEXT_KNOWLEDGE_ROOT",
  "AUTOCONTEXT_CONFIG_DIR",
];

function buildEnv(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_NO_WARNINGS: "1" };
  for (const k of SANITIZED_KEYS) delete env[k];
  return { ...env, ...overrides };
}

function runCli(
  args: string[],
  opts: { cwd?: string; env?: Record<string, string> } = {},
): { stdout: string; stderr: string; exitCode: number } {
  const r = spawnSync("npx", ["tsx", CLI, ...args], {
    encoding: "utf8",
    timeout: 15000,
    cwd: opts.cwd,
    env: buildEnv(opts.env),
  });
  return { stdout: r.stdout ?? "", stderr: r.stderr ?? "", exitCode: r.status ?? 1 };
}

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "ac-smart-"));
}

// ---------------------------------------------------------------------------
// AC-394: Smart no-args behavior
// ---------------------------------------------------------------------------

describe("AC-394: smart no-args", () => {
  let dir: string;
  beforeEach(() => { dir = makeTempDir(); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it("with no config: shows help and suggests init", () => {
    const { stdout, exitCode } = runCli([], { cwd: dir });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("autoctx");
    expect(stdout.toLowerCase()).toContain("init");
  });

  it("with config: shows project status instead of generic help", () => {
    writeFileSync(join(dir, ".autoctx.json"), JSON.stringify({
      default_scenario: "grid_ctf",
      provider: "deterministic",
      gens: 3,
      runs_dir: "./runs",
      knowledge_dir: "./knowledge",
    }, null, 2), "utf-8");
    // Create the runs dir so list doesn't fail
    mkdirSync(join(dir, "runs"), { recursive: true });

    const { stdout, exitCode } = runCli([], { cwd: dir });
    expect(exitCode).toBe(0);
    // Should show project-specific info, not generic help
    expect(stdout).toContain("grid_ctf");
    expect(stdout).toContain("deterministic");
  });
});

// ---------------------------------------------------------------------------
// AC-397: package.json autoctx key
// ---------------------------------------------------------------------------

describe("AC-397: package.json autoctx key", () => {
  let dir: string;
  beforeEach(() => { dir = makeTempDir(); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it("loadProjectConfig reads from package.json autoctx key", async () => {
    writeFileSync(join(dir, "package.json"), JSON.stringify({
      name: "test-project",
      autoctx: {
        default_scenario: "othello",
        provider: "ollama",
      },
    }, null, 2), "utf-8");

    const { loadProjectConfig } = await import("../src/config/index.js");
    const config = loadProjectConfig(dir);
    expect(config).not.toBeNull();
    expect(config!.defaultScenario).toBe("othello");
    expect(config!.provider).toBe("ollama");
  });

  it(".autoctx.json takes precedence over package.json", async () => {
    writeFileSync(join(dir, ".autoctx.json"), JSON.stringify({
      default_scenario: "grid_ctf",
      provider: "deterministic",
    }, null, 2), "utf-8");
    writeFileSync(join(dir, "package.json"), JSON.stringify({
      name: "test-project",
      autoctx: {
        default_scenario: "othello",
        provider: "ollama",
      },
    }, null, 2), "utf-8");

    const { loadProjectConfig } = await import("../src/config/index.js");
    const config = loadProjectConfig(dir);
    expect(config).not.toBeNull();
    expect(config!.defaultScenario).toBe("grid_ctf");
    expect(config!.provider).toBe("deterministic");
  });

  it("package.json without autoctx key returns null", async () => {
    writeFileSync(join(dir, "package.json"), JSON.stringify({
      name: "test-project",
    }, null, 2), "utf-8");

    const { loadProjectConfig } = await import("../src/config/index.js");
    const config = loadProjectConfig(dir);
    expect(config).toBeNull();
  });

  it("CLI run uses package.json autoctx.default_scenario", () => {
    writeFileSync(join(dir, "package.json"), JSON.stringify({
      name: "test-project",
      autoctx: {
        default_scenario: "nonexistent_scenario_xyz",
        provider: "deterministic",
      },
    }, null, 2), "utf-8");

    const { stderr, exitCode } = runCli(["run"], { cwd: dir });
    expect(exitCode).toBe(1);
    // Should attempt to use the scenario from package.json
    expect(stderr).toContain("nonexistent_scenario_xyz");
  });
});
