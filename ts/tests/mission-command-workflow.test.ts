import { describe, expect, it } from "vitest";

import {
  buildMissionCheckpointPayload,
  getMissionIdOrThrow,
  MISSION_HELP_TEXT,
  planMissionCreate,
  planMissionList,
  planMissionRun,
} from "../src/cli/mission-command-workflow.js";

describe("mission command workflow", () => {
  it("exposes stable help text", () => {
    expect(MISSION_HELP_TEXT).toContain("autoctx mission");
    expect(MISSION_HELP_TEXT).toContain("create");
    expect(MISSION_HELP_TEXT).toContain("run");
    expect(MISSION_HELP_TEXT).toContain("artifacts");
    expect(MISSION_HELP_TEXT.toLowerCase()).toContain("see also");
  });

  it("plans generic mission creation", () => {
    expect(
      planMissionCreate(
        {
          type: undefined,
          name: "Ship login",
          goal: "Implement OAuth",
          "max-steps": "5",
          "repo-path": undefined,
          "test-command": undefined,
          "lint-command": undefined,
          "build-command": undefined,
        },
        (value: string) => `/abs/${value}`,
      ),
    ).toEqual({
      missionType: "generic",
      name: "Ship login",
      goal: "Implement OAuth",
      budget: { maxSteps: 5 },
    });
  });

  it("plans code mission creation and resolves repo path", () => {
    expect(
      planMissionCreate(
        {
          type: "code",
          name: "Fix login",
          goal: "Tests pass",
          "max-steps": undefined,
          "repo-path": ".",
          "test-command": "npm test",
          "lint-command": "npm run lint",
          "build-command": "npm run build",
        },
        (value: string) => `/abs/${value}`,
      ),
    ).toEqual({
      missionType: "code",
      name: "Fix login",
      goal: "Tests pass",
      budget: undefined,
      repoPath: "/abs/.",
      testCommand: "npm test",
      lintCommand: "npm run lint",
      buildCommand: "npm run build",
    });
  });

  it("rejects incomplete mission create requests", () => {
    expect(() =>
      planMissionCreate(
        {
          type: undefined,
          name: undefined,
          goal: undefined,
          "max-steps": undefined,
          "repo-path": undefined,
          "test-command": undefined,
          "lint-command": undefined,
          "build-command": undefined,
        },
        (value: string) => value,
      ),
    ).toThrow(
      "Usage: autoctx mission create --name <name> --goal <goal> [--type code --repo-path <path> --test-command <cmd> [--lint-command <cmd>] [--build-command <cmd>]] [--max-steps N]",
    );

    expect(() =>
      planMissionCreate(
        {
          type: "code",
          name: "Fix login",
          goal: "Tests pass",
          "max-steps": undefined,
          "repo-path": undefined,
          "test-command": undefined,
          "lint-command": undefined,
          "build-command": undefined,
        },
        (value: string) => value,
      ),
    ).toThrow("Code missions require --repo-path and --test-command.");
  });

  it("plans mission runs and adaptive-planning requirements", () => {
    expect(
      planMissionRun(
        {
          id: "mission-1",
          "max-iterations": "3",
          "step-description": "Inspect auth flow",
        },
        { metadata: { missionType: "generic" } },
      ),
    ).toEqual({
      id: "mission-1",
      maxIterations: 3,
      stepDescription: "Inspect auth flow",
      needsAdaptivePlanning: true,
    });

    expect(
      planMissionRun(
        {
          id: "mission-2",
          "max-iterations": undefined,
          "step-description": undefined,
        },
        { metadata: { missionType: "code" } },
      ),
    ).toEqual({
      id: "mission-2",
      maxIterations: 1,
      stepDescription: undefined,
      needsAdaptivePlanning: false,
    });
  });

  it("requires mission ids for id-based subcommands", () => {
    expect(() =>
      getMissionIdOrThrow({}, "Usage: autoctx mission status --id <mission-id>"),
    ).toThrow("Usage: autoctx mission status --id <mission-id>");
    expect(
      getMissionIdOrThrow(
        { id: "mission-1" },
        "Usage: autoctx mission status --id <mission-id>",
      ),
    ).toBe("mission-1");
  });

  it("plans mission list filters", () => {
    expect(planMissionList({ status: "active" })).toEqual({ status: "active" });
    expect(planMissionList({ status: undefined })).toEqual({ status: undefined });
  });

  it("builds checkpoint payloads", () => {
    expect(
      buildMissionCheckpointPayload(
        { id: "mission-1", status: "paused" },
        "/tmp/checkpoint.json",
      ),
    ).toEqual({
      id: "mission-1",
      status: "paused",
      checkpointPath: "/tmp/checkpoint.json",
    });
  });
});
