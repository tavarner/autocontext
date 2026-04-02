import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SkillManifest, SkillEntry, SkillRegistry } from "../src/session/skill-registry.js";

function writeSkill(root: string, name: string, description = "A skill"): string {
  const dir = join(root, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "SKILL.md"), `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n\nInstructions.\n`);
  return dir;
}

describe("SkillManifest", () => {
  it("parses from SKILL.md", () => {
    const root = mkdtempSync(join(tmpdir(), "skill-"));
    writeSkill(root, "my-skill", "Does useful things");
    const m = SkillManifest.fromSkillDir(join(root, "my-skill"));
    expect(m).not.toBeNull();
    expect(m!.name).toBe("my-skill");
    expect(m!.description).toBe("Does useful things");
  });

  it("returns null for missing SKILL.md", () => {
    const root = mkdtempSync(join(tmpdir(), "skill-"));
    mkdirSync(join(root, "empty"), { recursive: true });
    expect(SkillManifest.fromSkillDir(join(root, "empty"))).toBeNull();
  });

  it("normalizes quoted frontmatter values", () => {
    const root = mkdtempSync(join(tmpdir(), "skill-"));
    const dir = join(root, "quoted");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "SKILL.md"),
      "---\nname: \"gh-fix-ci\"\ndescription: \"Fix CI\"\n---\n\n# quoted\n\nInstructions.\n",
    );

    const manifest = SkillManifest.fromSkillDir(dir);
    expect(manifest?.name).toBe("gh-fix-ci");
    expect(manifest?.description).toBe("Fix CI");
  });
});

describe("SkillEntry", () => {
  it("lazy loads body", () => {
    const root = mkdtempSync(join(tmpdir(), "skill-"));
    writeSkill(root, "lazy-skill");
    const m = SkillManifest.fromSkillDir(join(root, "lazy-skill"))!;
    const entry = new SkillEntry(m);
    expect(entry.isLoaded).toBe(false);
    const body = entry.loadBody();
    expect(body).toContain("Instructions");
    expect(entry.isLoaded).toBe(true);
  });
});

describe("SkillRegistry", () => {
  it("discovers skills from root", () => {
    const root = mkdtempSync(join(tmpdir(), "skill-"));
    writeSkill(root, "skill-a");
    writeSkill(root, "skill-b");
    const reg = new SkillRegistry();
    reg.discover(root);
    expect(reg.allManifests()).toHaveLength(2);
  });

  it("deduplicates by name", () => {
    const root1 = mkdtempSync(join(tmpdir(), "skill-"));
    const root2 = mkdtempSync(join(tmpdir(), "skill-"));
    writeSkill(root1, "shared");
    writeSkill(root2, "shared");
    const reg = new SkillRegistry();
    reg.discover(root1);
    reg.discover(root2);
    expect(reg.allManifests()).toHaveLength(1);
  });

  it("searches by keyword", () => {
    const root = mkdtempSync(join(tmpdir(), "skill-"));
    writeSkill(root, "auth-skill", "Authentication and OAuth");
    writeSkill(root, "db-skill", "Database design");
    const reg = new SkillRegistry();
    reg.discover(root);
    expect(reg.search("auth")).toHaveLength(1);
  });
});
