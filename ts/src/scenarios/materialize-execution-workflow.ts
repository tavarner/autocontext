import type { MaterializeScenarioDependencies } from "./materialize-dependencies.js";
import type { MaterializeResult } from "./materialize-contracts.js";
import type { ScenarioFamilyName } from "./families.js";

const AGENT_TASK_FAMILY = "agent_task";

export async function executeMaterializeScenarioWorkflow(opts: {
  name: string;
  family: ScenarioFamilyName;
  healedSpec: Record<string, unknown>;
  scenarioDir: string;
  scenarioType: string;
  dependencies: MaterializeScenarioDependencies;
}): Promise<MaterializeResult> {
  if (opts.family === "game") {
    return opts.dependencies.buildUnsupportedGameMaterializeResult({
      scenarioDir: opts.scenarioDir,
      family: opts.family,
      name: opts.name,
    });
  }

  const {
    persistedSpec,
    agentTaskSpec,
    source,
    generatedSource,
    errors: planningErrors,
  } = await opts.dependencies.planMaterializedScenarioFamily(
    {
      family: opts.family,
      name: opts.name,
      healedSpec: opts.healedSpec,
      scenarioType: opts.scenarioType,
    },
    {
      hasCodegen: opts.dependencies.hasCodegen,
      generateScenarioSource: opts.dependencies.generateScenarioSource,
      validateGeneratedScenario: opts.dependencies.validateGeneratedScenario,
    },
  );

  if (planningErrors.length > 0) {
    return opts.dependencies.buildMaterializeFailureResult({
      scenarioDir: opts.scenarioDir,
      family: opts.family,
      name: opts.name,
      errors: planningErrors,
    });
  }

  opts.dependencies.persistMaterializedScenarioArtifacts({
    scenarioDir: opts.scenarioDir,
    scenarioType: opts.scenarioType,
    persistedSpec,
    family: opts.family,
    agentTaskFamily: AGENT_TASK_FAMILY,
    agentTaskSpec,
    source,
  });

  return opts.dependencies.buildSuccessfulMaterializeResult({
    generatedSource,
    scenarioDir: opts.scenarioDir,
    family: opts.family,
    name: opts.name,
  });
}
