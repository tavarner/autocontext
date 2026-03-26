/**
 * Resource Trader — deterministic simulation scenario (AC-402).
 *
 * A simple trading simulation with fixed-rule state transitions.
 * Players buy and sell resources (wood, stone, food) to maximize gold.
 * Prices fluctuate deterministically based on seed. No API key required.
 */

import type {
  LegalAction,
  Observation,
  Result,
  ScenarioInterface,
  ScoringDimension,
} from "./game-interface.js";
import { ResultSchema } from "./game-interface.js";

const MAX_TURNS = 5;
const RESOURCES = ["wood", "stone", "food"] as const;
type Resource = (typeof RESOURCES)[number];

function createRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generatePrices(rng: () => number): Record<Resource, number> {
  return {
    wood: Math.round((2 + rng() * 6) * 100) / 100,
    stone: Math.round((3 + rng() * 8) * 100) / 100,
    food: Math.round((1 + rng() * 4) * 100) / 100,
  };
}

export class ResourceTrader implements ScenarioInterface {
  readonly name = "resource_trader";

  scoringDimensions(): ScoringDimension[] {
    return [
      { name: "profit", weight: 0.6, description: "Net gold earned from trading." },
      { name: "diversification", weight: 0.25, description: "How well the trader diversified across resources." },
      { name: "efficiency", weight: 0.15, description: "How few wasted turns (invalid or unprofitable trades)." },
    ];
  }

  describeRules(): string {
    return `Resource trading simulation over ${MAX_TURNS} turns. Buy and sell wood, stone, or food. Prices change each turn. Maximize gold.`;
  }

  describeStrategyInterface(): string {
    return 'Return JSON with `buy` (resource name), `sell` (resource name), and `amount` (integer 1-5).';
  }

  describeEvaluationCriteria(): string {
    return "Maximize gold through profitable trades. Diversify across resources. Avoid wasteful trades.";
  }

  initialState(seed?: number): Record<string, unknown> {
    const rng = createRng(seed ?? 0);
    const prices = generatePrices(rng);
    return {
      seed: seed ?? 0,
      turn: 0,
      gold: 100,
      inventory: { wood: 5, stone: 5, food: 5 },
      prices,
      terminal: false,
      timeline: [],
      trades: [],
    };
  }

  getObservation(state: Record<string, unknown>, playerId: string): Observation {
    const prices = state.prices as Record<string, number>;
    const inv = state.inventory as Record<string, number>;
    return {
      narrative: `Turn ${state.turn}/${MAX_TURNS}. ${playerId} has ${state.gold} gold. Inventory: wood=${inv.wood}, stone=${inv.stone}, food=${inv.food}. Prices: wood=${prices.wood}, stone=${prices.stone}, food=${prices.food}.`,
      state: { gold: state.gold, inventory: inv, prices, turn: state.turn },
      constraints: ["Amount must be 1-5.", "Cannot sell more than you own.", "Cannot buy if you lack gold."],
    };
  }

  validateActions(
    state: Record<string, unknown>,
    _playerId: string,
    actions: Record<string, unknown>,
  ): [boolean, string] {
    const buy = actions.buy as string;
    const sell = actions.sell as string;
    const amount = actions.amount as number;

    if (!RESOURCES.includes(buy as Resource)) {
      return [false, `Invalid buy resource: ${buy}. Must be one of: ${RESOURCES.join(", ")}`];
    }
    if (!RESOURCES.includes(sell as Resource)) {
      return [false, `Invalid sell resource: ${sell}. Must be one of: ${RESOURCES.join(", ")}`];
    }
    if (typeof amount !== "number" || !Number.isInteger(amount) || amount < 1 || amount > 5) {
      return [false, "Amount must be an integer between 1 and 5"];
    }

    const inv = state.inventory as Record<string, number>;
    if (inv[sell] < amount) {
      return [false, `Not enough ${sell} to sell (have ${inv[sell]}, want ${amount})`];
    }

    const prices = state.prices as Record<string, number>;
    const cost = prices[buy] * amount;
    const revenue = prices[sell] * amount;
    const netCost = cost - revenue;
    if (netCost > (state.gold as number)) {
      return [false, `Not enough gold (have ${state.gold}, need ${netCost.toFixed(2)})`];
    }

    return [true, "ok"];
  }

