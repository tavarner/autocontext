import { describe, expect, it } from "vitest";

import {
  NEW_SCENARIO_HELP_TEXT,
  ensureMaterializedScenario,
  ensureNewScenarioDescription,
  executeCreatedScenarioMaterialization,
  executeImportedScenarioMaterialization,
  executeTemplateScaffoldWorkflow,
  normalizeImportedScenarioSpec,
  renderCreatedScenarioResult,
  renderMaterializedScenarioResult,
  renderTemplateList,
  renderTemplateScaffoldResult,
} from "../src/cli/new-scenario-command-workflow.js";

describe("new-scenario command workflow", () => {
  it("exposes help text for the new-scenario command", () => {
    expect(NEW_SCENARIO_HELP_TEXT).toContain("autoctx new-scenario");
    expect(NEW_SCENARIO_HELP_TEXT).toContain("--from-spec");
    expect(NEW_SCENARIO_HELP_TEXT).toContain("--prompt-only");
  });

  it("normalizes imported specs and auto-detects family", () => {
    expect(
      normalizeImportedScenarioSpec({
        spec: {
          name: "checkout_rca",
          taskPrompt: "Investigate a conversion drop",
          rubric: "Find the likely cause",
          description: "Root cause analysis",
        },
        detectScenarioFamily: () => "investigation",
        isScenarioFamilyName: (value: string) => value === "investigation",
        validFamilies: ["agent_task", "investigation"],
      }),
    ).toEqual({
      name: "checkout_rca",
      family: "investigation",
      spec: {
        taskPrompt: "Investigate a conversion drop",
        rubric: "Find the likely cause",
        description: "Root cause analysis",
      },
    });
  });

  it("rejects imported specs without required fields", () => {
    expect(() =>
      normalizeImportedScenarioSpec({
        spec: { name: "oops", taskPrompt: "", rubric: "" },
        detectScenarioFamily: () => "agent_task",
        isScenarioFamilyName: () => true,
        validFamilies: ["agent_task"],
      }),
    ).toThrow("Error: spec must contain name, taskPrompt, and rubric fields");
  });

  it("rejects invalid requested families", () => {
    expect(() =>
      normalizeImportedScenarioSpec({
        spec: {
          name: "checkout_rca",
          family: "invalid_family",
          taskPrompt: "Investigate a conversion drop",
          rubric: "Find the likely cause",
        },
        detectScenarioFamily: () => "investigation",
        isScenarioFamilyName: () => false,
        validFamilies: ["agent_task", "investigation"],
      }),
    ).toThrow("Error: family must be one of agent_task, investigation");
  });

  it("falls back to agent_task when a codegen family is requested without family-specific fields", () => {
    expect(
      normalizeImportedScenarioSpec({
        spec: {
          name: "fresh_saved_task",
          family: "workflow",
          taskPrompt: "Summarize the incident report.",
          rubric: "Clarity and factual accuracy",
          description: "Evaluate incident summaries",
        },
        detectScenarioFamily: () => "workflow",
        isScenarioFamilyName: (value: string) => ["agent_task", "workflow"].includes(value),
        validFamilies: ["agent_task", "workflow"],
      }),
    ).toMatchObject({
      name: "fresh_saved_task",
      family: "agent_task",
    });
  });

  it("throws when materialization did not persist a runnable scenario", () => {
    expect(() =>
      ensureMaterializedScenario({ persisted: false, errors: ["validation failed"] }),
    ).toThrow("Error: validation failed");
  });

  it("renders materialized scenario output as json", () => {
    const output = renderMaterializedScenarioResult({
      parsed: {
        name: "checkout_rca",
        family: "investigation",
        spec: {
          taskPrompt: "Investigate a conversion drop",
          rubric: "Find the likely cause",
          description: "Root cause analysis",
        },
      },
      materialized: {
        scenarioDir: "/tmp/checkout_rca",
        generatedSource: true,
        persisted: true,
      },
      json: true,
    });

    expect(output).toBe(
      JSON.stringify(
        {
          name: "checkout_rca",
          family: "investigation",
          spec: {
            taskPrompt: "Investigate a conversion drop",
            rubric: "Find the likely cause",
            description: "Root cause analysis",
          },
          scenarioDir: "/tmp/checkout_rca",
          generatedSource: true,
          persisted: true,
        },
        null,
        2,
      ),
    );
  });

  it("renders materialized scenario output as human-readable text", () => {
    expect(
      renderMaterializedScenarioResult({
        parsed: {
          name: "checkout_rca",
          family: "investigation",
          spec: {
            taskPrompt: "Investigate a conversion drop",
            rubric: "Find the likely cause",
            description: "Root cause analysis",
          },
        },
        materialized: {
          scenarioDir: "/tmp/checkout_rca",
          generatedSource: true,
          persisted: true,
        },
        json: false,
      }),
    ).toBe(
      [
        "Materialized scenario: checkout_rca (family: investigation)",
        "  Directory: /tmp/checkout_rca",
        "  Generated: scenario.js",
      ].join("\n"),
    );
  });

  it("renders template lists and scaffold results", () => {
    expect(
      renderTemplateList({
        templates: [
          {
            name: "prompt-optimization",
            outputFormat: "free_text",
            maxRounds: 3,
            description: "Optimize prompts",
          },
        ],
        json: false,
      }),
    ).toBe("prompt-optimization\tfree_text\tmaxRounds=3\tOptimize prompts");

    expect(
      renderTemplateScaffoldResult({
        payload: {
          name: "my_prompt_task",
          template: "prompt-optimization",
          family: "agent_task",
          path: "/tmp/my_prompt_task",
        },
        json: false,
      }),
    ).toBe(
      [
        "Scenario 'my_prompt_task' created from template 'prompt-optimization'",
        "Files scaffolded to: /tmp/my_prompt_task",
        "Available to agent-task tooling after scaffold via knowledge/_custom_scenarios.",
      ].join("\n"),
    );
  });

  it("requires a description for prompt-only and default generation modes", () => {
    expect(() =>
      ensureNewScenarioDescription({
        description: undefined,
        errorMessage: "Error: --description is required with --prompt-only",
      }),
    ).toThrow("Error: --description is required with --prompt-only");

    expect(() =>
      ensureNewScenarioDescription({
        description: undefined,
        errorMessage:
          "Error: --list, --template, --description, --from-spec, --from-stdin, or --prompt-only is required",
      }),
    ).toThrow(
      "Error: --list, --template, --description, --from-spec, --from-stdin, or --prompt-only is required",
    );
  });

  it("renders created scenario output for json and human-readable modes", () => {
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
        json: true,
      }),
    ).toBe(
      JSON.stringify(
        {
          name: "fresh_task",
          family: "agent_task",
          spec: {
            taskPrompt: "Summarize the incident report.",
            rubric: "Clarity and factual accuracy",
            description: "Evaluate incident summaries",
          },
          scenarioDir: "/tmp/fresh_task",
          generatedSource: true,
          persisted: true,
        },
        null,
        2,
      ),
    );
  });

  it("orchestrates imported scenario materialization through shared workflow", async () => {
    const materializeScenario = async () => ({
      scenarioDir: "/tmp/checkout_rca",
      generatedSource: true,
      persisted: true,
      errors: [],
    });

    const output = await executeImportedScenarioMaterialization({
      spec: {
        name: "checkout_rca",
        taskPrompt: "Investigate a conversion drop",
        rubric: "Find the likely cause",
        description: "Root cause analysis",
      },
      detectScenarioFamily: () => "investigation",
      isScenarioFamilyName: (value: string) => value === "investigation",
      validFamilies: ["agent_task", "investigation"],
      materializeScenario,
      knowledgeRoot: "/tmp/knowledge",
      json: false,
    });

    expect(output).toBe(
      [
        "Materialized scenario: checkout_rca (family: investigation)",
        "  Directory: /tmp/checkout_rca",
        "  Generated: scenario.js",
      ].join("\n"),
    );
  });

  it("surfaces materialization errors through the shared imported workflow", async () => {
    await expect(
      executeImportedScenarioMaterialization({
        spec: {
          name: "stdin_board_game",
          family: "game",
          taskPrompt: "Create a board game with scoring.",
          rubric: "Fairness and strategic depth",
          description: "A board game imported through stdin.",
        },
        detectScenarioFamily: () => "game",
        isScenarioFamilyName: (value: string) => value === "game",
        validFamilies: ["game"],
        materializeScenario: async () => ({
          scenarioDir: "/tmp/stdin_board_game",
          generatedSource: false,
          persisted: false,
          errors: [
            "custom scenario materialization does not support family 'game'; use a built-in game scenario instead",
          ],
        }),
        knowledgeRoot: "/tmp/knowledge",
        json: true,
      }),
    ).rejects.toThrow(
      "Error: custom scenario materialization does not support family 'game'; use a built-in game scenario instead",
    );
  });

  it("orchestrates template scaffolding through the shared workflow", () => {
    const calls: Array<{ template: string; targetDir: string; vars: { name: string } }> = [];
    const output = executeTemplateScaffoldWorkflow({
      template: "prompt-optimization",
      name: "my_prompt_task",
      knowledgeRoot: "/tmp/knowledge",
      json: false,
      templateLoader: {
        getTemplate: (template: string) => ({ name: template }),
        listTemplates: () => [{ name: "prompt-optimization" }, { name: "rag-accuracy" }],
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
    expect(output).toBe(
      [
        "Scenario 'my_prompt_task' created from template 'prompt-optimization'",
        "Files scaffolded to: /tmp/knowledge/_custom_scenarios/my_prompt_task",
        "Available to agent-task tooling after scaffold via knowledge/_custom_scenarios.",
      ].join("\n"),
    );
  });

  it("rejects invalid template scaffold arguments through the shared workflow", () => {
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

  it("orchestrates created-scenario materialization through the shared workflow", async () => {
    const output = await executeCreatedScenarioMaterialization({
      created: {
        name: "fresh_task",
        family: "agent_task",
        spec: {
          taskPrompt: "Summarize the incident report.",
          rubric: "Clarity and factual accuracy",
          description: "Evaluate incident summaries",
        },
      },
      knowledgeRoot: "/tmp/knowledge",
      json: false,
      materializeScenario: async () => ({
        scenarioDir: "/tmp/fresh_task",
        generatedSource: true,
        persisted: true,
        errors: [],
      }),
    });

    expect(output).toBe(
      [
        "Materialized scenario: fresh_task (family: agent_task)",
        "  Directory: /tmp/fresh_task",
        "  Task prompt: Summarize the incident report.",
        "  Rubric: Clarity and factual accuracy",
        "  Generated: scenario.js",
      ].join("\n"),
    );
  });

  it("surfaces created-scenario materialization failures through the shared workflow", async () => {
    await expect(
      executeCreatedScenarioMaterialization({
        created: {
          name: "fresh_task",
          family: "agent_task",
          spec: {
            taskPrompt: "Summarize the incident report.",
            rubric: "Clarity and factual accuracy",
            description: "Evaluate incident summaries",
          },
        },
        knowledgeRoot: "/tmp/knowledge",
        json: true,
        materializeScenario: async () => ({
          scenarioDir: "/tmp/fresh_task",
          generatedSource: false,
          persisted: false,
          errors: ["validation failed"],
        }),
      }),
    ).rejects.toThrow("Error: validation failed");
  });
});
