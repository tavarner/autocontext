/**
 * Tests for AC-402: Built-in deterministic scenarios beyond grid_ctf.
 *
 * - OthelloScenario (game scenario, port from Python)
 * - WordCountTask (deterministic agent_task, no API key)
 * - ResourceTrader (deterministic simulation with fixed rules)
 * - All registered in SCENARIO_REGISTRY
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// SCENARIO_REGISTRY
// ---------------------------------------------------------------------------

describe("Registries", () => {
  it("SCENARIO_REGISTRY contains grid_ctf, othello, resource_trader", async () => {
    const { SCENARIO_REGISTRY } = await import("../src/scenarios/registry.js");
    expect(SCENARIO_REGISTRY.grid_ctf).toBeDefined();
    expect(SCENARIO_REGISTRY.othello).toBeDefined();
    expect(SCENARIO_REGISTRY.resource_trader).toBeDefined();
  });

  it("AGENT_TASK_REGISTRY contains word_count", async () => {
    const { AGENT_TASK_REGISTRY } = await import("../src/scenarios/registry.js");
    expect(AGENT_TASK_REGISTRY.word_count).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// OthelloScenario
// ---------------------------------------------------------------------------

describe("OthelloScenario", () => {
  it("exports OthelloScenario class", async () => {
    const { OthelloScenario } = await import("../src/scenarios/othello.js");
    expect(OthelloScenario).toBeDefined();
  });

  it("has name 'othello'", async () => {
    const { OthelloScenario } = await import("../src/scenarios/othello.js");
    const scenario = new OthelloScenario();
    expect(scenario.name).toBe("othello");
  });

  it("describeRules returns non-empty string", async () => {
    const { OthelloScenario } = await import("../src/scenarios/othello.js");
    const scenario = new OthelloScenario();
    expect(scenario.describeRules().length).toBeGreaterThan(0);
  });

  it("initialState produces deterministic state from seed", async () => {
    const { OthelloScenario } = await import("../src/scenarios/othello.js");
    const scenario = new OthelloScenario();
    const s1 = scenario.initialState(42);
    const s2 = scenario.initialState(42);
    expect(s1).toEqual(s2);
    expect(s1.terminal).toBe(false);
  });

  it("validateActions accepts valid strategy", async () => {
    const { OthelloScenario } = await import("../src/scenarios/othello.js");
    const scenario = new OthelloScenario();
    const state = scenario.initialState(1);
    const [valid, msg] = scenario.validateActions(state, "challenger", {
      mobility_weight: 0.5,
      corner_weight: 0.3,
      stability_weight: 0.2,
    });
    expect(valid).toBe(true);
  });

  it("validateActions rejects missing fields", async () => {
    const { OthelloScenario } = await import("../src/scenarios/othello.js");
    const scenario = new OthelloScenario();
    const state = scenario.initialState(1);
    const [valid, msg] = scenario.validateActions(state, "challenger", {});
    expect(valid).toBe(false);
    expect(msg).toContain("mobility_weight");
  });

  it("step produces terminal state with score", async () => {
    const { OthelloScenario } = await import("../src/scenarios/othello.js");
    const scenario = new OthelloScenario();
    const state = scenario.initialState(1);
    const next = scenario.step(state, {
      mobility_weight: 0.6,
      corner_weight: 0.8,
      stability_weight: 0.5,
    });
    expect(next.terminal).toBe(true);
    expect(typeof next.score).toBe("number");
  });

  it("executeMatch returns deterministic Result from seed", async () => {
    const { OthelloScenario } = await import("../src/scenarios/othello.js");
    const scenario = new OthelloScenario();
    const r1 = scenario.executeMatch({ mobility_weight: 0.5, corner_weight: 0.5, stability_weight: 0.5 }, 100);
    const r2 = scenario.executeMatch({ mobility_weight: 0.5, corner_weight: 0.5, stability_weight: 0.5 }, 100);
    expect(r1.score).toBe(r2.score);
    expect(r1.score).toBeGreaterThanOrEqual(0);
    expect(r1.score).toBeLessThanOrEqual(1);
  });

  it("scoringDimensions returns mobility, corner_pressure, stability", async () => {
    const { OthelloScenario } = await import("../src/scenarios/othello.js");
    const scenario = new OthelloScenario();
    const dims = scenario.scoringDimensions()!;
    expect(dims.length).toBe(3);
    const names = dims.map((d) => d.name);
    expect(names).toContain("mobility");
    expect(names).toContain("corner_pressure");
    expect(names).toContain("stability");
  });
});

// ---------------------------------------------------------------------------
// WordCountTask (deterministic agent_task)
// ---------------------------------------------------------------------------

describe("WordCountTask", () => {
  it("exports WordCountTask class", async () => {
    const { WordCountTask } = await import("../src/scenarios/word-count.js");
    expect(WordCountTask).toBeDefined();
  });

  it("getTaskPrompt returns non-empty string", async () => {
    const { WordCountTask } = await import("../src/scenarios/word-count.js");
    const task = new WordCountTask();
    expect(task.getTaskPrompt().length).toBeGreaterThan(0);
  });

  it("getRubric returns non-empty string", async () => {
    const { WordCountTask } = await import("../src/scenarios/word-count.js");
    const task = new WordCountTask();
    expect(task.getRubric().length).toBeGreaterThan(0);
  });

  it("evaluateOutput scores based on word count accuracy", async () => {
    const { WordCountTask } = await import("../src/scenarios/word-count.js");
    const task = new WordCountTask();
    // The task prompt asks to produce exactly N words
    const prompt = task.getTaskPrompt();
    const targetMatch = prompt.match(/(\d+)\s*words/i);
    expect(targetMatch).not.toBeNull();
    const target = parseInt(targetMatch![1], 10);

    // Perfect output
    const perfectOutput = Array.from({ length: target }, (_, i) => `word${i}`).join(" ");
    const perfectResult = await task.evaluateOutput(perfectOutput);
    expect(perfectResult.score).toBeGreaterThanOrEqual(0.8);

    // Way off output
    const badOutput = "just three words";
    const badResult = await task.evaluateOutput(badOutput);
    expect(badResult.score).toBeLessThan(perfectResult.score);
  });

  it("initialState returns empty object", async () => {
    const { WordCountTask } = await import("../src/scenarios/word-count.js");
    const task = new WordCountTask();
    expect(task.initialState()).toEqual({});
  });

  it("describeTask returns non-empty string", async () => {
    const { WordCountTask } = await import("../src/scenarios/word-count.js");
    const task = new WordCountTask();
    expect(task.describeTask().length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// ResourceTrader (deterministic simulation)
// ---------------------------------------------------------------------------

describe("ResourceTrader", () => {
  it("exports ResourceTrader class", async () => {
    const { ResourceTrader } = await import("../src/scenarios/resource-trader.js");
    expect(ResourceTrader).toBeDefined();
  });

  it("has name 'resource_trader'", async () => {
    const { ResourceTrader } = await import("../src/scenarios/resource-trader.js");
    const scenario = new ResourceTrader();
    expect(scenario.name).toBe("resource_trader");
  });

  it("initialState produces deterministic state from seed", async () => {
    const { ResourceTrader } = await import("../src/scenarios/resource-trader.js");
    const scenario = new ResourceTrader();
    const s1 = scenario.initialState(42);
    const s2 = scenario.initialState(42);
    expect(s1).toEqual(s2);
    expect(s1.terminal).toBe(false);
    expect(typeof s1.gold).toBe("number");
  });

  it("validateActions accepts valid trade", async () => {
    const { ResourceTrader } = await import("../src/scenarios/resource-trader.js");
    const scenario = new ResourceTrader();
    const state = scenario.initialState(1);
    const [valid] = scenario.validateActions(state, "player", {
      buy: "wood",
      sell: "stone",
      amount: 2,
    });
    expect(valid).toBe(true);
  });

  it("validateActions rejects invalid resource names", async () => {
    const { ResourceTrader } = await import("../src/scenarios/resource-trader.js");
    const scenario = new ResourceTrader();
    const state = scenario.initialState(1);
    const [valid, msg] = scenario.validateActions(state, "player", {
      buy: "diamonds",
      sell: "stone",
      amount: 1,
    });
    expect(valid).toBe(false);
  });

  it("step updates resources and advances turn", async () => {
    const { ResourceTrader } = await import("../src/scenarios/resource-trader.js");
    const scenario = new ResourceTrader();
    const state = scenario.initialState(1);
    const next = scenario.step(state, { buy: "wood", sell: "stone", amount: 1 });
    expect(next.turn).toBe((state.turn as number) + 1);
  });

  it("executeMatch returns deterministic Result", async () => {
    const { ResourceTrader } = await import("../src/scenarios/resource-trader.js");
    const scenario = new ResourceTrader();
    const r1 = scenario.executeMatch({ buy: "wood", sell: "stone", amount: 2 }, 100);
    const r2 = scenario.executeMatch({ buy: "wood", sell: "stone", amount: 2 }, 100);
    expect(r1.score).toBe(r2.score);
    expect(r1.score).toBeGreaterThanOrEqual(0);
    expect(r1.score).toBeLessThanOrEqual(1);
  });

  it("game terminates after fixed number of turns", async () => {
    const { ResourceTrader } = await import("../src/scenarios/resource-trader.js");
    const scenario = new ResourceTrader();
    let state = scenario.initialState(1);
    const strategy = { buy: "wood", sell: "stone", amount: 1 };
    for (let i = 0; i < 20; i++) {
      if (scenario.isTerminal(state)) break;
      state = scenario.step(state, strategy);
    }
    expect(scenario.isTerminal(state)).toBe(true);
  });
});
