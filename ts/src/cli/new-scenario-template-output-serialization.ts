import type {
  TemplateListEntry,
  TemplateScaffoldPayload,
} from "./new-scenario-command-contracts.js";
import {
  buildTemplateScaffoldResultLines,
  renderTemplateListRow,
} from "./new-scenario-template-rendering.js";

export function serializeTemplateListOutput(opts: {
  templates: TemplateListEntry[];
  json: boolean;
}): string {
  if (opts.json) {
    return JSON.stringify(opts.templates, null, 2);
  }
  return opts.templates.map(renderTemplateListRow).join("\n");
}

export function serializeTemplateScaffoldResultOutput(opts: {
  payload: TemplateScaffoldPayload;
  json: boolean;
}): string {
  if (opts.json) {
    return JSON.stringify(opts.payload, null, 2);
  }
  return buildTemplateScaffoldResultLines(opts.payload).join("\n");
}
