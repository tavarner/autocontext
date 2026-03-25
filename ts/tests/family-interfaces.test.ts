/**
 * Tests for AC-380: Runtime interface contracts for all 11 scenario families.
 */

import { describe, it, expect } from "vitest";

describe("Scenario family interfaces", () => {
  it("exports all 11 family interface types", async () => {
    const mod = await import("../src/scenarios/family-interfaces.js");

    // Game
    expect(mod.isGameScenario).toBeDefined();
    // Agent task
    expect(mod.isAgentTask).toBeDefined();
    // Simulation-family
    expect(mod.isSimulation).toBeDefined();
    expect(mod.isNegotiation).toBeDefined();
    expect(mod.isInvestigation).toBeDefined();
    expect(mod.isWorkflow).toBeDefined();
    expect(mod.isSchemaEvolution).toBeDefined();
    expect(mod.isToolFragility).toBeDefined();
    expect(mod.isOperatorLoop).toBeDefined();
    expect(mod.isCoordination).toBeDefined();
    expect(mod.isArtifactEditing).toBeDefined();
  });

  it("isSimulation detects simulation-like objects", async () => {
    const { isSimulation } = await import("../src/scenarios/family-interfaces.js");
    const mock = {
      describeScenario: () => "test",
      describeEnvironment: () => ({}),
      initialState: () => ({}),
      getAvailableActions: () => [],
      executeAction: () => [{}, {}],
      isTerminal: () => false,
      evaluateTrace: () => ({}),
      getRubric: () => "rubric",
    };
    expect(isSimulation(mock)).toBe(true);
    expect(isSimulation({})).toBe(false);
  });

  it("isNegotiation detects negotiation-like objects", async () => {
    const { isNegotiation } = await import("../src/scenarios/family-interfaces.js");
    const mock = {
      describeScenario: () => "test",
      getParties: () => [],
      initialState: () => ({}),
      proposeOffer: () => ({}),
      evaluateNegotiation: () => ({}),
      getRubric: () => "rubric",
    };
    expect(isNegotiation(mock)).toBe(true);
  });

  it("isInvestigation detects investigation-like objects", async () => {
    const { isInvestigation } = await import("../src/scenarios/family-interfaces.js");
    const mock = {
      describeScenario: () => "test",
      initialState: () => ({}),
      getAvailableActions: () => [],
      executeAction: () => [{}, {}],
      evaluateTrace: () => ({}),
      getRubric: () => "rubric",
      getRedHerrings: () => [],
    };
    expect(isInvestigation(mock)).toBe(true);
  });

  it("isWorkflow detects workflow-like objects", async () => {
    const { isWorkflow } = await import("../src/scenarios/family-interfaces.js");
    const mock = {
      describeScenario: () => "test",
      initialState: () => ({}),
      getSteps: () => [],
      executeStep: () => ({}),
      evaluateWorkflow: () => ({}),
      getRubric: () => "rubric",
    };
    expect(isWorkflow(mock)).toBe(true);
  });

  it("isArtifactEditing detects artifact-editing-like objects", async () => {
    const { isArtifactEditing } = await import("../src/scenarios/family-interfaces.js");
    const mock = {
      describeTask: () => "test",
      getArtifact: () => "content",
      evaluateEdit: () => ({}),
      getRubric: () => "rubric",
    };
    expect(isArtifactEditing(mock)).toBe(true);
  });

  it("detectFamily returns correct family name", async () => {
    const { detectFamily } = await import("../src/scenarios/family-interfaces.js");

    const sim = {
      describeScenario: () => "", describeEnvironment: () => ({}),
      initialState: () => ({}), getAvailableActions: () => [],
      executeAction: () => [{}, {}], isTerminal: () => false,
      evaluateTrace: () => ({}), getRubric: () => "",
    };
    expect(detectFamily(sim)).toBe("simulation");

    const agentTask = {
      getTaskPrompt: () => "", evaluateOutput: async () => ({}),
      getRubric: () => "", initialState: () => ({}), describeTask: () => "",
    };
    expect(detectFamily(agentTask)).toBe("agent_task");

    expect(detectFamily({})).toBeNull();
  });
});
