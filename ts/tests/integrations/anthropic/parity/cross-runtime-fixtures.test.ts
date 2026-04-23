/**
 * Cross-runtime parity fixtures for Anthropic integration.
 * Mirrors ts/tests/integrations/openai/parity/cross-runtime-fixtures.test.ts.
 */
import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveParityPython } from "../../../_helpers/python-runner.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../../../..");
const FIXTURES_DIR = join(__dirname, "fixtures");
const PYTHON_ROOT = resolve(ROOT, "..", "autocontext");
const TS_DRIVER = join(ROOT, "scripts", "drive-anthropic-parity-fixture.mjs");
const PY_DRIVER = join(PYTHON_ROOT, "scripts", "drive_anthropic_parity_fixture.py");

const FIXTURES = [
  "minimal-messages-success",
  "messages-with-tool-use",
  "messages-streaming-with-usage",
  "messages-streaming-abandoned",
  "rate-limit-exception",
  "overloaded-exception",
  "api-timeout-exception",
  "session-with-user-id-and-session-id",
  "messages-with-cache-hit",
] as const;

function runTsDriver(fixtureName: string): string {
  const result = spawnSync(
    process.execPath,
    ["--expose-gc", "--import", "tsx/esm", TS_DRIVER, fixtureName],
    { cwd: ROOT, encoding: "utf-8", timeout: 30_000 },
  );
  if (result.status !== 0) {
    throw new Error(`TS driver failed for ${fixtureName}: ${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

function runPyDriver(fixtureName: string): string {
  const uvProbe = spawnSync("uv", ["--version"], { cwd: PYTHON_ROOT, encoding: "utf-8", timeout: 5_000 });
  const result = uvProbe.status === 0
    ? spawnSync("uv", ["run", "python", PY_DRIVER, fixtureName], { cwd: PYTHON_ROOT, encoding: "utf-8", timeout: 30_000 })
    : spawnSync(resolveParityPython(), [PY_DRIVER, fixtureName], {
        cwd: PYTHON_ROOT,
        encoding: "utf-8",
        timeout: 30_000,
        env: { ...process.env, PYTHONPATH: join(PYTHON_ROOT, "src") },
      });
  if (result.status !== 0) {
    const details = result.error?.message || result.stderr || result.stdout || "unknown subprocess failure";
    throw new Error(`Python driver failed for ${fixtureName}: ${details}`);
  }
  return result.stdout.trim();
}

describe("cross-runtime parity fixtures (Anthropic)", () => {
  for (const fixtureName of FIXTURES) {
    describe(fixtureName, () => {
      it("TS output matches expected canonical JSON", () => {
        const expectedPath = join(FIXTURES_DIR, fixtureName, "expected-trace.canonical.json");
        expect(existsSync(expectedPath), `expected-trace.canonical.json missing for ${fixtureName}`).toBe(true);
        const expected = readFileSync(expectedPath, "utf-8").trim();
        const actual = runTsDriver(fixtureName);
        expect(actual).toBe(expected);
      });

      it("Python output matches expected canonical JSON", () => {
        const expectedPath = join(FIXTURES_DIR, fixtureName, "expected-trace.canonical.json");
        const expected = readFileSync(expectedPath, "utf-8").trim();
        const actual = runPyDriver(fixtureName);
        expect(actual).toBe(expected);
      });

      it("TS and Python outputs are byte-identical", () => {
        const tsOut = runTsDriver(fixtureName);
        const pyOut = runPyDriver(fixtureName);
        expect(tsOut).toBe(pyOut);
      });
    });
  }
});
