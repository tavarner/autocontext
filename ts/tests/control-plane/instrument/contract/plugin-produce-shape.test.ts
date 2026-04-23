import { describe, test, expect } from "vitest";
import type { DetectorPlugin, PluginAdvisory } from "../../../../src/control-plane/instrument/contract/plugin-interface.js";

describe("DetectorPlugin.produce() widened return shape", () => {
  test("type allows {edits, advisories} return", () => {
    const p: DetectorPlugin = {
      id: "@test/p",
      supports: { language: "python", sdkName: "openai" },
      treeSitterQueries: [],
      produce: (_match, _sourceFile) => ({ edits: [], advisories: [] }),
    };
    const result = p.produce({ captures: [] }, {} as any);
    expect(result).toHaveProperty("edits");
    expect(result).toHaveProperty("advisories");
  });

  test("PluginAdvisory has required kind values", () => {
    const a: PluginAdvisory = {
      pluginId: "@test/p",
      sourceFilePath: "x.py",
      range: { startByte: 0, endByte: 0, startLineCol: { line: 1, col: 0 }, endLineCol: { line: 1, col: 0 } },
      kind: "factoryFunction",
      reason: "r",
    };
    expect(a.kind).toBe("factoryFunction");
  });

  test("PluginAdvisory accepts deferred-sdk-variant kind (A2-III)", () => {
    const a: PluginAdvisory = {
      pluginId: "@autoctx/detector-anthropic-python",
      sourceFilePath: "app.py",
      range: { startByte: 0, endByte: 20, startLineCol: { line: 1, col: 0 }, endLineCol: { line: 1, col: 20 } },
      kind: "deferred-sdk-variant",
      reason: "AnthropicBedrock deferred to a2-iii-bedrock; wrap manually: instrument_client(AnthropicBedrock(...))",
    };
    expect(a.kind).toBe("deferred-sdk-variant");
  });

  test("PluginAdvisory accepts already-wrapped kind", () => {
    const a: PluginAdvisory = {
      pluginId: "@autoctx/detector-anthropic-ts",
      sourceFilePath: "client.ts",
      range: { startByte: 0, endByte: 10, startLineCol: { line: 1, col: 0 }, endLineCol: { line: 1, col: 10 } },
      kind: "already-wrapped",
      reason: "already wrapped by instrumentClient",
    };
    expect(a.kind).toBe("already-wrapped");
  });

  test("PluginAdvisory accepts unresolved-import kind", () => {
    const a: PluginAdvisory = {
      pluginId: "@autoctx/detector-anthropic-python",
      sourceFilePath: "app.py",
      range: { startByte: 0, endByte: 10, startLineCol: { line: 1, col: 0 }, endLineCol: { line: 1, col: 10 } },
      kind: "unresolved-import",
      reason: "Anthropic not imported from anthropic",
    };
    expect(a.kind).toBe("unresolved-import");
  });
});
