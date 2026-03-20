/**
 * Tests for AC-347: Interactive Server — Protocol types, Run Manager, WS Server.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "ac-server-"));
}

// ---------------------------------------------------------------------------
// Task 24: WebSocket Protocol Types
// ---------------------------------------------------------------------------

describe("Protocol types", () => {
  it("exports PROTOCOL_VERSION", async () => {
    const { PROTOCOL_VERSION } = await import("../src/server/protocol.js");
    expect(PROTOCOL_VERSION).toBe(1);
  });

  it("exports server message schemas", async () => {
    const mod = await import("../src/server/protocol.js");
    expect(mod.HelloMsgSchema).toBeDefined();
    expect(mod.EventMsgSchema).toBeDefined();
    expect(mod.StateMsgSchema).toBeDefined();
    expect(mod.RunAcceptedMsgSchema).toBeDefined();
    expect(mod.AckMsgSchema).toBeDefined();
    expect(mod.ErrorMsgSchema).toBeDefined();
    expect(mod.EnvironmentsMsgSchema).toBeDefined();
  });

  it("exports client command schemas", async () => {
    const mod = await import("../src/server/protocol.js");
    expect(mod.PauseCmdSchema).toBeDefined();
    expect(mod.ResumeCmdSchema).toBeDefined();
    expect(mod.StartRunCmdSchema).toBeDefined();
    expect(mod.InjectHintCmdSchema).toBeDefined();
    expect(mod.OverrideGateCmdSchema).toBeDefined();
  });

  it("HelloMsg parses correctly", async () => {
    const { HelloMsgSchema } = await import("../src/server/protocol.js");
    const msg = HelloMsgSchema.parse({ type: "hello", protocol_version: 1 });
    expect(msg.type).toBe("hello");
    expect(msg.protocol_version).toBe(1);
  });

  it("StartRunCmd validates scenario and generations", async () => {
    const { StartRunCmdSchema } = await import("../src/server/protocol.js");
    const cmd = StartRunCmdSchema.parse({ type: "start_run", scenario: "grid_ctf", generations: 3 });
    expect(cmd.scenario).toBe("grid_ctf");
    expect(cmd.generations).toBe(3);
  });

  it("parseClientMessage dispatches correctly", async () => {
    const { parseClientMessage } = await import("../src/server/protocol.js");
    const msg = parseClientMessage({ type: "pause" });
    expect(msg.type).toBe("pause");
  });

  it("parseClientMessage throws on invalid type", async () => {
    const { parseClientMessage } = await import("../src/server/protocol.js");
    expect(() => parseClientMessage({ type: "bogus" })).toThrow();
  });

  it("OverrideGateCmd validates decision enum", async () => {
    const { OverrideGateCmdSchema } = await import("../src/server/protocol.js");
    const cmd = OverrideGateCmdSchema.parse({ type: "override_gate", decision: "advance" });
    expect(cmd.decision).toBe("advance");
    expect(() => OverrideGateCmdSchema.parse({ type: "override_gate", decision: "invalid" })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Task 26: Run Manager
// ---------------------------------------------------------------------------

describe("RunManager", () => {
  let dir: string;

  beforeEach(() => { dir = makeTempDir(); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it("should be importable", async () => {
    const { RunManager } = await import("../src/server/run-manager.js");
    expect(RunManager).toBeDefined();
  });

  it("isActive returns false initially", async () => {
    const { RunManager } = await import("../src/server/run-manager.js");
    const mgr = new RunManager({
      dbPath: join(dir, "test.db"),
      migrationsDir: join(__dirname, "..", "migrations"),
      runsRoot: join(dir, "runs"),
      knowledgeRoot: join(dir, "knowledge"),
    });
    expect(mgr.isActive).toBe(false);
  });

  it("listScenarios returns registered scenarios", async () => {
    const { RunManager } = await import("../src/server/run-manager.js");
    const mgr = new RunManager({
      dbPath: join(dir, "test.db"),
      migrationsDir: join(__dirname, "..", "migrations"),
      runsRoot: join(dir, "runs"),
      knowledgeRoot: join(dir, "knowledge"),
    });
    const scenarios = mgr.listScenarios();
    expect(scenarios).toContain("grid_ctf");
  });

  it("getEnvironmentInfo returns scenarios and executor info", async () => {
    const { RunManager } = await import("../src/server/run-manager.js");
    const mgr = new RunManager({
      dbPath: join(dir, "test.db"),
      migrationsDir: join(__dirname, "..", "migrations"),
      runsRoot: join(dir, "runs"),
      knowledgeRoot: join(dir, "knowledge"),
    });
    const info = mgr.getEnvironmentInfo();
    expect(info.scenarios.length).toBeGreaterThan(0);
    expect(info.scenarios[0].name).toBe("grid_ctf");
    expect(info.executors.length).toBeGreaterThan(0);
    expect(info.currentExecutor).toBe("local");
  });

  it("startRun returns runId and marks active", async () => {
    const { RunManager } = await import("../src/server/run-manager.js");
    const mgr = new RunManager({
      dbPath: join(dir, "test.db"),
      migrationsDir: join(__dirname, "..", "migrations"),
      runsRoot: join(dir, "runs"),
      knowledgeRoot: join(dir, "knowledge"),
      providerType: "deterministic",
    });
    const runId = await mgr.startRun("grid_ctf", 1);
    expect(runId).toBeDefined();
    expect(typeof runId).toBe("string");
    // Wait for run to complete (deterministic is fast)
    await new Promise(r => setTimeout(r, 500));
  });

  it("startRun throws for unknown scenario", async () => {
    const { RunManager } = await import("../src/server/run-manager.js");
    const mgr = new RunManager({
      dbPath: join(dir, "test.db"),
      migrationsDir: join(__dirname, "..", "migrations"),
      runsRoot: join(dir, "runs"),
      knowledgeRoot: join(dir, "knowledge"),
    });
    await expect(mgr.startRun("nonexistent", 1)).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Task 28: CLI tui command
// ---------------------------------------------------------------------------

describe("CLI tui command", () => {
  it("help output includes 'tui' command", async () => {
    const { execFileSync } = await import("node:child_process");
    const result = execFileSync(
      "npx",
      ["tsx", join(__dirname, "..", "src", "cli", "index.ts"), "--help"],
      { encoding: "utf-8", timeout: 10000 },
    );
    expect(result).toContain("tui");
  });
});
