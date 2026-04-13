import { join } from "node:path";

import type {
  TemplateLoaderLike,
  TemplateScaffoldPayload,
} from "./new-scenario-command-contracts.js";

export function resolveTemplateScaffoldRequest(opts: {
  template: string | undefined;
  name: string | undefined;
}): {
  template: string;
  name: string;
} {
  if (!opts.template) {
    throw new Error("Error: --template is required when using --name");
  }
  if (!opts.name) {
    throw new Error("Error: --name is required when scaffolding a template");
  }
  return {
    template: opts.template,
    name: opts.name,
  };
}

export function planTemplateScaffold(opts: {
  template: string;
  name: string;
  knowledgeRoot: string;
  templateLoader: TemplateLoaderLike;
}): {
  template: string;
  targetDir: string;
  payload: TemplateScaffoldPayload;
} {
  try {
    opts.templateLoader.getTemplate(opts.template);
  } catch {
    const available = opts.templateLoader
      .listTemplates()
      .map((template) => template.name)
      .join(", ");
    throw new Error(
      `Error: template '${opts.template}' not found. Available: ${available}`,
    );
  }

  const targetDir = join(opts.knowledgeRoot, "_custom_scenarios", opts.name);
  return {
    template: opts.template,
    targetDir,
    payload: {
      name: opts.name,
      template: opts.template,
      family: "agent_task",
      path: targetDir,
    },
  };
}
