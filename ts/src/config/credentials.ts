/**
 * Credential storage with hardened security (AC-430 Phase 1).
 *
 * Features:
 * - Multi-provider credential store (provider-keyed entries)
 * - 0600 file permissions on credential files
 * - Shell-command escape hatch for API key values (! prefix)
 * - API key format validation per provider
 * - Backward compatibility with legacy single-provider format
 */

import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

export const CREDENTIALS_FILE = "credentials.json";

export interface ProviderCredentials {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  savedAt?: string;
}

export interface ProviderAuthStatus {
  provider: string;
  hasApiKey: boolean;
  model?: string;
  baseUrl?: string;
  savedAt?: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Shell-command escape hatch
// ---------------------------------------------------------------------------

/**
 * Resolve an API key value. If the value starts with `!`, execute it as a
 * shell command and return the trimmed stdout. Otherwise return as-is.
 *
 * The `!` prefix is intentional: it allows users to store keychain lookups
 * like `!security find-generic-password -ws 'anthropic'` or
 * `!op read op://vault/anthropic/key` in their credentials file, matching
 * Pi's credential resolution pattern.
 *
 * This is NOT arbitrary user input — it's a value the user explicitly wrote
 * into their own config file, similar to Git's credential helpers.
 */
export function resolveApiKeyValue(value: string): string {
  if (!value || !value.startsWith("!")) {
    return value;
  }

  const command = value.slice(1).trim();
  // Use sh -c to support pipes, shell builtins, and complex commands
  // that keychain tools require (e.g. `security find-generic-password -ws 'name'`).
  // This is safe because the command comes from the user's own config file,
  // not from untrusted input.
  const result = execFileSync("/bin/sh", ["-c", command], {
    encoding: "utf-8",
    timeout: 10_000,
    stdio: ["pipe", "pipe", "pipe"],
  });
  return result.trim();
}

// ---------------------------------------------------------------------------
// Multi-provider credential store
// ---------------------------------------------------------------------------

interface CredentialStore {
  providers: Record<string, ProviderCredentials>;
}

function isLegacyFormat(data: Record<string, unknown>): boolean {
  return typeof data.provider === "string" && !data.providers;
}

function readStore(configDir: string): CredentialStore {
  const filePath = join(configDir, CREDENTIALS_FILE);
  if (!existsSync(filePath)) {
    return { providers: {} };
  }

  const raw = JSON.parse(readFileSync(filePath, "utf-8")) as Record<string, unknown>;

  // Legacy single-provider format migration
  if (isLegacyFormat(raw)) {
    const provider = (raw.provider as string).trim();
    const creds: ProviderCredentials = {};
    if (typeof raw.apiKey === "string" && raw.apiKey.trim()) creds.apiKey = raw.apiKey.trim();
    if (typeof raw.model === "string" && raw.model.trim()) creds.model = raw.model.trim();
    if (typeof raw.baseUrl === "string" && raw.baseUrl.trim()) creds.baseUrl = raw.baseUrl.trim();
    if (typeof raw.savedAt === "string" && raw.savedAt.trim()) creds.savedAt = raw.savedAt.trim();
    return { providers: { [provider]: creds } };
  }

  // New multi-provider format
  const providers: Record<string, ProviderCredentials> = {};
  const rawProviders = (raw.providers ?? {}) as Record<string, Record<string, unknown>>;
  for (const [name, entry] of Object.entries(rawProviders)) {
    const creds: ProviderCredentials = {};
    if (typeof entry.apiKey === "string") creds.apiKey = entry.apiKey;
    if (typeof entry.model === "string") creds.model = entry.model;
    if (typeof entry.baseUrl === "string") creds.baseUrl = entry.baseUrl;
    if (typeof entry.savedAt === "string") creds.savedAt = entry.savedAt;
    providers[name] = creds;
  }
  return { providers };
}

function writeStore(configDir: string, store: CredentialStore): void {
  mkdirSync(configDir, { recursive: true });
  const filePath = join(configDir, CREDENTIALS_FILE);
  writeFileSync(filePath, JSON.stringify(store, null, 2), "utf-8");
  chmodSync(filePath, 0o600);
}

export function saveProviderCredentials(
  configDir: string,
  provider: string,
  creds: Omit<ProviderCredentials, "savedAt">,
): void {
  const store = readStore(configDir);
  store.providers[provider] = {
    ...creds,
    savedAt: new Date().toISOString(),
  };
  writeStore(configDir, store);
}

export function loadProviderCredentials(
  configDir: string,
  provider: string,
): ProviderCredentials | null {
  const store = readStore(configDir);
  return store.providers[provider] ?? null;
}

export function listConfiguredProviders(configDir: string): ProviderAuthStatus[] {
  const store = readStore(configDir);
  return Object.entries(store.providers).map(([name, creds]) => ({
    provider: name,
    hasApiKey: Boolean(creds.apiKey),
    ...(creds.model ? { model: creds.model } : {}),
    ...(creds.baseUrl ? { baseUrl: creds.baseUrl } : {}),
    ...(creds.savedAt ? { savedAt: creds.savedAt } : {}),
  }));
}

// ---------------------------------------------------------------------------
// API key format validation
// ---------------------------------------------------------------------------

const KEY_FORMAT_RULES: Record<string, { prefix?: string; label: string }> = {
  anthropic: { prefix: "sk-ant-", label: "Anthropic" },
  openai: { prefix: "sk-", label: "OpenAI" },
};

const NO_KEY_PROVIDERS = new Set(["ollama", "deterministic"]);

export async function validateApiKey(
  provider: string,
  apiKey: string,
): Promise<ValidationResult> {
  const normalized = provider.toLowerCase();

  // Providers that don't need keys
  if (NO_KEY_PROVIDERS.has(normalized)) {
    return { valid: true };
  }

  // Empty key check
  if (!apiKey) {
    return { valid: false, error: `API key is empty for ${provider}` };
  }

  // Format check for known providers
  const rule = KEY_FORMAT_RULES[normalized];
  if (rule?.prefix && !apiKey.startsWith(rule.prefix)) {
    return {
      valid: false,
      error: `Invalid ${rule.label} API key format: expected '${rule.prefix}...' prefix`,
    };
  }

  // Unknown providers: any non-empty key is accepted
  return { valid: true };
}
