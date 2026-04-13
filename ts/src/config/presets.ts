const LONG_RUN_PRESET_SETTINGS: Record<string, unknown> = {
  stagnationResetEnabled: true,
  deadEndTrackingEnabled: true,
  curatorEnabled: true,
  twoTierGatingEnabled: true,
  maxRetries: 3,
  stagnationRollbackThreshold: 5,
  stagnationPlateauWindow: 3,
  crossRunInheritance: true,
};

const SHORT_RUN_PRESET_SETTINGS: Record<string, unknown> = {
  stagnationResetEnabled: false,
  deadEndTrackingEnabled: false,
  curatorEnabled: false,
  twoTierGatingEnabled: false,
  maxRetries: 2,
};

export const PRESETS: Map<string, Record<string, unknown>> = new Map([
  [
    "quick",
    {
      matchesPerGeneration: 2,
      curatorEnabled: false,
      probeMatches: 0,
      coherenceCheckEnabled: false,
      maxRetries: 0,
    },
  ],
  [
    "standard",
    {
      matchesPerGeneration: 3,
      curatorEnabled: true,
      backpressureMode: "trend",
      crossRunInheritance: true,
    },
  ],
  [
    "deep",
    {
      matchesPerGeneration: 5,
      curatorEnabled: true,
      curatorConsolidateEveryNGens: 3,
      probeMatches: 2,
      coherenceCheckEnabled: true,
    },
  ],
  [
    "rapid",
    {
      backpressureMinDelta: 0.0,
      backpressureMode: "simple",
      curatorEnabled: false,
      maxRetries: 0,
      matchesPerGeneration: 2,
      rlmMaxTurns: 5,
      probeMatches: 0,
      coherenceCheckEnabled: false,
      constraintPromptsEnabled: false,
    },
  ],
  ["long_run", { ...LONG_RUN_PRESET_SETTINGS }],
  ["short_run", { ...SHORT_RUN_PRESET_SETTINGS }],
]);

export function applyPreset(name: string): Record<string, unknown> {
  if (!name) return {};
  const preset = PRESETS.get(name);
  if (!preset) {
    throw new Error(
      `Unknown preset '${name}'. Valid presets: ${[...PRESETS.keys()].sort().join(", ")}`,
    );
  }
  return { ...preset };
}
