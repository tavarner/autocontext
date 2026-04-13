import { describe, expect, it } from "vitest";

describe("new-scenario template-rendering public helper", () => {
  it("re-exports the public template-rendering surface", async () => {
    const mod = await import("../src/cli/new-scenario-template-rendering-public-helper.js");

    expect(mod.renderTemplateList).toBeDefined();
    expect(mod.renderTemplateScaffoldResult).toBeDefined();
  });
});
