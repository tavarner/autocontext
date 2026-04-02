/**
 * Skill manifest parsing and registry (AC-509 TS parity).
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, basename } from "node:path";

const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*\n/;

function parseFrontmatter(text: string): Record<string, string> {
  const match = text.match(FRONTMATTER_RE);
  if (!match) return {};
  const result: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx > 0) result[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return result;
}

function bodyAfterFrontmatter(text: string): string {
  const match = text.match(FRONTMATTER_RE);
  return match ? text.slice(match[0].length).trim() : text.trim();
}

export class SkillManifest {
  readonly name: string;
  readonly description: string;
  readonly skillPath: string;

  constructor(name: string, description: string, skillPath: string) {
    this.name = name;
    this.description = description;
    this.skillPath = skillPath;
  }

  static fromSkillDir(dir: string): SkillManifest | null {
    const mdPath = join(dir, "SKILL.md");
    if (!existsSync(mdPath)) return null;
    const text = readFileSync(mdPath, "utf-8");
    const fm = parseFrontmatter(text);
    return new SkillManifest(fm.name ?? basename(dir), fm.description ?? "", dir);
  }
}

export class SkillEntry {
  readonly manifest: SkillManifest;
  private body: string | null = null;

  constructor(manifest: SkillManifest) {
    this.manifest = manifest;
  }

  get isLoaded(): boolean { return this.body !== null; }

  loadBody(): string {
    if (this.body !== null) return this.body;
    const mdPath = join(this.manifest.skillPath, "SKILL.md");
    if (!existsSync(mdPath)) { this.body = ""; return ""; }
    this.body = bodyAfterFrontmatter(readFileSync(mdPath, "utf-8"));
    return this.body;
  }
}

export class SkillRegistry {
  private entries = new Map<string, SkillEntry>();

  discover(root: string): number {
    if (!existsSync(root) || !statSync(root).isDirectory()) return 0;
    let added = 0;
    for (const name of readdirSync(root).sort()) {
      const child = join(root, name);
      if (!statSync(child).isDirectory()) continue;
      const manifest = SkillManifest.fromSkillDir(child);
      if (!manifest) continue;
      if (!this.entries.has(manifest.name)) {
        this.entries.set(manifest.name, new SkillEntry(manifest));
        added++;
      }
    }
    return added;
  }

  allManifests(): SkillManifest[] {
    return [...this.entries.values()].map((e) => e.manifest);
  }

  get(name: string): SkillEntry | undefined {
    return this.entries.get(name);
  }

  search(query: string): SkillManifest[] {
    const q = query.toLowerCase();
    return this.allManifests().filter((m) => m.name.toLowerCase().includes(q) || m.description.toLowerCase().includes(q));
  }
}
