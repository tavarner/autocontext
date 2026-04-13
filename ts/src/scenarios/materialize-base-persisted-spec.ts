export function buildBaseMaterializedPersistedSpec(opts: {
  name: string;
  family: string;
  scenarioType: string;
  healedSpec: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    name: opts.name,
    family: opts.family,
    scenario_type: opts.scenarioType,
    ...opts.healedSpec,
  };
}
