import type {
  TemplateListEntry,
  TemplateScaffoldPayload,
} from "./new-scenario-command-contracts.js";
import {
  serializeTemplateListOutput,
  serializeTemplateScaffoldResultOutput,
} from "./new-scenario-template-output-serialization.js";

export function renderTemplateList(opts: {
  templates: TemplateListEntry[];
  json: boolean;
}): string {
  return serializeTemplateListOutput(opts);
}

export function renderTemplateScaffoldResult(opts: {
  payload: TemplateScaffoldPayload;
  json: boolean;
}): string {
  return serializeTemplateScaffoldResultOutput(opts);
}
