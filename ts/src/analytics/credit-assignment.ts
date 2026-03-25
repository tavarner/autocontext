/**
 * Component sensitivity profiling and credit assignment.
 *
 * TS port of autocontext.analytics.credit_assignment (AC-381).
 */

export class CreditAssigner {
  private contributions: Map<string, number[]> = new Map();

  recordContribution(component: string, scoreDelta: number): void {
    const existing = this.contributions.get(component) ?? [];
    existing.push(scoreDelta);
    this.contributions.set(component, existing);
  }

  getCredits(): Record<string, number> {
    const credits: Record<string, number> = {};
    for (const [component, deltas] of this.contributions) {
      credits[component] = deltas.reduce((a, b) => a + b, 0);
    }
    return credits;
  }
}
