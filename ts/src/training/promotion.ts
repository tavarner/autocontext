/**
 * Candidate-shadow-active promotion lifecycle (AC-456).
 *
 * Staged deployment pipeline for distilled models:
 *   candidate → shadow → active
 *
 * A model only becomes the live default after proving itself:
 * 1. candidate: just trained, passes held-out eval
 * 2. shadow: runs alongside incumbent, scores compared
 * 3. active: promoted to live default after shadow validation
 *
 * Automatic rollback on parse/validation/score regressions.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ActivationState = "candidate" | "shadow" | "active" | "disabled" | "deprecated";

export const ACTIVATION_STATES: readonly ActivationState[] = [
  "candidate", "shadow", "active", "disabled", "deprecated",
];

export interface PromotionEvent {
  from: ActivationState;
  to: ActivationState;
  reason: string;
  evidence?: Record<string, unknown>;
  timestamp: string;
}

export interface ModelRecord {
  artifactId: string;
  scenario: string;
  family: string;
  backend: string;
  checkpointDir: string;
  activationState: ActivationState;
  promotionHistory: PromotionEvent[];
  registeredAt: string;
}

export interface PromotionCheck {
  currentState: ActivationState;
  heldOutScore: number;
  incumbentScore: number;
  shadowRunScore?: number;
  parseFailureRate: number;
  validationFailureRate: number;
}

export interface PromotionDecision {
  promote: boolean;
  rollback: boolean;
  targetState: ActivationState;
  reasoning: string;
}

// ---------------------------------------------------------------------------
// ModelRegistry
// ---------------------------------------------------------------------------

function generateId(): string {
  return `model_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export class ModelRegistry {
  private records = new Map<string, ModelRecord>();

  register(opts: {
    scenario: string;
    family: string;
    backend: string;
    checkpointDir: string;
    activationState?: ActivationState;
  }): string {
    const id = generateId();
    this.records.set(id, {
      artifactId: id,
      scenario: opts.scenario,
      family: opts.family,
      backend: opts.backend,
      checkpointDir: opts.checkpointDir,
      activationState: opts.activationState ?? "candidate",
      promotionHistory: [],
      registeredAt: new Date().toISOString(),
    });
    return id;
  }

  get(id: string): ModelRecord | null {
    return this.records.get(id) ?? null;
  }

  listForScenario(scenario: string): ModelRecord[] {
    return [...this.records.values()].filter((r) => r.scenario === scenario);
  }

  resolveActive(scenario: string): ModelRecord | null {
    return this.listForScenario(scenario).find((r) => r.activationState === "active") ?? null;
  }

  setState(
    id: string,
    state: ActivationState,
    opts?: { reason?: string; evidence?: Record<string, unknown> },
  ): void {
    const record = this.records.get(id);
    if (!record) return;

    const from = record.activationState;

    // If promoting to active, demote any existing active for the same scenario
    if (state === "active") {
      for (const r of this.records.values()) {
        if (r.scenario === record.scenario && r.activationState === "active" && r.artifactId !== id) {
          r.activationState = "disabled";
          r.promotionHistory.push({
            from: "active",
            to: "disabled",
            reason: `Displaced by ${id}`,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    record.activationState = state;
    record.promotionHistory.push({
      from,
      to: state,
      reason: opts?.reason ?? `State changed to ${state}`,
      evidence: opts?.evidence,
      timestamp: new Date().toISOString(),
    });
  }

  listAll(): ModelRecord[] {
    return [...this.records.values()];
  }
}

// ---------------------------------------------------------------------------
// PromotionEngine
// ---------------------------------------------------------------------------

export interface PromotionThresholds {
  /** Minimum held-out score as ratio of incumbent (default: 0.90) */
  heldOutMinRatio: number;
  /** Minimum shadow-run score as ratio of incumbent (default: 0.85) */
  shadowMinRatio: number;
  /** Maximum parse failure rate before blocking (default: 0.05) */
  maxParseFailureRate: number;
  /** Maximum validation failure rate before blocking (default: 0.05) */
  maxValidationFailureRate: number;
  /** Score ratio below which active model is rolled back (default: 0.75) */
  regressionThreshold: number;
}

const DEFAULT_THRESHOLDS: PromotionThresholds = {
  heldOutMinRatio: 0.90,
  shadowMinRatio: 0.85,
  maxParseFailureRate: 0.05,
  maxValidationFailureRate: 0.05,
  regressionThreshold: 0.75,
};

/**
 * Hook for executing shadow runs. Implementations replay production
 * prompts through the candidate model and return scores.
 */
