import { describe, expect, it } from "vitest";

import {
  coerceHarness,
  coercePackage,
} from "../src/knowledge/package-coercion.js";

describe("package coercion workflow", () => {
  it("coerces harness entries to string-only records", () => {
    expect(coerceHarness({ validator: "def validate(): pass", ignored: 1 })).toEqual({
      validator: "def validate(): pass",
    });
    expect(coerceHarness(null)).toEqual({});
  });

  it("coerces mixed package payloads into normalized strategy package data", () => {
    const pkg = coercePackage({
      format_version: 1,
      scenario_name: "grid_ctf",
      display_name: "Grid CTF",
      description: "Capture the flag strategy package.",
      playbook: "Playbook",
      lessons: ["Preserve the high ground.", 1],
      best_strategy: { aggression: 0.7 },
      best_score: 0.91,
      best_elo: 1234.5,
      hints: "Avoid overcommitting.",
      harness: { validator: "def validate(): pass", ignored: 1 },
      metadata: { completed_runs: 3 },
      task_prompt: "Summarize the incident.",
      judge_rubric: "Evaluate completeness.",
      output_format: "free_text",
      reference_context: "Incident history",
      context_preparation: "Load recent incidents",
      max_rounds: 2,
      quality_threshold: 0.88,
    });

    expect(pkg).toMatchObject({
      scenarioName: "grid_ctf",
      displayName: "Grid CTF",
      bestStrategy: { aggression: 0.7 },
      harness: { validator: "def validate(): pass" },
      taskPrompt: "Summarize the incident.",
      judgeRubric: "Evaluate completeness.",
      maxRounds: 2,
      qualityThreshold: 0.88,
    });
  });
});
