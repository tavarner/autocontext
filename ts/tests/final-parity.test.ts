/**
 * Tests for AC-370: Final TS package parity — solve flows, sandbox,
 * agent task CRUD, package management, capabilities, and exclusion docs.
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
  return mkdtempSync(join(tmpdir(), "ac-final-parity-"));
}

// ---------------------------------------------------------------------------
// MCP tool registration — final count
// ---------------------------------------------------------------------------

describe("MCP final tool count", () => {
  let dir: string;

  beforeEach(() => { dir = makeTempDir(); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it("registers >= 35 tools for package-surface parity", async () => {
    const { SQLiteStore } = await import("../src/storage/index.js");
    const { DeterministicProvider } = await import("../src/providers/deterministic.js");
    const { createMcpServer } = await import("../src/mcp/server.js");

    const store = new SQLiteStore(join(dir, "test.db"));
    store.migrate(join(__dirname, "..", "migrations"));
    const server = createMcpServer({
      store,
      provider: new DeterministicProvider(),
      runsRoot: join(dir, "runs"),
      knowledgeRoot: join(dir, "knowledge"),
    });

    const tools = (server as unknown as { _registeredTools: Record<string, unknown> })._registeredTools;
    const names = Object.keys(tools);

    expect(names.length).toBeGreaterThanOrEqual(35);

    // Solve flows
    expect(names).toContain("solve_scenario");
    expect(names).toContain("solve_status");

    // Sandbox lifecycle
    expect(names).toContain("sandbox_create");
    expect(names).toContain("sandbox_run");
    expect(names).toContain("sandbox_status");
    expect(names).toContain("sandbox_list");
    expect(names).toContain("sandbox_destroy");

    // Agent task CRUD
    expect(names).toContain("create_agent_task");
    expect(names).toContain("list_agent_tasks");
    expect(names).toContain("get_agent_task");

    // Package management
    expect(names).toContain("export_package");
    expect(names).toContain("import_package");

    // Capabilities
    expect(names).toContain("capabilities");

    // Generate output
    expect(names).toContain("generate_output");

    store.close();
  });
});

// ---------------------------------------------------------------------------
// Solve flow helpers
// ---------------------------------------------------------------------------

describe("Solve flow", () => {
  let dir: string;

  beforeEach(() => { dir = makeTempDir(); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it("SolveManager can start and track a job", async () => {
    const { SolveManager } = await import("../src/knowledge/solver.js");
    const { DeterministicProvider } = await import("../src/providers/deterministic.js");
    const { SQLiteStore } = await import("../src/storage/index.js");

    const store = new SQLiteStore(join(dir, "test.db"));
    store.migrate(join(__dirname, "..", "migrations"));
    const mgr = new SolveManager({
      provider: new DeterministicProvider(),
      store,
      runsRoot: join(dir, "runs"),
      knowledgeRoot: join(dir, "knowledge"),
    });

    const jobId = mgr.submit("Optimize a grid capture strategy", 1);
    expect(typeof jobId).toBe("string");
    expect(jobId.length).toBeGreaterThan(0);

    const status = mgr.getStatus(jobId);
    expect(["pending", "running", "completed", "failed"]).toContain(status.status);

    store.close();
  });
});

// ---------------------------------------------------------------------------
// Sandbox lifecycle helpers
// ---------------------------------------------------------------------------

describe("Sandbox lifecycle", () => {
  let dir: string;

  beforeEach(() => { dir = makeTempDir(); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it("SandboxManager creates and lists sandboxes", async () => {
    const { SandboxManager } = await import("../src/execution/sandbox.js");
    const { DeterministicProvider } = await import("../src/providers/deterministic.js");
    const { SQLiteStore } = await import("../src/storage/index.js");

    const store = new SQLiteStore(join(dir, "test.db"));
    store.migrate(join(__dirname, "..", "migrations"));
    const mgr = new SandboxManager({
      provider: new DeterministicProvider(),
      store,
      runsRoot: join(dir, "runs"),
      knowledgeRoot: join(dir, "knowledge"),
    });

    const sandbox = mgr.create("grid_ctf", "test-user");
    expect(sandbox.sandboxId).toBeDefined();
    expect(sandbox.scenarioName).toBe("grid_ctf");

    const list = mgr.list();
    expect(list.length).toBe(1);
    expect(list[0].sandboxId).toBe(sandbox.sandboxId);

    const destroyed = mgr.destroy(sandbox.sandboxId);
    expect(destroyed).toBe(true);
    expect(mgr.list().length).toBe(0);

    store.close();
  });
});

// ---------------------------------------------------------------------------
// Agent task CRUD helpers
// ---------------------------------------------------------------------------

describe("Agent task CRUD", () => {
  let dir: string;

  beforeEach(() => { dir = makeTempDir(); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it("AgentTaskStore creates, lists, gets, and deletes tasks", async () => {
    const { AgentTaskStore } = await import("../src/scenarios/agent-task-store.js");

    const taskStore = new AgentTaskStore(join(dir, "tasks"));

    taskStore.create({
      name: "test-task",
      taskPrompt: "Summarize this document.",
      rubric: "Evaluate completeness.",
    });

    const list = taskStore.list();
    expect(list.length).toBe(1);
    expect(list[0].name).toBe("test-task");

    const task = taskStore.get("test-task");
    expect(task).not.toBeNull();
    expect(task!.taskPrompt).toBe("Summarize this document.");

    taskStore.delete("test-task");
    expect(taskStore.list().length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Capabilities
// ---------------------------------------------------------------------------

describe("Capabilities discovery", () => {
  it("returns capability metadata", async () => {
    const { getCapabilities } = await import("../src/mcp/capabilities.js");
    const caps = getCapabilities();
    expect(caps.scenarios).toBeDefined();
    expect(caps.providers).toBeDefined();
    expect(caps.version).toBeDefined();
    expect(Array.isArray(caps.scenarios)).toBe(true);
    expect(caps.scenarios.length).toBeGreaterThan(0);
  });
});
