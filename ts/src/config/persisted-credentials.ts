import { existsSync } from "node:fs";
import { join } from "node:path";

import { CREDENTIALS_FILE, resolveApiKeyValue } from "./credentials.js";
import { isRecord, readJsonObject } from "./config-json-helpers.js";

export interface StoredCredentials {
  provider?: string;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  savedAt?: string;
}

export function resolveConfigDir(explicit?: string): string {
  return (
    explicit ??
    process.env.AUTOCONTEXT_CONFIG_DIR ??
    join(process.env.HOME ?? "~", ".config", "autoctx")
  );
}

export function readStoredCredentialEntry(
  providerName: string,
  entry: Record<string, unknown>,
): StoredCredentials {
  const credentials: StoredCredentials = { provider: providerName };
  if (typeof entry.apiKey === "string" && entry.apiKey.trim()) {
    credentials.apiKey = resolveApiKeyValue(entry.apiKey.trim());
  }
  if (typeof entry.model === "string" && entry.model.trim()) {
    credentials.model = entry.model.trim();
  }
  if (typeof entry.baseUrl === "string" && entry.baseUrl.trim()) {
    credentials.baseUrl = entry.baseUrl.trim();
  }
  if (typeof entry.savedAt === "string" && entry.savedAt.trim()) {
    credentials.savedAt = entry.savedAt.trim();
  }
  return credentials;
}

export function loadPersistedCredentials(
  configDir = resolveConfigDir(),
  provider?: string,
): StoredCredentials | null {
  const credentialsPath = join(configDir, CREDENTIALS_FILE);
  if (!existsSync(credentialsPath)) {
    return null;
  }

  const raw = readJsonObject(credentialsPath, CREDENTIALS_FILE);
  const requestedProvider = provider?.trim().toLowerCase();

  if (isRecord(raw.providers)) {
    const providers = raw.providers as Record<string, Record<string, unknown>>;
    const names = Object.keys(providers);
    if (names.length === 0) return null;

    if (requestedProvider) {
      const matchedName = names.find((name) => name.toLowerCase() === requestedProvider);
      if (!matchedName) {
        return null;
      }
      return readStoredCredentialEntry(matchedName, providers[matchedName]);
    }

    const firstName = names[0];
    return readStoredCredentialEntry(firstName, providers[firstName]);
  }

  const credentials: StoredCredentials = {};
  if (typeof raw.provider === "string" && raw.provider.trim()) {
    credentials.provider = raw.provider.trim();
  }
  if (
    requestedProvider &&
    credentials.provider &&
    credentials.provider.toLowerCase() !== requestedProvider
  ) {
    return null;
  }
  if (requestedProvider && !credentials.provider) {
    credentials.provider = requestedProvider;
  }
  if (typeof raw.apiKey === "string" && raw.apiKey.trim()) {
    credentials.apiKey = resolveApiKeyValue(raw.apiKey.trim());
  }
  if (typeof raw.model === "string" && raw.model.trim()) {
    credentials.model = raw.model.trim();
  }
  if (typeof raw.baseUrl === "string" && raw.baseUrl.trim()) {
    credentials.baseUrl = raw.baseUrl.trim();
  }
  if (typeof raw.savedAt === "string" && raw.savedAt.trim()) {
    credentials.savedAt = raw.savedAt.trim();
  }

  return credentials;
}
