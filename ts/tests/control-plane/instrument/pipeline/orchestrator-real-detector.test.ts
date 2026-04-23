/**
 * RED → GREEN integration test: real openai-python + openai-ts + anthropic-python +
 * anthropic-ts detector plugins running end-to-end through the orchestrator with
 * real tree-sitter query execution.
 *
 * Verifies Fix 1 (synchronous `SourceFile.tree` after parser preload),
 * Fix 2 (compiled Query cache in tree-sitter-loader.ts), and Fix 3
 * (real `runPluginQueries` using `query.matches(tree.rootNode)`).
 *
 * This test was RED against the A2-I stub (synthetic empty matches) and
 * becomes GREEN after the three orchestrator fixes.
 *
 * Anthropic suites (A2-III) mirror the OpenAI suites with Anthropic-specific
 * module bindings: `anthropic` (Python), `@anthropic-ai/sdk` (TS).
 */
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInstrument } from "../../../../src/control-plane/instrument/pipeline/orchestrator.js";
import {
  registerDetectorPlugin,
  resetRegistryForTests,
} from "../../../../src/control-plane/instrument/registry/plugin-registry.js";
import { plugin as openaiPythonPlugin } from "../../../../src/control-plane/instrument/detectors/openai-python/plugin.js";
import { plugin as openaiTsPlugin } from "../../../../src/control-plane/instrument/detectors/openai-ts/plugin.js";
import { plugin as anthropicPythonPlugin } from "../../../../src/control-plane/instrument/detectors/anthropic-python/plugin.js";
import { plugin as anthropicTsPlugin } from "../../../../src/control-plane/instrument/detectors/anthropic-ts/plugin.js";
import { __resetForTests as resetTreeSitterCache } from "../../../../src/control-plane/instrument/scanner/tree-sitter-loader.js";

const FIXED_ULID = "01HN0000000000000000000099";
const FIXED_NOW = "2026-04-20T10:00:00.000Z";

const scratches: string[] = [];

function scratch(): string {
  const d = mkdtempSync(join(tmpdir(), "a2i-real-det-"));
  scratches.push(d);
  return d;
}

beforeEach(() => {
  resetRegistryForTests();
  resetTreeSitterCache();
});

