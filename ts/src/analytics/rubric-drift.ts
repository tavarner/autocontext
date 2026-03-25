/**
 * Rubric-drift monitoring for score inflation and stability detection.
 *
 * TS port of autocontext.analytics.rubric_drift (AC-381).
 */

export interface DriftWarning {
  type: string;
  severity: string;
  description: string;
  metricValue: number;
  thresholdValue: number;
}

export interface DriftReport {
  warnings: DriftWarning[];
  stable: boolean;
  meanScore: number;
  scoreCount: number;
}

const PERFECT_THRESHOLD = 0.95;
const INFLATION_THRESHOLD = 0.15;
const PERFECT_RATE_THRESHOLD = 0.5;

export class RubricDriftMonitor {
  private scores: number[] = [];

  recordScore(score: number): void {
    this.scores.push(score);
  }

  analyze(): DriftReport {
    const warnings: DriftWarning[] = [];
    const n = this.scores.length;

    if (n === 0) {
      return { warnings, stable: true, meanScore: 0, scoreCount: 0 };
    }

    const mean = this.scores.reduce((a, b) => a + b, 0) / n;

    // Score inflation: compare first-half mean to second-half mean
    const mid = Math.floor(n / 2);
    if (mid > 0) {
      const firstHalf = this.scores.slice(0, mid);
      const secondHalf = this.scores.slice(mid);
      const firstMean = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondMean = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      const inflation = secondMean - firstMean;

      if (inflation > INFLATION_THRESHOLD) {
        warnings.push({
          type: "score_inflation",
          severity: "high",
          description: `Score inflation rate ${inflation.toFixed(2)} exceeds threshold ${INFLATION_THRESHOLD}`,
          metricValue: inflation,
          thresholdValue: INFLATION_THRESHOLD,
        });
      }
    }

    // Near-perfect rate
    const perfectCount = this.scores.filter((s) => s >= PERFECT_THRESHOLD).length;
    const perfectRate = perfectCount / n;
    if (perfectRate > PERFECT_RATE_THRESHOLD) {
      warnings.push({
        type: "near_perfect_rate",
        severity: "high",
        description: `Near-perfect score rate ${(perfectRate * 100).toFixed(0)}% exceeds threshold ${(PERFECT_RATE_THRESHOLD * 100).toFixed(0)}%`,
        metricValue: perfectRate,
        thresholdValue: PERFECT_RATE_THRESHOLD,
      });
    }

    return {
      warnings,
      stable: warnings.length === 0,
      meanScore: mean,
      scoreCount: n,
    };
  }
}
