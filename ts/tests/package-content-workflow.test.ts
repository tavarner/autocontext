import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  extractMarkedSection,
  harnessForScenario,
  hintsFromPlaybook,
  lessonsFromPlaybook,
} from "../src/knowledge/package-content.js";
import { HarnessStore } from "../src/knowledge/harness-store.js";
import { PLAYBOOK_MARKERS } from "../src/knowledge/playbook.js";

describe("package content workflow", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ac-package-content-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("extracts lessons and hints from marked playbook sections", () => {
    const playbook = [
      PLAYBOOK_MARKERS.LESSONS_START,
      "- Preserve the high ground.",
      PLAYBOOK_MARKERS.LESSONS_END,
      PLAYBOOK_MARKERS.HINTS_START,
      "- Avoid overcommitting.",
      PLAYBOOK_MARKERS.HINTS_END,
    ].join("\n");

    expect(extractMarkedSection(playbook, PLAYBOOK_MARKERS.HINTS_START, PLAYBOOK_MARKERS.HINTS_END)).toContain("Avoid overcommitting");
    expect(lessonsFromPlaybook(playbook)).toEqual(["Preserve the high ground."]);
    expect(hintsFromPlaybook(playbook)).toContain("Avoid overcommitting.");
  });

  it("collects saved harness sources for a scenario", () => {
    const store = new HarnessStore(dir, "grid_ctf");
    store.writeVersioned("validator", "def validate():\n    return True\n", 1);

    expect(harnessForScenario(dir, "grid_ctf")).toMatchObject({
      validator: expect.stringContaining("def validate()"),
    });
  });
});
