import { describe, expect, it } from "vitest";

import {
  planTemplateScaffold,
  resolveTemplateScaffoldRequest,
} from "../src/cli/new-scenario-template-scaffold-planning.js";

describe("new-scenario template scaffold planning", () => {
  it("validates required template scaffold inputs", () => {
    expect(() =>
      resolveTemplateScaffoldRequest({
        template: undefined,
        name: "my_prompt_task",
      }),
    ).toThrow("Error: --template is required when using --name");

    expect(() =>
      resolveTemplateScaffoldRequest({
        template: "prompt-optimization",
        name: undefined,
      }),
    ).toThrow("Error: --name is required when scaffolding a template");
  });

  it("plans scaffold target paths and preserves template availability errors", () => {
    expect(() =>
      planTemplateScaffold({
        template: "missing-template",
        name: "my_prompt_task",
        knowledgeRoot: "/tmp/knowledge",
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

    expect(
      planTemplateScaffold({
        template: "prompt-optimization",
        name: "my_prompt_task",
        knowledgeRoot: "/tmp/knowledge",
        templateLoader: {
          getTemplate: (template: string) => ({ name: template }),
          listTemplates: () => [{ name: "prompt-optimization" }, { name: "rag-accuracy" }],
          scaffold: () => {},
        },
      }),
    ).toEqual({
      template: "prompt-optimization",
      targetDir: "/tmp/knowledge/_custom_scenarios/my_prompt_task",
      payload: {
        name: "my_prompt_task",
        template: "prompt-optimization",
        family: "agent_task",
        path: "/tmp/knowledge/_custom_scenarios/my_prompt_task",
      },
    });
  });
});
