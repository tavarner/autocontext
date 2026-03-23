/**
 * Agent task CRUD store — file-based task spec persistence (AC-370).
 * Mirrors Python's agent task creation/listing/deletion.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface AgentTaskSpec {
  name: string;
  taskPrompt: string;
  rubric: string;
  referenceContext?: string;
  requiredConcepts?: string[];
}

export class AgentTaskStore {
  private dir: string;

  constructor(dir: string) {
    this.dir = dir;
    mkdirSync(dir, { recursive: true });
  }

  create(spec: AgentTaskSpec): void {
    const path = join(this.dir, `${spec.name}.json`);
    writeFileSync(path, JSON.stringify(spec, null, 2), "utf-8");
  }

  list(): AgentTaskSpec[] {
    if (!existsSync(this.dir)) return [];
    return readdirSync(this.dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        try {
          return JSON.parse(readFileSync(join(this.dir, f), "utf-8")) as AgentTaskSpec;
        } catch {
          return null;
        }
      })
      .filter((s): s is AgentTaskSpec => s !== null);
  }

  get(name: string): AgentTaskSpec | null {
    const path = join(this.dir, `${name}.json`);
    if (!existsSync(path)) return null;
    try {
      return JSON.parse(readFileSync(path, "utf-8")) as AgentTaskSpec;
    } catch {
      return null;
    }
  }

  delete(name: string): boolean {
    const path = join(this.dir, `${name}.json`);
    if (!existsSync(path)) return false;
    rmSync(path);
    return true;
  }
}
