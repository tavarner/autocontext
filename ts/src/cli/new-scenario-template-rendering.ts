import type {
  TemplateListEntry,
  TemplateScaffoldPayload,
} from "./new-scenario-command-contracts.js";

export function renderTemplateListRow(template: TemplateListEntry): string {
  return `${template.name}\t${template.outputFormat}\tmaxRounds=${template.maxRounds}\t${template.description}`;
}

export function buildTemplateScaffoldResultLines(
  payload: TemplateScaffoldPayload,
): string[] {
  return [
    `Scenario '${payload.name}' created from template '${payload.template}'`,
    `Files scaffolded to: ${payload.path}`,
    "Available to agent-task tooling after scaffold via knowledge/_custom_scenarios.",
  ];
}
