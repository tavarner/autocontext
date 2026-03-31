import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SRC_DIR = join(__dirname, "..", "src");

function countAssertions(dir: string): Map<string, number> {
  const counts = new Map<string, number>();

  function walk(d: string) {
    for (const entry of readdirSync(d)) {
      const full = join(d, entry);
      if (statSync(full).isDirectory()) {
        if (entry !== "node_modules") walk(full);
      } else if (full.endsWith(".ts") || full.endsWith(".tsx")) {
        const content = readFileSync(full, "utf-8");
        // Count " as X" but not " as const"
        const matches = content.match(/ as (?!const\b)\w/g);
        if (matches && matches.length > 0) {
          counts.set(relative(SRC_DIR, full), matches.length);
        }
      }
    }
  }

  walk(dir);
  return counts;
}

describe("TypeScript type assertion budget", () => {
  const counts = countAssertions(SRC_DIR);
  const total = Array.from(counts.values()).reduce((a, b) => a + b, 0);

  it("total assertions should be under budget", () => {
    // Budget: enforce no regression from current baseline
    expect(total).toBeLessThanOrEqual(520);
  });

  it("mission/store.ts should use row types instead of inline casts", () => {
    const missionStore = counts.get("mission/store.ts") ?? 0;
    // Was 45, reduced to 31 with row interfaces + mapper functions
    expect(missionStore).toBeLessThanOrEqual(35);
  });

  it("storage/index.ts should use row types consistently", () => {
    const storage = counts.get("storage/index.ts") ?? 0;
    // Already well-typed with Row interfaces
    expect(storage).toBeLessThanOrEqual(25);
  });
});
