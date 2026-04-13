import { describe, expect, it } from "vitest";

import { executeTemplateScaffoldWorkflow } from "../src/cli/new-scenario-template-scaffold-execution.js";

describe("new-scenario template scaffold execution", () => {
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

  it("preserves template scaffold validation errors", () => {
    expect(() =>
      executeTemplateScaffoldWorkflow({
        template: undefined,
        name: "my_prompt_task",
        knowledgeRoot: "/tmp/knowledge",
        json: false,
        templateLoader: {
          getTemplate: () => ({ name: "prompt-optimization" }),
          listTemplates: () => [{ name: "prompt-optimization" }],
          scaffold: () => {},
        },
      }),
    ).toThrow("Error: --template is required when using --name");

    expect(() =>
      executeTemplateScaffoldWorkflow({
        template: "missing-template",
        name: "my_prompt_task",
        knowledgeRoot: "/tmp/knowledge",
        json: false,
        templateLoader: {
          getTemplate: () => {
            throw new Error("missing");
          },
          listTemplates: () => [{ name: "prompt-optimization" }],
          scaffold: () => {},
        },
      }),
    ).toThrow(
      "Error: template 'missing-template' not found. Available: prompt-optimization",
    );
  });
});
