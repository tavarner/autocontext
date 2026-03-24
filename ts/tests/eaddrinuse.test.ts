/**
 * Tests for AC-419: EADDRINUSE crash — graceful port handling.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "ac-eaddrinuse-"));
}

describe("EADDRINUSE handling", () => {
  let dir: string;
  let blocker: ReturnType<typeof createServer>;
  let blockerPort: number;

  beforeEach(async () => {
    dir = makeTempDir();
    // Start a blocker server on a random port
    blocker = createServer((_req, res) => {
      res.writeHead(200);
      res.end("blocker");
    });
    await new Promise<void>((resolve) => {
      blocker.listen(0, "127.0.0.1", () => {
        const addr = blocker.address();
        blockerPort = typeof addr === "object" && addr ? addr.port : 0;
        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => blocker.close(() => resolve()));
    rmSync(dir, { recursive: true, force: true });
  });

  it("throws a clean PortInUseError instead of raw EADDRINUSE stack trace", async () => {
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

    // Try to start on the already-occupied port
    const server = new InteractiveServer({ runManager: mgr, port: blockerPort });

    try {
      await server.start();
      // If it somehow starts (shouldn't), stop it
      await server.stop();
      expect.fail("Expected start() to throw for port in use");
    } catch (err) {
      const error = err as Error;
      // Should have a clean message mentioning the port and suggesting alternatives
      expect(error.message).toContain(String(blockerPort));
      expect(error.message).toContain("already in use");
      expect(error.message).toContain("--port");
      // Should NOT contain raw EADDRINUSE code or Node internals
      expect(error.message).not.toContain("EADDRINUSE");
    }
  });

  it("port 0 still works (auto-assign)", async () => {
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
    expect(server.port).toBeGreaterThan(0);
    await server.stop();
  });
});
