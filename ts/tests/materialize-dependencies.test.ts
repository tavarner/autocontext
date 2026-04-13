import { describe, expect, it, vi } from "vitest";

import {
  resolveMaterializeScenarioDependencies,
} from "../src/scenarios/materialize-dependencies.js";

describe("materialize dependencies", () => {
  it("resolves materialize dependencies with override precedence", () => {
    const override = vi.fn();
    const resolved = resolveMaterializeScenarioDependencies({
      healSpec: override as any,
    });

    expect(resolved.healSpec).toBe(override);
    expect(typeof resolved.planMaterializedScenarioFamily).toBe("function");
    expect(typeof resolved.persistMaterializedScenarioArtifacts).toBe("function");
    expect(typeof resolved.buildSuccessfulMaterializeResult).toBe("function");
  });
});
