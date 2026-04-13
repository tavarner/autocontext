import { describe, expect, it } from "vitest";

import { buildSkillPackageDict } from "../src/knowledge/skill-package-dict-workflow.js";
import { buildExportedAgentTaskSkillData } from "../src/knowledge/skill-package-export-workflow.js";
import { cleanLessons } from "../src/knowledge/skill-package-lesson-cleaning.js";
import {
  buildAgentTaskSkillMarkdown,
  buildGenericSkillMarkdown,
  buildHarnessMarkdownSection,
} from "../src/knowledge/skill-package-markdown-workflow.js";

describe("skill package workflows", () => {
  it("builds serialized dicts and exported agent-task package data", () => {
    expect(buildSkillPackageDict({
      scenarioName: "grid_ctf",
      displayName: "Grid CTF",
      description: "Capture the flag",
      playbook: "Move fast",
      lessons: ["Avoid corners"],
      bestStrategy: { opening: "fast" },
      bestScore: 0.91,
      bestElo: 1650,
      hints: "Think ahead",
      harness: { validate_move: "def validate(): pass" },
      metadata: { family: "game" },
      taskPrompt: "Summarize the mission",
      judgeRubric: "Score clarity",
      exampleOutputs: [{ output: "Done", score: 0.8, reasoning: "Clear" }],
      outputFormat: "free_text",
      referenceContext: "Reference",
      contextPreparation: "Prepare",
      maxRounds: 2,
      qualityThreshold: 0.8,
    })).toMatchObject({
      scenario_name: "grid_ctf",
      harness: { validate_move: "def validate(): pass" },
      task_prompt: "Summarize the mission",
      max_rounds: 2,
    });

    expect(buildExportedAgentTaskSkillData({
      scenarioName: "summary_task",
      taskPrompt: "Summarize this",
      judgeRubric: "Check completeness",
      outputFormat: "free_text",
      playbook: "Read carefully",
      lessons: ["Keep it short"],
      bestOutputs: [{ output: "Good summary", score: 0.9, reasoning: "Concise" }],
    })).toMatchObject({
      displayName: "Summary Task",
      description: "Agent task: Summary Task",
      bestScore: 0.9,
    });
  });

  it("renders markdown sections and cleans noisy lessons", () => {
    expect(buildHarnessMarkdownSection({ validate_move: "def v(): ..." })).toContain("## Harness Validators");

    expect(buildGenericSkillMarkdown({
      scenarioName: "grid_ctf",
      displayName: "Grid CTF",
      description: "Capture the flag",
      playbook: "Move fast",
      lessons: ["Avoid corners"],
      bestStrategy: { opening: "fast" },
      bestScore: 0.91,
      bestElo: 1650,
      hints: "Think ahead",
      harness: { validate_move: "def v(): ..." },
      metadata: {},
    })).toContain("```json");

    expect(buildAgentTaskSkillMarkdown({
      scenarioName: "summary_task",
      displayName: "Summary Task",
      description: "Agent task: Summary Task",
      playbook: "Read carefully",
      lessons: ["Keep it short"],
      bestStrategy: { approach: "structured" },
      bestScore: 0.9,
      bestElo: 1500,
      hints: "",
      metadata: {},
      taskPrompt: "Summarize this",
      judgeRubric: "Check completeness",
      exampleOutputs: [{ output: "Good summary", score: 0.9, reasoning: "Concise" }],
      outputFormat: "free_text",
      referenceContext: "Reference",
      contextPreparation: "Prepare",
    })).toContain("## Example Outputs");

    expect(cleanLessons([
      "- Generation 3 ROLLBACK — score dropped",
      '{"param_a": 0.5, "param_b": 0.3}',
      "- Improved accuracy (score=0.85, delta=+0.10, threshold=0.90)",
      "Valid lesson",
    ])).toEqual(["Improved accuracy", "Valid lesson"]);
  });
});
