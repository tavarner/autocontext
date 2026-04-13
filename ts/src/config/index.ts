/**
 * Config/Settings — Full AppSettings Zod schema with AUTOCONTEXT_* env var loading.
 * Mirrors Python's autocontext/config/settings.py + presets.py.
 */

import { loadProjectConfig, type ProjectConfig, type ProjectConfigLocation } from "./project-config.js";
import { AppSettingsSchema, type AppSettings } from "./app-settings-schema.js";
import {
  buildSettingsAssemblyInput,
  parseAppSettings,
} from "./settings-assembly-workflow.js";

export { AppSettingsSchema } from "./app-settings-schema.js";
export type { AppSettings } from "./app-settings-schema.js";

export {
  findProjectConfigLocation,
  findProjectConfigPath,
  loadProjectConfig,
} from "./project-config.js";
export {
  loadPersistedCredentials,
  resolveConfigDir,
} from "./persisted-credentials.js";
export { PRESETS, applyPreset } from "./presets.js";

export type { ProjectConfig, ProjectConfigLocation };
export type { StoredCredentials } from "./persisted-credentials.js";
export {
  buildProjectConfigSettingsOverrides,
  camelToScreamingSnake,
  coerceEnvValue,
  getSettingEnvKeys,
  resolveEnvSettingsOverrides,
} from "./settings-resolution.js";

export {
  resolveApiKeyValue,
  saveProviderCredentials,
  loadProviderCredentials,
  removeProviderCredentials,
  listConfiguredProviders,
  discoverAllProviders,
  validateApiKey,
  getKnownProvider,
  getModelsForProvider,
  resolveModel,
  listAuthenticatedModels,
  KNOWN_PROVIDERS,
  PROVIDER_MODELS,
  CREDENTIALS_FILE as CREDENTIALS_STORE_FILE,
} from "./credentials.js";
export type {
  ProviderCredentials,
  ProviderAuthStatus,
  DiscoveredProvider,
  KnownProvider,
  KnownModel,
  AuthenticatedModel,
  ResolveModelOpts,
  ValidationResult as ApiKeyValidationResult,
} from "./credentials.js";

export {
  generatePKCE,
  generateState,
  buildAuthorizationUrl,
  waitForCallback,
  isOAuthProvider,
  saveOAuthTokens,
  loadOAuthTokens,
  isTokenExpired,
  OAUTH_PROVIDERS,
} from "./oauth.js";
export type {
  PKCEPair,
  OAuthFlow,
  OAuthProviderConfig,
  CallbackResult,
  WaitForCallbackOpts,
  OAuthTokens,
} from "./oauth.js";

export function loadSettings(): AppSettings {
  return parseAppSettings(buildSettingsAssemblyInput({
    projectConfig: loadProjectConfig(),
  }));
}
