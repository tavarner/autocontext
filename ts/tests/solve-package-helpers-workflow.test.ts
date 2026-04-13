import { describe, expect, it } from "vitest";

import {
  buildAgentTaskLessons,
  buildGeneratedScenarioLessons,
  buildGeneratedScenarioPlaybook,
  humanizeScenarioName,
} from "../src/knowledge/solve-package-helpers.js";

describe("solve package helpers workflow", () => {
  it("humanizes scenario names and builds agent-task lessons", () => {
    expect(humanizeScenarioName("incident_triage")).toBe("Incident Triage");
    expect(buildAgentTaskLessons({
      bestScore: 0.92,
      totalRounds: 2,
      terminationReason: "threshold_met",
    }, "Added explicit owner assignment.")).toEqual([
      "The best output reached 0.9200 quality after 2 rounds.",
      "The loop stopped because 'threshold_met'.",
      "Added explicit owner assignment.",
    ]);
  });

  it("builds generated-scenario playbooks and weakest-dimension lessons", () => {
    expect(buildGeneratedScenarioPlaybook("investigation", {
      score: 0.84,
      reasoning: "Gathered evidence before diagnosis.",
      dimensionScores: { evidence: 0.9, diagnosis: 0.7 },
      records: [
        { action: { name: "collect_logs" } },
        { action: { name: "form_hypothesis" } },
      ],
      stepsExecuted: 2,
    })).toContain("collect_logs");

    expect(buildGeneratedScenarioLessons({
      reasoning: "Gathered evidence before diagnosis.",
      dimensionScores: { evidence: 0.9, diagnosis: 0.7 },
    })).toEqual([
      "Gathered evidence before diagnosis.",
      "The weakest dimension was 'diagnosis' at 0.7000.",
    ]);
  });
});
