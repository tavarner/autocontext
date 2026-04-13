import type {
  CreatedScenarioOutput,
  ImportedScenarioMaterializationResult,
  NormalizedImportedScenario,
} from "./new-scenario-command-contracts.js";
import { ensureMaterializedScenario as ensureMaterializedScenarioGuard } from "./new-scenario-guards.js";
import {
  renderCreatedScenarioResult,
  renderMaterializedScenarioResult,
} from "./new-scenario-rendering-workflow.js";

export { ensureMaterializedScenario } from "./new-scenario-guards.js";

export async function executeImportedScenarioMaterializationResult(opts: {
  parsed: NormalizedImportedScenario;
  materializeScenario: (request: {
    name: string;
    family: string;
    spec: Record<string, unknown>;
    knowledgeRoot: string;
  }) => Promise<ImportedScenarioMaterializationResult>;
  knowledgeRoot: string;
  json: boolean;
}): Promise<string> {
  const materialized = await opts.materializeScenario({
    name: opts.parsed.name,
    family: opts.parsed.family,
    spec: opts.parsed.spec,
    knowledgeRoot: opts.knowledgeRoot,
  });
  ensureMaterializedScenarioGuard(materialized);
  return renderMaterializedScenarioResult({
    parsed: opts.parsed,
    materialized,
    json: opts.json,
  });
}

export async function executeCreatedScenarioMaterializationResult(opts: {
  created: CreatedScenarioOutput;
  materializeScenario: (request: {
    name: string;
    family: string;
    spec: Record<string, unknown>;
    knowledgeRoot: string;
  }) => Promise<ImportedScenarioMaterializationResult>;
  knowledgeRoot: string;
  json: boolean;
}): Promise<string> {
  const materialized = await opts.materializeScenario({
    name: opts.created.name,
    family: opts.created.family,
    spec: opts.created.spec,
    knowledgeRoot: opts.knowledgeRoot,
  });
  ensureMaterializedScenarioGuard(materialized);
  return renderCreatedScenarioResult({
    created: opts.created,
    materialized,
    json: opts.json,
  });
}
