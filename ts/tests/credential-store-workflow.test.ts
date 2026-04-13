import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  CREDENTIALS_FILE,
  listConfiguredProviders,
  loadProviderCredentials,
  removeProviderCredentials,
  resolveApiKeyValue,
  saveProviderCredentials,
} from "../src/config/credential-store.js";

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "ac-credential-store-"));
}

describe("credential store workflow", () => {
  let dir: string;

  beforeEach(() => {
    dir = makeTempDir();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("saves, loads, lists, and removes provider credentials with hardened file perms", () => {
    saveProviderCredentials(dir, "anthropic", { apiKey: "sk-ant-123", model: "claude" });
    saveProviderCredentials(dir, "openai", { apiKey: "sk-openai-456", baseUrl: "https://api.openai.com/v1" });

    expect(loadProviderCredentials(dir, "anthropic")).toMatchObject({
      apiKey: "sk-ant-123",
      model: "claude",
    });
    expect(listConfiguredProviders(dir)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provider: "anthropic", hasApiKey: true }),
        expect.objectContaining({ provider: "openai", hasApiKey: true, baseUrl: "https://api.openai.com/v1" }),
      ]),
    );
    expect(removeProviderCredentials(dir, "anthropic")).toBe(true);
    expect(loadProviderCredentials(dir, "anthropic")).toBeNull();
    expect(statSync(join(dir, CREDENTIALS_FILE)).mode & 0o777).toBe(0o600);
  });

  it("reads legacy single-provider credential files", () => {
    writeFileSync(join(dir, CREDENTIALS_FILE), JSON.stringify({
      provider: "anthropic",
      apiKey: "sk-legacy-key",
      model: "claude-legacy",
    }), "utf-8");

    expect(loadProviderCredentials(dir, "anthropic")).toMatchObject({
      apiKey: "sk-legacy-key",
      model: "claude-legacy",
    });
  });

  it("resolves literal and shell-command api key values", () => {
    expect(resolveApiKeyValue("sk-ant-123")).toBe("sk-ant-123");
    expect(resolveApiKeyValue("!echo workflow-key")).toBe("workflow-key");
  });
});
