/**
 * Tests for AC-415: CodeMission MVP with hard external verifiers.
 *
 * - CommandVerifier: runs shell command, parses exit code
 * - CompositeVerifier: all verifiers must pass
 * - CodeMissionSpec: extends MissionSpec with code-specific fields
 * - createCodeMission: factory wiring verifiers to mission
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "ac-codemission-"));
}

// ---------------------------------------------------------------------------
// CommandVerifier
// ---------------------------------------------------------------------------

describe("CommandVerifier", () => {
  let dir: string;
  beforeEach(() => { dir = makeTempDir(); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it("passes when command exits 0", async () => {
    const { CommandVerifier } = await import("../src/mission/verifiers.js");
    const verifier = new CommandVerifier("true", dir);
    const result = await verifier.verify("m-1");
    expect(result.passed).toBe(true);
  });

  it("fails when command exits non-zero", async () => {
    const { CommandVerifier } = await import("../src/mission/verifiers.js");
    const verifier = new CommandVerifier("false", dir);
    const result = await verifier.verify("m-1");
    expect(result.passed).toBe(false);
    expect(result.reason).toContain("exit");
  });

  it("captures stdout in metadata", async () => {
    const { CommandVerifier } = await import("../src/mission/verifiers.js");
    const verifier = new CommandVerifier("echo hello-world", dir);
    const result = await verifier.verify("m-1");
    expect(result.passed).toBe(true);
    expect(result.metadata?.stdout).toContain("hello-world");
  });

  it("runs in the specified working directory", async () => {
    const { CommandVerifier } = await import("../src/mission/verifiers.js");
    const verifier = new CommandVerifier("pwd", dir);
    const result = await verifier.verify("m-1");
    expect(result.metadata?.stdout).toContain(dir);
  });

  it("has a descriptive label", async () => {
    const { CommandVerifier } = await import("../src/mission/verifiers.js");
    const verifier = new CommandVerifier("npm test", dir);
    expect(verifier.label).toBe("npm test");
  });
});

// ---------------------------------------------------------------------------
// CompositeVerifier
// ---------------------------------------------------------------------------

describe("CompositeVerifier", () => {
  let dir: string;
  beforeEach(() => { dir = makeTempDir(); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it("passes when all verifiers pass", async () => {
    const { CommandVerifier, CompositeVerifier } = await import("../src/mission/verifiers.js");
    const composite = new CompositeVerifier([
      new CommandVerifier("true", dir),
      new CommandVerifier("echo ok", dir),
    ]);
    const result = await composite.verify("m-1");
    expect(result.passed).toBe(true);
  });

  it("fails when any verifier fails", async () => {
    const { CommandVerifier, CompositeVerifier } = await import("../src/mission/verifiers.js");
    const composite = new CompositeVerifier([
      new CommandVerifier("true", dir),
      new CommandVerifier("false", dir),
    ]);
    const result = await composite.verify("m-1");
    expect(result.passed).toBe(false);
    expect(result.reason).toContain("false");
  });

  it("reports which verifier failed", async () => {
    const { CommandVerifier, CompositeVerifier } = await import("../src/mission/verifiers.js");
    const composite = new CompositeVerifier([
      new CommandVerifier("true", dir),
      new CommandVerifier("false", dir),
    ]);
    const result = await composite.verify("m-1");
    expect(result.metadata?.failedVerifier).toBe("false");
  });

  it("stops at first failure (short-circuit)", async () => {
    const { CommandVerifier, CompositeVerifier } = await import("../src/mission/verifiers.js");
    let secondCalled = false;
    const composite = new CompositeVerifier([
      new CommandVerifier("false", dir),
      {
        label: "should-not-run",
        verify: async () => { secondCalled = true; return { passed: true, reason: "ok" }; },
      },
    ]);
    await composite.verify("m-1");
    expect(secondCalled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CodeMissionSpec
// ---------------------------------------------------------------------------

describe("CodeMissionSpec", () => {
  it("CodeMissionSpecSchema validates code mission config", async () => {
    const { CodeMissionSpecSchema } = await import("../src/mission/verifiers.js");
    const spec = CodeMissionSpecSchema.parse({
      name: "Fix login bug",
      goal: "Tests pass and lint clean",
      repoPath: "/path/to/repo",
      testCommand: "npm test",
      lintCommand: "npm run lint",
    });
    expect(spec.repoPath).toBe("/path/to/repo");
    expect(spec.testCommand).toBe("npm test");
  });

  it("CodeMissionSpecSchema works with minimal fields", async () => {
    const { CodeMissionSpecSchema } = await import("../src/mission/verifiers.js");
    const spec = CodeMissionSpecSchema.parse({
      name: "Quick fix",
      goal: "Fix the bug",
      repoPath: ".",
      testCommand: "npm test",
    });
    expect(spec.lintCommand).toBeUndefined();
    expect(spec.buildCommand).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// createCodeMission — factory
// ---------------------------------------------------------------------------

describe("createCodeMission", () => {
  let dir: string;
  beforeEach(() => { dir = makeTempDir(); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it("creates a mission with verifiers wired up", async () => {
    const { createCodeMission } = await import("../src/mission/verifiers.js");
    const { MissionManager } = await import("../src/mission/manager.js");
    const manager = new MissionManager(join(dir, "test.db"));

    const id = createCodeMission(manager, {
      name: "Fix bug",
      goal: "Tests pass",
      repoPath: dir,
      testCommand: "true",
    });

    expect(manager.get(id)!.status).toBe("active");
    expect(manager.hasVerifier(id)).toBe(true);

    // Verify passes since "true" exits 0
    const result = await manager.verify(id);
    expect(result.passed).toBe(true);
    manager.close();
  });

  it("wires composite verifier when multiple commands provided", async () => {
    const { createCodeMission } = await import("../src/mission/verifiers.js");
    const { MissionManager } = await import("../src/mission/manager.js");
    const manager = new MissionManager(join(dir, "test.db"));

    const id = createCodeMission(manager, {
      name: "Fix bug",
      goal: "Tests + lint pass",
      repoPath: dir,
      testCommand: "true",
      lintCommand: "true",
    });

    const result = await manager.verify(id);
    expect(result.passed).toBe(true);
    manager.close();
  });

  it("composite fails when test command fails", async () => {
    const { createCodeMission } = await import("../src/mission/verifiers.js");
    const { MissionManager } = await import("../src/mission/manager.js");
    const manager = new MissionManager(join(dir, "test.db"));

    const id = createCodeMission(manager, {
      name: "Fix bug",
      goal: "Tests pass",
      repoPath: dir,
      testCommand: "false",
      lintCommand: "true",
    });

    const result = await manager.verify(id);
    expect(result.passed).toBe(false);
    manager.close();
  });

  it("sets budget from spec", async () => {
    const { createCodeMission } = await import("../src/mission/verifiers.js");
    const { MissionManager } = await import("../src/mission/manager.js");
    const manager = new MissionManager(join(dir, "test.db"));

    const id = createCodeMission(manager, {
      name: "Fix bug",
      goal: "Tests pass",
      repoPath: dir,
      testCommand: "true",
      budget: { maxSteps: 20 },
    });

    const usage = manager.budgetUsage(id);
    expect(usage.maxSteps).toBe(20);
    manager.close();
  });
});
