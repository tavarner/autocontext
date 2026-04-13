/**
 * Rendering compatibility surface for the new-scenario CLI workflow.
 */

export {
  renderCreatedScenarioResult,
  renderMaterializedScenarioResult,
} from "./new-scenario-result-rendering-entrypoints.js";
export {
  renderTemplateList,
  renderTemplateScaffoldResult,
} from "./new-scenario-template-rendering-public-helper.js";
export { executeTemplateScaffoldWorkflow } from "./new-scenario-template-scaffold-execution.js";