  step(state: Record<string, unknown>, actions: Record<string, unknown>): Record<string, unknown> {
    const buy = actions.buy as Resource;
    const sell = actions.sell as Resource;
    const amount = (actions.amount as number) ?? 1;
    const prices = state.prices as Record<string, number>;
    const inv = { ...(state.inventory as Record<string, number>) };

    const revenue = prices[sell] * amount;
    const cost = prices[buy] * amount;
    inv[sell] -= amount;
    inv[buy] += amount;
    const gold = Math.round(((state.gold as number) + revenue - cost) * 100) / 100;

    const turn = (state.turn as number) + 1;
    const rng = createRng((state.seed as number) + turn * 7919);
    const newPrices = generatePrices(rng);

    const timeline = [...(state.timeline as Array<Record<string, unknown>>)];
    timeline.push({ event: "trade", turn, buy, sell, amount, revenue, cost, gold });

    const trades = [...(state.trades as Array<Record<string, unknown>>)];
    trades.push({ buy, sell, amount });

    return {
      ...state,
      turn,
      gold,
      inventory: inv,
      prices: newPrices,
      terminal: turn >= MAX_TURNS,
      timeline,
      trades,
    };
  }

  isTerminal(state: Record<string, unknown>): boolean {
    return Boolean(state.terminal);
  }

  getResult(state: Record<string, unknown>): Result {
    const gold = (state.gold as number) ?? 100;
    const initialGold = 100;
    const profit = gold - initialGold;
    // Normalize to 0-1: +50 gold = 1.0, 0 = 0.5, -50 = 0.0
    const rawScore = 0.5 + profit / 100;
    const score = Math.round(Math.max(0, Math.min(1, rawScore)) * 10000) / 10000;

    const trades = (state.trades ?? []) as Array<Record<string, unknown>>;
    const resourcesBought = new Set(trades.map((t) => t.buy));
    const diversification = Math.round((resourcesBought.size / RESOURCES.length) * 10000) / 10000;

    return ResultSchema.parse({
      score,
      winner: score >= 0.52 ? "challenger" : "incumbent",
      summary: `Resource trader ended with ${gold} gold (profit: ${profit >= 0 ? "+" : ""}${profit.toFixed(2)})`,
      replay: state.timeline as Array<Record<string, unknown>>,
      metrics: { profit: Math.round(profit * 100) / 100, diversification },
    });
  }

  replayToNarrative(replay: Array<Record<string, unknown>>): string {
    if (!replay.length) return "No trades executed.";
    return replay
      .filter((e) => e.event === "trade")
      .map((e) => `Turn ${e.turn}: sold ${e.amount} ${e.sell} for ${e.revenue}, bought ${e.amount} ${e.buy} for ${e.cost}`)
      .join(". ");
  }

  renderFrame(state: Record<string, unknown>): Record<string, unknown> {
    return {
      scenario: this.name,
      turn: state.turn,
      gold: state.gold,
      inventory: state.inventory,
      prices: state.prices,
    };
  }

  enumerateLegalActions(state: Record<string, unknown>): LegalAction[] | null {
    if (this.isTerminal(state)) return [];
    return [
      { action: "buy", description: "Resource to buy", type: "choice" },
      { action: "sell", description: "Resource to sell", type: "choice" },
      { action: "amount", description: "Amount to trade", type: "discrete", range: [1, 5] },
    ];
  }

  executeMatch(strategy: Record<string, unknown>, seed: number): Result {
    let state = this.initialState(seed);
    for (let i = 0; i < MAX_TURNS; i++) {
      if (this.isTerminal(state)) break;
      const [valid, reason] = this.validateActions(state, "challenger", strategy);
      if (!valid) {
        return ResultSchema.parse({
          score: 0,
          winner: "incumbent",
          summary: "strategy rejected during validation",
          replay: [{ event: "validation_failed", reason }],
          metrics: { valid: 0 },
          validationErrors: [reason],
        });
      }
      state = this.step(state, strategy);
    }
    return this.getResult(state);
  }
}
