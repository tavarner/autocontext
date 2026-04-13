export const NEW_SCENARIO_HELP_TEXT = `autoctx new-scenario — create a scenario

Modes:
  --list                  List built-in templates (no LLM needed)
  --template <name>       Scaffold a scenario from a built-in template (no LLM needed)
  --description <text>    Generate scenario from natural language (requires LLM provider)
  --from-spec <file>      Register a scenario from a JSON spec file (no LLM needed)
  --from-stdin            Read a JSON spec from stdin (no LLM needed)
  --prompt-only           Output the generation prompt without calling an LLM

Template scaffolding:
  --template <name> --name <scenario-name>
  Built-in templates: content-generation, prompt-optimization, rag-accuracy

Spec schema (for --from-spec and --from-stdin):
  {
    "name": "...",
    "family": "agent_task|simulation|artifact_editing|investigation|workflow|schema_evolution|tool_fragility|negotiation|operator_loop|coordination|game",
    "taskPrompt": "...",
    "rubric": "...",
    "description": "..."
  }
  If family is omitted, autoctx derives the best-fit family from the spec text.

Options:
  --name <scenario>       Scenario name to use when scaffolding a template
  --json                  Output as JSON
  -h, --help              Show this help`;

export type {
  CreatedScenarioOutput,
  ImportedScenarioMaterializationResult,
  MaterializedScenarioOutput,
  NormalizedImportedScenario,
  TemplateListEntry,
  TemplateLoaderLike,
  TemplateScaffoldPayload,
} from "./new-scenario-command-contracts.js";
export { ensureNewScenarioDescription } from "./new-scenario-guards.js";
export { normalizeImportedScenarioSpec } from "./new-scenario-normalization-workflow.js";
export { ensureMaterializedScenario } from "./new-scenario-materialization-execution.js";
export { executeCreatedScenarioMaterialization } from "./new-scenario-created-materialization.js";
export { executeImportedScenarioMaterialization } from "./new-scenario-imported-materialization-public-helper.js";
export {
  executeTemplateScaffoldWorkflow,
  renderCreatedScenarioResult,
  renderMaterializedScenarioResult,
  renderTemplateList,
  renderTemplateScaffoldResult,
} from "./new-scenario-rendering-workflow.js";
