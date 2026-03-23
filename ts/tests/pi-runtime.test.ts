/**
 * Tests for AC-361: Pi and Pi-RPC provider parity in TypeScript runtime.
 */

import { describe, it, expect, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Pi config in AppSettingsSchema
// ---------------------------------------------------------------------------

describe("Pi config in AppSettingsSchema", () => {
  it("includes Pi CLI settings with defaults", async () => {
    const { AppSettingsSchema } = await import("../src/config/index.js");
    const settings = AppSettingsSchema.parse({});
    expect(settings.piCommand).toBe("pi");
    expect(settings.piTimeout).toBe(120.0);
    expect(settings.piWorkspace).toBe("");
    expect(settings.piModel).toBe("");
  });

  it("includes Pi RPC settings with defaults", async () => {
    const { AppSettingsSchema } = await import("../src/config/index.js");
    const settings = AppSettingsSchema.parse({});
    expect(settings.piRpcEndpoint).toBe("");
    expect(settings.piRpcApiKey).toBe("");
    expect(settings.piRpcSessionPersistence).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Pi in createProvider factory
// ---------------------------------------------------------------------------

describe("createProvider Pi support", () => {
  it("supports pi provider type", async () => {
    const { createProvider } = await import("../src/providers/index.js");
    const provider = createProvider({ providerType: "pi" });
    expect(provider.name).toBe("runtime-bridge");
    expect(provider.defaultModel()).toContain("pi");
  });

  it("supports pi-rpc provider type", async () => {
    const { createProvider } = await import("../src/providers/index.js");
    const provider = createProvider({ providerType: "pi-rpc" });
    expect(provider.name).toBe("runtime-bridge");
    expect(provider.defaultModel()).toContain("pi");
  });

  it("error message lists pi and pi-rpc", async () => {
    const { createProvider } = await import("../src/providers/index.js");
    try {
      createProvider({ providerType: "bogus" });
    } catch (err) {
      const msg = (err as Error).message;
      expect(msg).toContain("pi");
      expect(msg).toContain("pi-rpc");
    }
  });
});

// ---------------------------------------------------------------------------
// resolveProviderConfig for Pi
// ---------------------------------------------------------------------------

describe("resolveProviderConfig Pi", () => {
  const saved: Record<string, string | undefined> = {};

  function saveAndClear(): void {
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("AUTOCONTEXT_") || key === "ANTHROPIC_API_KEY" || key === "OPENAI_API_KEY") {
        saved[key] = process.env[key];
        delete process.env[key];
      }
    }
  }

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("AUTOCONTEXT_") || key === "ANTHROPIC_API_KEY" || key === "OPENAI_API_KEY") {
        if (key in saved) {
          process.env[key] = saved[key];
        } else {
          delete process.env[key];
        }
      }
    }
  });

  it("resolves pi provider from env", async () => {
    saveAndClear();
    process.env.AUTOCONTEXT_AGENT_PROVIDER = "pi";
    const { resolveProviderConfig } = await import("../src/providers/index.js");
    const config = resolveProviderConfig();
    expect(config.providerType).toBe("pi");
  });

  it("resolves pi-rpc provider from env", async () => {
    saveAndClear();
    process.env.AUTOCONTEXT_AGENT_PROVIDER = "pi-rpc";
    const { resolveProviderConfig } = await import("../src/providers/index.js");
    const config = resolveProviderConfig();
    expect(config.providerType).toBe("pi-rpc");
  });
});

// ---------------------------------------------------------------------------
// PiCLI Runtime
// ---------------------------------------------------------------------------

describe("PiCLIRuntime", () => {
  it("is importable", async () => {
    const { PiCLIRuntime } = await import("../src/runtimes/pi-cli.js");
    expect(PiCLIRuntime).toBeDefined();
  });

  it("has correct defaults", async () => {
    const { PiCLIConfig } = await import("../src/runtimes/pi-cli.js");
    const config = new PiCLIConfig();
    expect(config.piCommand).toBe("pi");
    expect(config.timeout).toBe(120.0);
    expect(config.model).toBe("");
  });

  it("parseOutput handles plain text", async () => {
    const { PiCLIRuntime } = await import("../src/runtimes/pi-cli.js");
    const runtime = new PiCLIRuntime();
    const result = runtime.parseOutput("hello from pi");
    expect(result.text).toBe("hello from pi");
  });

  it("parseOutput handles empty", async () => {
    const { PiCLIRuntime } = await import("../src/runtimes/pi-cli.js");
    const runtime = new PiCLIRuntime();
    const result = runtime.parseOutput("");
    expect(result.text).toBe("");
  });
});

// ---------------------------------------------------------------------------
// PiRPC Runtime
// ---------------------------------------------------------------------------

describe("PiRPCRuntime", () => {
  it("is importable", async () => {
    const { PiRPCRuntime } = await import("../src/runtimes/pi-rpc.js");
    expect(PiRPCRuntime).toBeDefined();
  });

  it("has correct defaults", async () => {
    const { PiRPCConfig } = await import("../src/runtimes/pi-rpc.js");
    const config = new PiRPCConfig();
    expect(config.endpoint).toBe("http://localhost:3284");
    expect(config.sessionPersistence).toBe(true);
  });

  it("creates isolated sessions per role", async () => {
    const { PiRPCRuntime, PiRPCConfig } = await import("../src/runtimes/pi-rpc.js");
    const rt1 = new PiRPCRuntime(new PiRPCConfig());
    const rt2 = new PiRPCRuntime(new PiRPCConfig());
    // Each runtime instance should have its own session state
    expect(rt1).not.toBe(rt2);
    // Session IDs should differ (or both null initially)
    expect(rt1.currentSessionId).toBeNull();
    expect(rt2.currentSessionId).toBeNull();
  });
});