export type ShadowExecutor = (artifactId: string, scenario: string) => Promise<{
  score: number;
  parseFailureRate: number;
  validationFailureRate: number;
  samplesRun: number;
}>;

export class PromotionEngine {
  private thresholds: PromotionThresholds;
  private shadowExecutor?: ShadowExecutor;

  constructor(opts?: { thresholds?: Partial<PromotionThresholds>; shadowExecutor?: ShadowExecutor }) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...(opts?.thresholds ?? {}) };
    this.shadowExecutor = opts?.shadowExecutor;
  }

  /**
   * Run shadow traffic for a candidate/shadow model.
   * Returns the shadow-run score for use in evaluate().
   */
  async runShadow(artifactId: string, scenario: string): Promise<PromotionCheck | null> {
    if (!this.shadowExecutor) return null;
    const result = await this.shadowExecutor(artifactId, scenario);
    return {
      currentState: "shadow",
      heldOutScore: result.score,
      incumbentScore: 0, // caller must set
      shadowRunScore: result.score,
      parseFailureRate: result.parseFailureRate,
      validationFailureRate: result.validationFailureRate,
    };
  }

  evaluate(check: PromotionCheck): PromotionDecision {
    const ratio = check.incumbentScore > 0
      ? check.heldOutScore / check.incumbentScore
      : 1;

    // Check for regressions that trigger rollback
    if (check.currentState === "active" || check.currentState === "shadow") {
      if (ratio < this.thresholds.regressionThreshold || check.parseFailureRate > this.thresholds.maxParseFailureRate * 2) {
        return {
          promote: false,
          rollback: true,
          targetState: "disabled",
          reasoning: `Regression detected: held-out ratio ${ratio.toFixed(2)} (threshold ${this.thresholds.regressionThreshold}), ` +
            `parse failures ${(check.parseFailureRate * 100).toFixed(1)}%.`,
        };
      }
    }

    // Parse failure gate
    if (check.parseFailureRate > this.thresholds.maxParseFailureRate) {
      return {
        promote: false,
        rollback: false,
        targetState: check.currentState,
        reasoning: `parse failure rate ${(check.parseFailureRate * 100).toFixed(1)}% exceeds ${(this.thresholds.maxParseFailureRate * 100).toFixed(1)}% threshold.`,
      };
    }

    // Validation failure gate
    if (check.validationFailureRate > this.thresholds.maxValidationFailureRate) {
      return {
        promote: false,
        rollback: false,
        targetState: check.currentState,
        reasoning: `Validation failure rate ${(check.validationFailureRate * 100).toFixed(1)}% exceeds threshold.`,
      };
    }

    // Candidate → Shadow: held-out eval must pass
    if (check.currentState === "candidate") {
      if (ratio >= this.thresholds.heldOutMinRatio) {
        return {
          promote: true,
          rollback: false,
          targetState: "shadow",
          reasoning: `Held-out score ${check.heldOutScore.toFixed(2)} is ${(ratio * 100).toFixed(1)}% of incumbent ${check.incumbentScore.toFixed(2)} (threshold ${(this.thresholds.heldOutMinRatio * 100).toFixed(0)}%).`,
        };
      }
      return {
        promote: false,
        rollback: false,
        targetState: "candidate",
        reasoning: `Held-out score ${check.heldOutScore.toFixed(2)} is below ${(this.thresholds.heldOutMinRatio * 100).toFixed(0)}% of incumbent ${check.incumbentScore.toFixed(2)}.`,
      };
    }

    // Shadow → Active: shadow-run score must be acceptable
    if (check.currentState === "shadow") {
      const shadowRatio = check.shadowRunScore != null && check.incumbentScore > 0
        ? check.shadowRunScore / check.incumbentScore
        : ratio;

      if (shadowRatio >= this.thresholds.shadowMinRatio && ratio >= this.thresholds.heldOutMinRatio) {
        return {
          promote: true,
          rollback: false,
          targetState: "active",
          reasoning: `Shadow-run score ${check.shadowRunScore?.toFixed(2) ?? "N/A"} is ${(shadowRatio * 100).toFixed(1)}% of incumbent. Promoting to active.`,
        };
      }
      return {
        promote: false,
        rollback: false,
        targetState: "shadow",
        reasoning: `Shadow performance not yet sufficient for promotion.`,
      };
    }

    // Already active — maintain
    return {
      promote: false,
      rollback: false,
      targetState: check.currentState,
      reasoning: "No state change needed.",
    };
  }
}
