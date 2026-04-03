/**
 * Tests for AC-522: Provider surface consistency.
 *
 * KNOWN_PROVIDERS (credentials.ts), createProvider() factory,
 * and README must all agree on which providers exist.
 */

import { describe, expect, it } from "vitest";

describe("Provider surface consistency", () => {
  it("KNOWN_PROVIDERS includes all createProvider factory types", async () => {
    const { KNOWN_PROVIDERS } = await import("../src/config/credentials.js");
    const knownIds = new Set(KNOWN_PROVIDERS.map((p: { id: string }) => p.id));

    // These are all types that createProvider() can handle
    const factoryTypes = [
      "anthropic",
      "openai",
      "openai-compatible",
      "ollama",
      "vllm",
      "hermes",
      "pi",
      "pi-rpc",
      "deterministic",
    ];

    for (const type of factoryTypes) {
      expect(knownIds.has(type), `KNOWN_PROVIDERS missing factory type: ${type}`).toBe(true);
    }
  });

  it("createProvider() handles all KNOWN_PROVIDERS ids", async () => {
    const { KNOWN_PROVIDERS } = await import("../src/config/credentials.js");
    const { createProvider } = await import("../src/providers/index.js");

    // Every KNOWN_PROVIDER id should be accepted by createProvider without throwing "Unknown provider"
    // We can't fully construct all (missing API keys), but the factory should recognize the type
    const knownIds = KNOWN_PROVIDERS.map((p: { id: string }) => p.id);

    for (const id of knownIds) {
      // For key-requiring providers, createProvider may throw on missing key,
      // but should NOT throw "Unknown provider type"
      try {
        createProvider({ providerType: id });
      } catch (e: any) {
        expect(e.message).not.toContain("Unknown provider type");
      }
    }
  });

  it("KNOWN_PROVIDERS has entries for pi, pi-rpc, hermes", async () => {
    const { KNOWN_PROVIDERS } = await import("../src/config/credentials.js");
    const ids = KNOWN_PROVIDERS.map((p: { id: string }) => p.id);

    expect(ids).toContain("pi");
    expect(ids).toContain("pi-rpc");
    expect(ids).toContain("hermes");
  });

  it("KNOWN_PROVIDERS has at least 13 entries (all providers)", async () => {
    const { KNOWN_PROVIDERS } = await import("../src/config/credentials.js");
    expect(KNOWN_PROVIDERS.length).toBeGreaterThanOrEqual(13);
  });
});
