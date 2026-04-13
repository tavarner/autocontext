import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  executeTemplateScaffoldWorkflow,
  renderCreatedScenarioResult,
  renderMaterializedScenarioResult,
  renderTemplateList,
  renderTemplateScaffoldResult,
} from "../src/cli/new-scenario-rendering-workflow.js";

describe("new-scenario rendering workflow", () => {
  it("exports rendering entrypoints directly instead of routing through facade barrels", () => {
    const source = readFileSync(
      join(import.meta.dirname, "..", "src", "cli", "new-scenario-rendering-workflow.ts"),
      "utf-8",
    );

    expect(source).not.toContain("new-scenario-rendering-public-facade");
    expect(source).not.toContain("new-scenario-result-rendering-public-facade");
  });

  it("keeps the full rendering surface available from the workflow entrypoint", () => {
    expect(renderMaterializedScenarioResult).toBeTypeOf("function");
    expect(renderCreatedScenarioResult).toBeTypeOf("function");
    expect(renderTemplateList).toBeTypeOf("function");
    expect(renderTemplateScaffoldResult).toBeTypeOf("function");
    expect(executeTemplateScaffoldWorkflow).toBeTypeOf("function");
  });

  it("renders created scenarios in human-readable mode", () => {
    expect(
      renderCreatedScenarioResult({
        created: {
          name: "fresh_task",
          family: "agent_task",
          spec: {
            taskPrompt: "Summarize the incident report.",
            rubric: "Clarity and factual accuracy",
            description: "Evaluate incident summaries",
          },
        },
        materialized: {
          scenarioDir: "/tmp/fresh_task",
          generatedSource: true,
          persisted: true,
        },
        json: false,
      }),
    ).toBe(
      [
        "Materialized scenario: fresh_task (family: agent_task)",
        "  Directory: /tmp/fresh_task",
        "  Task prompt: Summarize the incident report.",
        "  Rubric: Clarity and factual accuracy",
        "  Generated: scenario.js",
      ].join("\n"),
    );
  });

  it("scaffolds templates into knowledge/_custom_scenarios", () => {
    const calls: Array<{ template: string; targetDir: string; vars: { name: string } }> = [];

    const output = executeTemplateScaffoldWorkflow({
      template: "prompt-optimization",
      name: "my_prompt_task",
      knowledgeRoot: "/tmp/knowledge",
      json: false,
      templateLoader: {
        getTemplate: (template: string) => ({ name: template }),
        listTemplates: () => [{ name: "prompt-optimization" }],
        scaffold: (template: string, targetDir: string, vars: { name: string }) => {
          calls.push({ template, targetDir, vars });
        },
      },
    });

    expect(calls).toEqual([
      {
        template: "prompt-optimization",
        targetDir: "/tmp/knowledge/_custom_scenarios/my_prompt_task",
        vars: { name: "my_prompt_task" },
      },
    ]);
    expect(output).toContain("knowledge/_custom_scenarios");
  });
});
