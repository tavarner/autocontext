import type { TemplateLoaderLike } from "./new-scenario-command-contracts.js";
import {
  planTemplateScaffold,
  resolveTemplateScaffoldRequest,
} from "./new-scenario-template-scaffold-planning.js";
import { serializeTemplateScaffoldResultOutput } from "./new-scenario-template-output-serialization.js";

export function executeTemplateScaffoldWorkflow(opts: {
  template: string | undefined;
  name: string | undefined;
  knowledgeRoot: string;
  json: boolean;
  templateLoader: TemplateLoaderLike;
}): string {
  const request = resolveTemplateScaffoldRequest({
    template: opts.template,
    name: opts.name,
  });
  const plan = planTemplateScaffold({
    template: request.template,
    name: request.name,
    knowledgeRoot: opts.knowledgeRoot,
    templateLoader: opts.templateLoader,
  });

  opts.templateLoader.scaffold(plan.template, plan.targetDir, { name: request.name });
  return serializeTemplateScaffoldResultOutput({
    payload: plan.payload,
    json: opts.json,
  });
}
