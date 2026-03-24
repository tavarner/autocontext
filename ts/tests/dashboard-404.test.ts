/**
 * Tests for AC-417: Dashboard 404 in published npm package.
 *
 * Verifies that the dashboard route works when the dashboard file exists
 * (monorepo or bundled npm) and fails gracefully when it doesn't.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "ac-dashboard-"));
}

async function createTestServer(dir: string) {
  const { RunManager, InteractiveServer } = await import("../src/server/index.js");
  const { SQLiteStore } = await import("../src/storage/index.js");

  const dbPath = join(dir, "test.db");
  const store = new SQLiteStore(dbPath);
  store.migrate(join(__dirname, "..", "migrations"));
  store.close();

  const mgr = new RunManager({
    dbPath,
    migrationsDir: join(__dirname, "..", "migrations"),
    runsRoot: join(dir, "runs"),
    knowledgeRoot: join(dir, "knowledge"),
    providerType: "deterministic",
  });
  const server = new InteractiveServer({ runManager: mgr, port: 0 });
  await server.start();
  return { server, baseUrl: `http://localhost:${server.port}` };
}

describe("Dashboard route", () => {
  let dir: string;
  let server: Awaited<ReturnType<typeof createTestServer>>["server"];
  let baseUrl: string;

  beforeEach(async () => {
    dir = makeTempDir();
    const s = await createTestServer(dir);
    server = s.server;
    baseUrl = s.baseUrl;
  });

  afterEach(async () => {
    await server.stop();
    rmSync(dir, { recursive: true, force: true });
  });

  it("GET / returns a useful response instead of crashing", async () => {
    const res = await fetch(`${baseUrl}/`);
    // Should not be 500 — either serves dashboard or returns a helpful message
    expect(res.status).not.toBe(500);
    expect([200, 404].includes(res.status)).toBe(true);
  });

  it("GET / serves dashboard or returns helpful fallback", async () => {
    const res = await fetch(`${baseUrl}/`);
    if (res.status === 200) {
      // Dashboard was found (monorepo or bundled) — should be HTML
      const body = await res.text();
      expect(body).toContain("html");
    } else {
      // Dashboard not found — should return helpful JSON with API links
      const body = await res.json();
      expect(body).toHaveProperty("message");
      expect(body.message).toContain("dashboard");
      expect(body.api).toBeDefined();
      expect(body.api.runs).toBe("/api/runs");
    }
  });

  it("GET /health still works regardless of dashboard state", async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("GET /api/runs still works regardless of dashboard state", async () => {
    const res = await fetch(`${baseUrl}/api/runs`);
    expect(res.status).toBe(200);
  });
});
