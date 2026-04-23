#!/usr/bin/env node
/**
 * Cross-runtime parity fixture driver — Anthropic TS runtime.
 * Usage: node --expose-gc --import tsx/esm scripts/drive-anthropic-parity-fixture.mjs <fixture-name>
 */
import { readFileSync, existsSync, mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const FIXTURES_DIR = join(ROOT, "tests", "integrations", "anthropic", "parity", "fixtures");

const fixtureName = process.argv[2];
if (!fixtureName) { process.stderr.write("Usage: drive-anthropic-parity-fixture.mjs <fixture-name>\n"); process.exit(1); }

const fixtureDir = join(FIXTURES_DIR, fixtureName);
if (!existsSync(fixtureDir)) { process.stderr.write(`Fixture not found: ${fixtureDir}\n`); process.exit(1); }

const requestJson = JSON.parse(readFileSync(join(fixtureDir, "request.json"), "utf-8"));
const identityJson = JSON.parse(readFileSync(join(fixtureDir, "identity.json"), "utf-8"));
const isError = existsSync(join(fixtureDir, "error.json"));
const isStreaming = existsSync(join(fixtureDir, "chunks.json"));

const tmpDir = mkdtempSync(join(tmpdir(), "parity-anthropic-driver-"));
const tracePath = join(tmpDir, "traces.jsonl");

try {
  const { FileSink } = await import("../src/integrations/_shared/sink.js");
  const { instrumentClient } = await import("../src/integrations/anthropic/wrap.js");
  const { autocontextSession } = await import("../src/integrations/_shared/session.js");

  // Build mock fetch
  let mockFetch;
  if (isError) {
    const errorJson = JSON.parse(readFileSync(join(fixtureDir, "error.json"), "utf-8"));
    // Map class name to Anthropic error type
    const typeMap = {
      "RateLimitError": "rate_limit_error",
      "OverloadedError": "overloaded_error",
      "AuthenticationError": "authentication_error",
      "PermissionDeniedError": "permission_denied_error",
      "BadRequestError": "invalid_request_error",
      "APITimeoutError": "request_too_large",
      "APIConnectionError": "api_error",
    };
    const errType = typeMap[errorJson.class] || "api_error";
    mockFetch = (_url, _init) => Promise.resolve(
      new Response(
        JSON.stringify({"type": "error", "error": {"type": errType, "message": errorJson.message}}),
        { status: errorJson.status, headers: { "content-type": "application/json" } },
      ),
    );
  } else if (isStreaming) {
    const chunks = JSON.parse(readFileSync(join(fixtureDir, "chunks.json"), "utf-8"));
    mockFetch = (_url, _init) => {
      const lines = chunks.map(c => `event: ${c.type}\ndata: ${JSON.stringify(c)}\n\n`).join("");
      return Promise.resolve(new Response(lines, {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      }));
    };
  } else {
    const responseJson = JSON.parse(readFileSync(join(fixtureDir, "response.json"), "utf-8"));
    mockFetch = (_url, _init) => Promise.resolve(
      new Response(JSON.stringify(responseJson), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  }

  // Handle install-salt for session fixtures
  const originalDir = process.cwd();
  const saltFile = join(fixtureDir, "install-salt.txt");
  let changedDir = false;
  if (existsSync(saltFile)) {
    const saltTmpDir = mkdtempSync(join(tmpdir(), "parity-salt-"));
    mkdirSync(join(saltTmpDir, ".autocontext"), { recursive: true });
    const saltContent = readFileSync(saltFile, "utf-8").trim();
    writeFileSync(join(saltTmpDir, ".autocontext", "install-salt"), saltContent);
    process.chdir(saltTmpDir);
    changedDir = true;
  }

  // Create mock Anthropic client
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const inner = new Anthropic({ apiKey: "test-key", fetch: mockFetch, maxRetries: 0 });

  const sink = new FileSink(tracePath, { batchSize: 1, flushIntervalSeconds: 0 });
  const client = instrumentClient(inner, {
    sink,
    appId: "parity-test-app",
    environmentTag: "test",
  });

  const runRequest = async () => {
    const requestKwargs = { ...requestJson };
    if (isStreaming) requestKwargs.stream = true;

    if (isStreaming) {
      try {
        if (fixtureName === "messages-streaming-abandoned") {
          await (async () => {
            const stream = client.messages.create(requestKwargs);
            const iter = stream[Symbol.asyncIterator]();
            await iter.next(); // read one event then let go out of scope
          })();
          if (typeof gc !== "undefined") { gc(); gc(); }
          await new Promise(r => setTimeout(r, 300));
        } else {
          const stream = client.messages.create(requestKwargs);
          for await (const _chunk of stream) { /* consume */ }
        }
      } catch { /* expected for error fixtures */ }
    } else {
      try {
        await client.messages.create(requestKwargs);
      } catch { /* expected for error fixtures */ }
    }
    sink.flush();
    sink.close();
  };

  if (identityJson.userId || identityJson.sessionId) {
    await autocontextSession(
      { userId: identityJson.userId, sessionId: identityJson.sessionId },
      runRequest,
    );
  } else {
    await runRequest();
  }

  if (changedDir) process.chdir(originalDir);

  // Read trace
  let rawTrace;
  try {
    const content = readFileSync(tracePath, "utf-8").trim();
    if (!content) { process.stderr.write("No trace emitted\n"); process.exit(1); }
    rawTrace = JSON.parse(content.split("\n")[0]);
  } catch (e) {
    process.stderr.write(`Failed to read trace: ${e}\n`);
    process.exit(1);
  }

  const normalized = normalizeTrace(rawTrace, fixtureName);
  process.stdout.write(canonicalJson(normalized) + "\n");
  process.exit(0);
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}

function normalizeTrace(trace, fixtureName) {
  const t = { ...trace };
  t.traceId = "PARITY_TRACE_ID_NORMALIZED";
  t.timing = { startedAt: "2024-01-01T00:00:00Z", endedAt: "2024-01-01T00:00:01Z", latencyMs: 1000 };
  if (t.source?.sdk) t.source = { ...t.source, sdk: { name: "autocontext-sdk", version: "0.0.0" } };
  if (Array.isArray(t.messages)) {
    t.messages = t.messages.map(m => ({ ...m, timestamp: "2024-01-01T00:00:00Z" }));
  }
  if (t.outcome?.error) {
    const err = { ...t.outcome.error };
    if (err.stack) err.stack = "NORMALIZED";
    if (err.message) err.message = "NORMALIZED";
    if (err.type) err.type = "NORMALIZED";
    t.outcome = { ...t.outcome, error: err };
  }
  return t;
}

function canonicalJson(obj) {
  if (Array.isArray(obj)) return "[" + obj.map(canonicalJson).join(",") + "]";
  if (obj === null) return "null";
  if (typeof obj !== "object") return JSON.stringify(obj);
  const keys = Object.keys(obj).sort();
  return "{" + keys.map(k => JSON.stringify(k) + ":" + canonicalJson(obj[k])).join(",") + "}";
}