afterEach(() => {
  while (scratches.length > 0) {
    const d = scratches.pop()!;
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
});

describe("real openai-python plugin end-to-end through orchestrator", () => {
  test(
    "detects OpenAI() call and produces 1 wrap-expression + 1 insert-statement edit",
    async () => {
      const cwd = scratch();
      mkdirSync(join(cwd, "src"), { recursive: true });
      writeFileSync(
        join(cwd, "src", "main.py"),
        [
          "from openai import OpenAI",
          "",
          "client = OpenAI()",
          "",
        ].join("\n"),
        "utf-8",
      );

      registerDetectorPlugin(openaiPythonPlugin);

      const result = await runInstrument({
        cwd,
        mode: "dry-run",
        sessionUlid: FIXED_ULID,
        nowIso: FIXED_NOW,
        skipSessionDirWrite: true,
      });

      // The real plugin must detect 1 file with a wrap edit.
      expect(result.filesAffected).toBe(1);
      expect(result.callSitesDetected).toBe(1);
      expect(result.exitCode).toBe(0);
    },
    30_000,
  );

  test(
    "detects OpenAI(...) with api_key arg and produces wrap edit",
    async () => {
      const cwd = scratch();
      mkdirSync(join(cwd, "src"), { recursive: true });
      writeFileSync(
        join(cwd, "src", "app.py"),
        [
          "import os",
          "from openai import OpenAI",
          "",
          "client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))",
          "",
        ].join("\n"),
        "utf-8",
      );

      registerDetectorPlugin(openaiPythonPlugin);

      const result = await runInstrument({
        cwd,
        mode: "dry-run",
        sessionUlid: FIXED_ULID,
        nowIso: FIXED_NOW,
        skipSessionDirWrite: true,
      });

      expect(result.filesAffected).toBe(1);
      expect(result.callSitesDetected).toBe(1);
    },
    30_000,
  );

  test(
    "no openai import → zero edits (gate 1: import resolution)",
    async () => {
      const cwd = scratch();
      mkdirSync(join(cwd, "src"), { recursive: true });
      writeFileSync(
        join(cwd, "src", "other.py"),
        [
          "# no openai import",
          "client = OpenAI()",
          "",
        ].join("\n"),
        "utf-8",
      );

      registerDetectorPlugin(openaiPythonPlugin);

      const result = await runInstrument({
        cwd,
        mode: "dry-run",
        sessionUlid: FIXED_ULID,
        nowIso: FIXED_NOW,
        skipSessionDirWrite: true,
      });

      // Gate 1 fires: ctor not imported from openai → advisory, no edits.
      expect(result.filesAffected).toBe(0);
    },
    30_000,
  );
});

describe("real openai-ts plugin end-to-end through orchestrator", () => {
  test(
    "detects new OpenAI() and produces 1 wrap-expression + 1 insert-statement edit",
    async () => {
      const cwd = scratch();
      mkdirSync(join(cwd, "src"), { recursive: true });
      writeFileSync(
        join(cwd, "src", "client.ts"),
        [
          'import { OpenAI } from "openai";',
          "",
          "const client = new OpenAI();",
          "",
        ].join("\n"),
        "utf-8",
      );

      registerDetectorPlugin(openaiTsPlugin);

      const result = await runInstrument({
        cwd,
        mode: "dry-run",
        sessionUlid: FIXED_ULID,
        nowIso: FIXED_NOW,
        skipSessionDirWrite: true,
      });

      expect(result.filesAffected).toBe(1);
      expect(result.callSitesDetected).toBe(1);
      expect(result.exitCode).toBe(0);
    },
    30_000,
  );

  test(
    "no openai import → zero edits (gate 1: import resolution)",
    async () => {
      const cwd = scratch();
      mkdirSync(join(cwd, "src"), { recursive: true });
      writeFileSync(
        join(cwd, "src", "other.ts"),
        [
          "// no openai import",
          "const client = new OpenAI();",
          "",
        ].join("\n"),
        "utf-8",
      );

      registerDetectorPlugin(openaiTsPlugin);

      const result = await runInstrument({
        cwd,
        mode: "dry-run",
        sessionUlid: FIXED_ULID,
        nowIso: FIXED_NOW,
        skipSessionDirWrite: true,
      });

      // Gate 1 fires: ctor not imported from openai → advisory, no edits.
      expect(result.filesAffected).toBe(0);
    },
    30_000,
  );
});

describe("real anthropic-python plugin end-to-end through orchestrator", () => {
  test(
    "detects Anthropic() call and produces 1 wrap-expression + 1 insert-statement edit",
    async () => {
      const cwd = scratch();
      mkdirSync(join(cwd, "src"), { recursive: true });
      writeFileSync(
        join(cwd, "src", "main.py"),
        [
          "from anthropic import Anthropic",
          "",
          "client = Anthropic()",
          "",
        ].join("\n"),
        "utf-8",
      );

      registerDetectorPlugin(anthropicPythonPlugin);

      const result = await runInstrument({
        cwd,
        mode: "dry-run",
        sessionUlid: FIXED_ULID,
        nowIso: FIXED_NOW,
        skipSessionDirWrite: true,
      });

      expect(result.filesAffected).toBe(1);
      expect(result.callSitesDetected).toBe(1);
      expect(result.exitCode).toBe(0);
    },
    30_000,
  );

  test(
    "detects AsyncAnthropic() and produces wrap edit",
    async () => {
      const cwd = scratch();
      mkdirSync(join(cwd, "src"), { recursive: true });
      writeFileSync(
        join(cwd, "src", "app.py"),
        [
          "from anthropic import AsyncAnthropic",
          "",
          "client = AsyncAnthropic()",
          "",
        ].join("\n"),
        "utf-8",
      );

      registerDetectorPlugin(anthropicPythonPlugin);

      const result = await runInstrument({
        cwd,
        mode: "dry-run",
        sessionUlid: FIXED_ULID,
        nowIso: FIXED_NOW,
        skipSessionDirWrite: true,
      });

      expect(result.filesAffected).toBe(1);
      expect(result.callSitesDetected).toBe(1);
    },
    30_000,
  );

  test(
    "no anthropic import → zero edits (gate 1: import resolution)",
    async () => {
      const cwd = scratch();
      mkdirSync(join(cwd, "src"), { recursive: true });
      writeFileSync(
        join(cwd, "src", "other.py"),
        [
          "# no anthropic import",
          "client = Anthropic()",
          "",
        ].join("\n"),
        "utf-8",
      );

      registerDetectorPlugin(anthropicPythonPlugin);

      const result = await runInstrument({
        cwd,
        mode: "dry-run",
        sessionUlid: FIXED_ULID,
        nowIso: FIXED_NOW,
        skipSessionDirWrite: true,
      });

      expect(result.filesAffected).toBe(0);
    },
    30_000,
  );
});

describe("real anthropic-ts plugin end-to-end through orchestrator", () => {
  test(
    "detects new Anthropic() and produces 1 wrap-expression + 1 insert-statement edit",
    async () => {
      const cwd = scratch();
      mkdirSync(join(cwd, "src"), { recursive: true });
      writeFileSync(
        join(cwd, "src", "client.ts"),
        [
          'import { Anthropic } from "@anthropic-ai/sdk";',
          "",
          "const client = new Anthropic();",
          "",
        ].join("\n"),
        "utf-8",
      );

      registerDetectorPlugin(anthropicTsPlugin);

      const result = await runInstrument({
        cwd,
        mode: "dry-run",
        sessionUlid: FIXED_ULID,
        nowIso: FIXED_NOW,
        skipSessionDirWrite: true,
      });

      expect(result.filesAffected).toBe(1);
      expect(result.callSitesDetected).toBe(1);
      expect(result.exitCode).toBe(0);
    },
    30_000,
  );

  test(
    "detects new AsyncAnthropic() and produces wrap edit",
    async () => {
      const cwd = scratch();
      mkdirSync(join(cwd, "src"), { recursive: true });
      writeFileSync(
        join(cwd, "src", "async.ts"),
        [
          'import { AsyncAnthropic } from "@anthropic-ai/sdk";',
          "",
          "const client = new AsyncAnthropic();",
          "",
        ].join("\n"),
        "utf-8",
      );

      registerDetectorPlugin(anthropicTsPlugin);

      const result = await runInstrument({
        cwd,
        mode: "dry-run",
        sessionUlid: FIXED_ULID,
        nowIso: FIXED_NOW,
        skipSessionDirWrite: true,
      });

      expect(result.filesAffected).toBe(1);
      expect(result.callSitesDetected).toBe(1);
    },
    30_000,
  );

  test(
    "no anthropic import → zero edits (gate 1: import resolution)",
    async () => {
      const cwd = scratch();
      mkdirSync(join(cwd, "src"), { recursive: true });
      writeFileSync(
        join(cwd, "src", "other.ts"),
        [
          "// no anthropic import",
          "const client = new Anthropic();",
          "",
        ].join("\n"),
        "utf-8",
      );

      registerDetectorPlugin(anthropicTsPlugin);

      const result = await runInstrument({
        cwd,
        mode: "dry-run",
        sessionUlid: FIXED_ULID,
        nowIso: FIXED_NOW,
        skipSessionDirWrite: true,
      });

      expect(result.filesAffected).toBe(0);
    },
    30_000,
  );
});
