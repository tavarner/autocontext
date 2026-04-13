import { describe, expect, it } from "vitest";

import {
  buildTemplateScaffoldResultLines,
  renderTemplateListRow,
} from "../src/cli/new-scenario-template-rendering.js";

describe("new-scenario template rendering", () => {
  it("renders template list rows", () => {
    expect(
      renderTemplateListRow({
        name: "prompt-optimization",
        outputFormat: "free_text",
        maxRounds: 3,
        description: "Optimize prompts",
      }),
    ).toBe("prompt-optimization\tfree_text\tmaxRounds=3\tOptimize prompts");
  });

  it("builds template scaffold result lines", () => {
    expect(
      buildTemplateScaffoldResultLines({
        name: "my_prompt_task",
        template: "prompt-optimization",
        family: "agent_task",
        path: "/tmp/knowledge/_custom_scenarios/my_prompt_task",
      }),
    ).toEqual([
      "Scenario 'my_prompt_task' created from template 'prompt-optimization'",
      "Files scaffolded to: /tmp/knowledge/_custom_scenarios/my_prompt_task",
      "Available to agent-task tooling after scaffold via knowledge/_custom_scenarios.",
    ]);
  });
});
