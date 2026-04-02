/**
 * Opt-in living docs maintenance (AC-511 TS parity).
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const OPT_IN_MARKER = "<!-- living-doc: true -->";

export class LivingDoc {
  readonly path: string;
  readonly isOptedIn = true;
  consultationCount = 0;

  private constructor(path: string) { this.path = path; }

  static fromPath(path: string): LivingDoc | null {
    if (!existsSync(path)) return null;
    const content = readFileSync(path, "utf-8");
    if (!content.includes(OPT_IN_MARKER)) return null;
    return new LivingDoc(path);
  }

  recordConsultation(): void { this.consultationCount++; }
}

export interface DocUpdateResult {
  docsChecked: number;
  updates: Array<{ docPath: string; summary: string }>;
  skipped: boolean;
  reason: string;
}

export class DocMaintainer {
  private roots: string[];
  private enabled: boolean;

  constructor(opts: { roots: string[]; enabled?: boolean }) {
    this.roots = opts.roots;
    this.enabled = opts.enabled ?? true;
  }

  discover(): LivingDoc[] {
    const docs: LivingDoc[] = [];
    for (const root of this.roots) {
      if (!existsSync(root) || !statSync(root).isDirectory()) continue;
      this.walkDir(root, docs);
    }
    return docs;
  }

  run(learnings: string[]): DocUpdateResult {
    if (!this.enabled) return { docsChecked: 0, updates: [], skipped: true, reason: "disabled" };
    if (!learnings.length) return { docsChecked: 0, updates: [], skipped: true, reason: "No learnings" };
    const docs = this.discover();
    if (!docs.length) return { docsChecked: 0, updates: [], skipped: true, reason: "No opted-in docs" };
    const updates = docs.filter(() => learnings.some((l) => l.trim().length > 10))
      .map((d) => ({ docPath: d.path, summary: `Candidate: ${learnings.length} learning(s)` }));
    return { docsChecked: docs.length, updates, skipped: false, reason: "" };
  }

  private walkDir(dir: string, docs: LivingDoc[]): void {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) this.walkDir(full, docs);
      else if (full.endsWith(".md")) {
        const doc = LivingDoc.fromPath(full);
        if (doc) docs.push(doc);
      }
    }
  }
}
