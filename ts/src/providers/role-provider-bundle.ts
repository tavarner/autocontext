import type { LLMProvider } from "../types/index.js";
import {
  createProvider,
  type CreateProviderOpts,
} from "./provider-factory.js";
import {
  resolveProviderConfig,
  type ProviderConfig,
} from "./provider-config-resolution.js";

export type GenerationRole = "competitor" | "analyst" | "coach" | "architect" | "curator";

export interface RoleProviderSettings {
  agentProvider: string;
  competitorProvider?: string;
  analystProvider?: string;
  coachProvider?: string;
  architectProvider?: string;
  modelCompetitor?: string;
  modelAnalyst?: string;
  modelCoach?: string;
  modelArchitect?: string;
  modelCurator?: string;
  piCommand?: string;
  piTimeout?: number;
  piWorkspace?: string;
  piModel?: string;
  piRpcEndpoint?: string;
  piRpcApiKey?: string;
  piRpcSessionPersistence?: boolean;
}

export interface RoleProviderBundle {
  defaultProvider: LLMProvider;
  defaultConfig: ProviderConfig;
  roleProviders: Partial<Record<GenerationRole, LLMProvider>>;
  roleModels: Partial<Record<GenerationRole, string>>;
}

export function withRuntimeSettings(
  config: ProviderConfig,
  settings: Partial<RoleProviderSettings> = {},
): CreateProviderOpts {
  return {
    ...config,
    piCommand: settings.piCommand,
    piTimeout: settings.piTimeout,
    piWorkspace: settings.piWorkspace,
    piModel: settings.piModel,
    piRpcEndpoint: settings.piRpcEndpoint,
    piRpcApiKey: settings.piRpcApiKey,
    piRpcSessionPersistence: settings.piRpcSessionPersistence,
  };
}

export function createConfiguredProvider(
  overrides: Partial<ProviderConfig> = {},
  settings: Partial<RoleProviderSettings> = {},
): {
  provider: LLMProvider;
  config: ProviderConfig;
} {
  const config = resolveProviderConfig(overrides);
  return {
    provider: createProvider(withRuntimeSettings(config, settings)),
    config,
  };
}

export function buildRoleProviderBundle(
  settings: RoleProviderSettings,
  overrides: Partial<ProviderConfig> = {},
): RoleProviderBundle {
  const defaultConfig = resolveProviderConfig({
    ...overrides,
    providerType: overrides.providerType ?? settings.agentProvider,
  });
  const defaultProvider = createProvider(withRuntimeSettings(defaultConfig, settings));

  const roleConfigs: Record<GenerationRole, ProviderConfig> = {
    competitor: resolveProviderConfig({
      ...overrides,
      providerType: settings.competitorProvider || defaultConfig.providerType,
      model: settings.modelCompetitor ?? defaultConfig.model,
    }, {
      preferProviderOverride: Boolean(settings.competitorProvider),
      preferModelOverride: Boolean(settings.modelCompetitor),
    }),
    analyst: resolveProviderConfig({
      ...overrides,
      providerType: settings.analystProvider || defaultConfig.providerType,
      model: settings.modelAnalyst ?? defaultConfig.model,
    }, {
      preferProviderOverride: Boolean(settings.analystProvider),
      preferModelOverride: Boolean(settings.modelAnalyst),
    }),
    coach: resolveProviderConfig({
      ...overrides,
      providerType: settings.coachProvider || defaultConfig.providerType,
      model: settings.modelCoach ?? defaultConfig.model,
    }, {
      preferProviderOverride: Boolean(settings.coachProvider),
      preferModelOverride: Boolean(settings.modelCoach),
    }),
    architect: resolveProviderConfig({
      ...overrides,
      providerType: settings.architectProvider || defaultConfig.providerType,
      model: settings.modelArchitect ?? defaultConfig.model,
    }, {
      preferProviderOverride: Boolean(settings.architectProvider),
      preferModelOverride: Boolean(settings.modelArchitect),
    }),
    curator: resolveProviderConfig({
      ...overrides,
      providerType: defaultConfig.providerType,
      model: settings.modelCurator ?? defaultConfig.model,
    }, {
      preferModelOverride: Boolean(settings.modelCurator),
    }),
  };

  return {
    defaultProvider,
    defaultConfig,
    roleProviders: {
      competitor: createProvider(withRuntimeSettings(roleConfigs.competitor, settings)),
      analyst: createProvider(withRuntimeSettings(roleConfigs.analyst, settings)),
      coach: createProvider(withRuntimeSettings(roleConfigs.coach, settings)),
      architect: createProvider(withRuntimeSettings(roleConfigs.architect, settings)),
      curator: createProvider(withRuntimeSettings(roleConfigs.curator, settings)),
    },
    roleModels: {
      competitor: roleConfigs.competitor.model,
      analyst: roleConfigs.analyst.model,
      coach: roleConfigs.coach.model,
      architect: roleConfigs.architect.model,
      curator: roleConfigs.curator.model,
    },
  };
}
