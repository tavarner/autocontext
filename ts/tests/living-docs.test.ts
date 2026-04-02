import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { LivingDoc, DocMaintainer } from "../src/session/living-docs.js";

function writeDoc(root: string, name: string, optedIn = true, content = "Initial."): string {
  const dir = join(root, name.includes("/") ? name.split("/").slice(0, -1).join("/") : "");
  mkdirSync(dir, { recursive: true });
  const marker = optedIn ? "<!-- living-doc: true -->\n" : "";
  writeFileSync(join(root, name), `${marker}# ${name}\n\n${content}\n`);
  return join(root, name);
}

describe("LivingDoc", () => {
  it("detects opted-in doc", () => {
    const root = mkdtempSync(join(tmpdir(), "docs-"));
    writeDoc(root, "ARCH.md", true);
    const doc = LivingDoc.fromPath(join(root, "ARCH.md"));
    expect(doc).not.toBeNull();
    expect(doc!.isOptedIn).toBe(true);
  });

  it("skips non-opted-in", () => {
    const root = mkdtempSync(join(tmpdir(), "docs-"));
    writeDoc(root, "README.md", false);
    expect(LivingDoc.fromPath(join(root, "README.md"))).toBeNull();
  });
});

describe("DocMaintainer", () => {
  it("discovers opted-in docs", () => {
    const root = mkdtempSync(join(tmpdir(), "docs-"));
    writeDoc(root, "ARCH.md", true);
    writeDoc(root, "README.md", false);
    const m = new DocMaintainer({ roots: [root] });
    expect(m.discover()).toHaveLength(1);
  });

  it("skips when disabled", () => {
    const root = mkdtempSync(join(tmpdir(), "docs-"));
    writeDoc(root, "ARCH.md", true);
    const m = new DocMaintainer({ roots: [root], enabled: false });
    const r = m.run(["new finding"]);
    expect(r.skipped).toBe(true);
  });

  it("skips when no learnings", () => {
    const root = mkdtempSync(join(tmpdir(), "docs-"));
    writeDoc(root, "ARCH.md", true);
    const m = new DocMaintainer({ roots: [root] });
    const r = m.run([]);
    expect(r.skipped).toBe(true);
  });
});
