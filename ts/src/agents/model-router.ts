/**
 * Model router — tier-based model selection (AC-345 Task 16).
 * Mirrors Python's autocontext/agents/model_router.py.
 */

export interface TierConfigOpts {
  enabled?: boolean;
  tierHaikuModel?: string;
  tierSonnetModel?: string;
  tierOpusModel?: string;
  competitorHaikuMaxGen?: number;
  competitorRetryEscalation?: number;
  coachMinTier?: string;
  architectMinTier?: string;
  analystMinTier?: string;
  translatorMinTier?: string;
}

export class TierConfig {
  readonly enabled: boolean;
  readonly tierHaikuModel: string;
  readonly tierSonnetModel: string;
  readonly tierOpusModel: string;
  readonly competitorHaikuMaxGen: number;
  readonly competitorRetryEscalation: number;
  readonly coachMinTier: string;
  readonly architectMinTier: string;
  readonly analystMinTier: string;
  readonly translatorMinTier: string;

  constructor(opts: TierConfigOpts = {}) {
    this.enabled = opts.enabled ?? false;
    this.tierHaikuModel = opts.tierHaikuModel ?? "claude-haiku-4-5-20251001";
    this.tierSonnetModel = opts.tierSonnetModel ?? "claude-sonnet-4-5-20250929";
    this.tierOpusModel = opts.tierOpusModel ?? "claude-opus-4-6";
    this.competitorHaikuMaxGen = opts.competitorHaikuMaxGen ?? 3;
    this.competitorRetryEscalation = opts.competitorRetryEscalation ?? 1;
    this.coachMinTier = opts.coachMinTier ?? "sonnet";
    this.architectMinTier = opts.architectMinTier ?? "opus";
    this.analystMinTier = opts.analystMinTier ?? "haiku";
    this.translatorMinTier = opts.translatorMinTier ?? "haiku";
  }
}

export interface SelectOpts {
  generation: number;
  retryCount: number;
  isPlateau: boolean;
}

const TIER_ORDER = ["haiku", "sonnet", "opus"] as const;

export class ModelRouter {
  private config: TierConfig;
  private tierMap: Record<string, string>;

  constructor(config: TierConfig) {
    this.config = config;
    this.tierMap = {
      haiku: config.tierHaikuModel,
      sonnet: config.tierSonnetModel,
      opus: config.tierOpusModel,
    };
  }

  select(role: string, opts: SelectOpts): string | null {
    if (!this.config.enabled) return null;

    const minTiers: Record<string, string> = {
      analyst: this.config.analystMinTier,
      coach: this.config.coachMinTier,
      architect: this.config.architectMinTier,
      translator: this.config.translatorMinTier,
      curator: "opus",
    };

    let tier = minTiers[role] ?? "sonnet";

    if (role === "competitor") {
      tier = opts.generation <= this.config.competitorHaikuMaxGen ? "haiku" : "sonnet";

      if (opts.retryCount >= this.config.competitorRetryEscalation) {
        tier = this.maxTier(tier, "sonnet");
      }
      if (opts.isPlateau) {
        tier = "opus";
      }
    } else if (role === "analyst" || role === "coach") {
      if (opts.isPlateau) {
        tier = this.maxTier(tier, "opus");
      }
    }

    return this.tierMap[tier] ?? null;
  }

  private maxTier(a: string, b: string): string {
    const ai = TIER_ORDER.indexOf(a as (typeof TIER_ORDER)[number]);
    const bi = TIER_ORDER.indexOf(b as (typeof TIER_ORDER)[number]);
    return ai >= bi ? a : b;
  }
}
