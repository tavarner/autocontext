/**
 * TUI auth command handlers (AC-408).
 *
 * Shared credential store operations for /login, /logout, /provider, /whoami
 * TUI commands. Uses the same credential store as `autoctx login` (CLI).
 */

import {
  saveProviderCredentials,
  loadProviderCredentials,
  removeProviderCredentials,
  listConfiguredProviders,
  validateApiKey,
  getKnownProvider,
  CREDENTIALS_FILE,
} from "../config/credentials.js";
import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";

export interface TuiLoginResult {
  saved: boolean;
  provider: string;
  validationWarning?: string;
}

export interface TuiAuthStatus {
  provider: string;
  authenticated: boolean;
  model?: string;
  configuredProviders?: Array<{ provider: string; hasApiKey: boolean }>;
}

export interface ResolvedTuiAuthSelection extends TuiAuthStatus {
  apiKey?: string;
  baseUrl?: string;
}

function normalizeProvider(provider: string): string {
  return provider.trim().toLowerCase();
}

export async function handleTuiLogin(
  configDir: string,
  provider: string,
  apiKey?: string,
  model?: string,
  baseUrl?: string,
): Promise<TuiLoginResult> {
  const normalizedProvider = normalizeProvider(provider);
  const providerInfo = getKnownProvider(normalizedProvider);
  const requiresKey = providerInfo?.requiresKey ?? true;

  if (requiresKey && !apiKey) {
    return {
      saved: false,
      provider: normalizedProvider,
      validationWarning: `${normalizedProvider} requires an API key.`,
    };
  }

  let validationWarning: string | undefined;

  if (apiKey) {
    const validation = await validateApiKey(normalizedProvider, apiKey);
    if (!validation.valid) {
      validationWarning = validation.error;
    }
  }

  const creds: Record<string, string | undefined> = {};
  if (apiKey) creds.apiKey = apiKey;
  if (model) creds.model = model;
  if (baseUrl) creds.baseUrl = baseUrl;

  saveProviderCredentials(configDir, normalizedProvider, creds);

  return {
    saved: true,
    provider: normalizedProvider,
    ...(validationWarning ? { validationWarning } : {}),
  };
}

export function handleTuiLogout(configDir: string, provider?: string): void {
  if (provider) {
    removeProviderCredentials(configDir, normalizeProvider(provider));
  } else {
    // Clear entire credential file
    const credPath = join(configDir, CREDENTIALS_FILE);
    if (existsSync(credPath)) {
      unlinkSync(credPath);
    }
  }
}

export function resolveTuiAuthSelection(
  configDir: string,
  preferredProvider?: string,
): ResolvedTuiAuthSelection {
  const configured = listConfiguredProviders(configDir);
  const normalizedPreferred = preferredProvider?.trim()
    ? normalizeProvider(preferredProvider)
    : undefined;
  const activeProvider = normalizedPreferred ?? configured[0]?.provider ?? null;

  if (!activeProvider) {
    return { provider: "none", authenticated: false, configuredProviders: [] };
  }

  const creds = loadProviderCredentials(configDir, activeProvider);
  const providerInfo = getKnownProvider(activeProvider);
  const authenticated = Boolean(creds?.apiKey) || Boolean(providerInfo && !providerInfo.requiresKey);

  return {
    provider: activeProvider,
    authenticated,
    ...(creds?.apiKey ? { apiKey: creds.apiKey } : {}),
    ...(creds?.model ? { model: creds.model } : {}),
    ...(creds?.baseUrl ? { baseUrl: creds.baseUrl } : {}),
    configuredProviders: configured.map((c) => ({
      provider: c.provider,
      hasApiKey: c.hasApiKey,
    })),
  };
}

export function handleTuiSwitchProvider(configDir: string, provider: string): TuiAuthStatus {
  return handleTuiWhoami(configDir, provider);
}

export function handleTuiWhoami(configDir: string, preferredProvider?: string): TuiAuthStatus {
  const selection = resolveTuiAuthSelection(configDir, preferredProvider);
  return {
    provider: selection.provider,
    authenticated: selection.authenticated,
    ...(selection.model ? { model: selection.model } : {}),
    ...(selection.configuredProviders ? { configuredProviders: selection.configuredProviders } : {}),
  };
}
