/**
 * Background memory consolidation (AC-516 TS parity).
 */

export class ConsolidationTrigger {
  readonly minCompletedTurns: number;
  readonly minCompletedSessions: number;

  constructor(opts?: { minCompletedTurns?: number; minCompletedSessions?: number }) {
    this.minCompletedTurns = opts?.minCompletedTurns ?? 10;
    this.minCompletedSessions = opts?.minCompletedSessions ?? 1;
    this.validateMinimums();
  }

  shouldRun(opts: { completedTurns: number; completedSessions: number; force?: boolean }): boolean {
    if (opts.force) return true;
    return opts.completedTurns >= this.minCompletedTurns || opts.completedSessions >= this.minCompletedSessions;
  }

  private validateMinimums(): void {
    if (this.minCompletedTurns < 0) {
      throw new Error("minCompletedTurns must be >= 0");
    }
    if (this.minCompletedSessions < 0) {
      throw new Error("minCompletedSessions must be >= 0");
    }
  }
}

export class ConsolidationResult {
  readonly promotedLessons: string[];
  readonly promotedHints: string[];
  readonly skippedReason: string;
  readonly dryRun: boolean;

  constructor(opts?: {
    promotedLessons?: string[];
    promotedHints?: string[];
    skippedReason?: string;
    dryRun?: boolean;
  }) {
    this.promotedLessons = opts?.promotedLessons ?? [];
    this.promotedHints = opts?.promotedHints ?? [];
    this.skippedReason = opts?.skippedReason ?? "";
    this.dryRun = opts?.dryRun ?? false;
  }

  get totalPromoted(): number {
    return this.promotedLessons.length + this.promotedHints.length;
  }

  get wasProductive(): boolean {
    return this.totalPromoted > 0;
  }
}

export class MemoryConsolidator {
  private trigger: ConsolidationTrigger;

  constructor(trigger?: ConsolidationTrigger) {
    this.trigger = trigger ?? new ConsolidationTrigger();
  }

  run(opts: {
    completedTurns: number;
    completedSessions: number;
    artifacts: Record<string, unknown>;
    force?: boolean;
    dryRun?: boolean;
  }): ConsolidationResult {
    if (!this.trigger.shouldRun({ completedTurns: opts.completedTurns, completedSessions: opts.completedSessions, force: opts.force })) {
      return new ConsolidationResult({ skippedReason: "threshold not met" });
    }

    const lessons: string[] = [];
    const reports = opts.artifacts.session_reports;
    if (Array.isArray(reports)) {
      for (const r of reports) {
        if (typeof r === "string" && r.trim().length > 20) lessons.push(r.trim().slice(0, 200));
      }
    }

    return new ConsolidationResult({ promotedLessons: lessons, dryRun: opts.dryRun });
  }
}
