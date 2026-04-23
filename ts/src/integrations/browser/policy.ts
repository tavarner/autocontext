import {
  BROWSER_CONTRACT_SCHEMA_VERSION,
  validateBrowserSessionConfig,
  type BrowserAction,
  type BrowserPolicyDecision,
  type BrowserSessionConfig,
} from "./contract/index.js";
import type { BrowserSettingsLike } from "./types.js";

const INTERNAL_ALLOWED_URLS = new Set(["about:blank"]);

export function normalizeBrowserAllowedDomains(input: string | readonly string[]): string[] {
  let raw: string[];
  if (typeof input === "string") {
    raw = input.split(",");
  } else {
    raw = [...input];
  }
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const domain = item.trim().toLowerCase();
    if (!domain || seen.has(domain)) {
      continue;
    }
    seen.add(domain);
    normalized.push(domain);
  }
  return normalized;
}

export function buildDefaultBrowserSessionConfig(
  overrides: Partial<BrowserSessionConfig> = {},
): BrowserSessionConfig {
  const config: BrowserSessionConfig = {
    schemaVersion: BROWSER_CONTRACT_SCHEMA_VERSION,
    profileMode: "ephemeral",
    allowedDomains: [],
    allowAuth: false,
    allowUploads: false,
    allowDownloads: false,
    captureScreenshots: true,
    headless: true,
    downloadsRoot: null,
    uploadsRoot: null,
    ...overrides,
  };
  return assertValidBrowserSessionConfig(config);
}

export function resolveBrowserSessionConfig(settings: BrowserSettingsLike): BrowserSessionConfig {
  return buildDefaultBrowserSessionConfig({
    profileMode: settings.browserProfileMode,
    allowedDomains: normalizeBrowserAllowedDomains(settings.browserAllowedDomains),
    allowAuth: settings.browserAllowAuth,
    allowUploads: settings.browserAllowUploads,
    allowDownloads: settings.browserAllowDownloads,
    captureScreenshots: settings.browserCaptureScreenshots,
    headless: settings.browserHeadless,
    downloadsRoot: settings.browserDownloadsRoot || null,
    uploadsRoot: settings.browserUploadsRoot || null,
  });
}

export function evaluateBrowserActionPolicy(
  config: BrowserSessionConfig,
  action: BrowserAction,
): BrowserPolicyDecision {
  if (action.type === "navigate") {
    return evaluateNavigationPolicy(config, action.params.url);
  }
  if (action.type === "fill" && action.params.fieldKind === "password" && !config.allowAuth) {
    return { allowed: false, reason: "auth_blocked" };
  }
  return { allowed: true, reason: "allowed" };
}

function assertValidBrowserSessionConfig(config: BrowserSessionConfig): BrowserSessionConfig {
  const validation = validateBrowserSessionConfig(config);
  if (!validation.valid) {
    throw new TypeError(`invalid browser session config: ${validation.errors.join("; ")}`);
  }
  return config;
}

function evaluateNavigationPolicy(
  config: BrowserSessionConfig,
  url: string,
): BrowserPolicyDecision {
  if (INTERNAL_ALLOWED_URLS.has(url)) {
    return { allowed: true, reason: "allowed" };
  }

  const parsed = parseNavigationTarget(url);
  if (!parsed.valid) {
    return { allowed: false, reason: "invalid_url" };
  }
  if (parsed.inlineCredentials && !config.allowAuth) {
    return { allowed: false, reason: "auth_blocked" };
  }

  for (const allowedDomain of config.allowedDomains) {
    if (matchesAllowedDomain(parsed.hostname, allowedDomain)) {
      return { allowed: true, reason: "allowed", matchedDomain: allowedDomain };
    }
  }
  return { allowed: false, reason: "domain_not_allowed" };
}

function parseNavigationTarget(url: string): {
  readonly valid: true;
  readonly hostname: string;
  readonly inlineCredentials: boolean;
} | {
  readonly valid: false;
} {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { valid: false };
    }
    if (!parsed.hostname) {
      return { valid: false };
    }
    return {
      valid: true,
      hostname: parsed.hostname.toLowerCase(),
      inlineCredentials: parsed.username.length > 0 || parsed.password.length > 0,
    };
  } catch {
    return { valid: false };
  }
}

function matchesAllowedDomain(hostname: string, allowedDomain: string): boolean {
  if (allowedDomain.startsWith("*.")) {
    const suffix = allowedDomain.slice(2);
    return hostname.length > suffix.length && hostname.endsWith(`.${suffix}`);
  }
  return hostname === allowedDomain;
}
