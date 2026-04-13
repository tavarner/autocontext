import { describe, expect, it } from "vitest";

import {
  serializeTemplateListOutput,
  serializeTemplateScaffoldResultOutput,
} from "../src/cli/new-scenario-template-output-serialization.js";

describe("new-scenario template output serialization", () => {
  it("serializes template lists for json and human-readable output", () => {
    const templates = [
      {
        name: "prompt-optimization",
        outputFormat: "free_text",
        maxRounds: 3,
        description: "Optimize prompts",
      },
    ];

    expect(
      serializeTemplateListOutput({
        templates,
        json: false,
      }),
    ).toBe("prompt-optimization\tfree_text\tmaxRounds=3\tOptimize prompts");

    expect(
      serializeTemplateListOutput({
        templates,
        json: true,
      }),
    ).toBe(JSON.stringify(templates, null, 2));
  });

  it("serializes template scaffold results for json and human-readable output", () => {
    const payload = {
      name: "my_prompt_task",
      template: "prompt-optimization",
      family: "agent_task",
      path: "/tmp/knowledge/_custom_scenarios/my_prompt_task",
    };

    expect(
      serializeTemplateScaffoldResultOutput({
        payload,
        json: false,
      }),
    ).toBe(
      [
        "Scenario 'my_prompt_task' created from template 'prompt-optimization'",
        "Files scaffolded to: /tmp/knowledge/_custom_scenarios/my_prompt_task",
        "Available to agent-task tooling after scaffold via knowledge/_custom_scenarios.",
      ].join("\n"),
    );

    expect(
      serializeTemplateScaffoldResultOutput({
        payload,
        json: true,
      }),
    ).toBe(JSON.stringify(payload, null, 2));
  });
});
