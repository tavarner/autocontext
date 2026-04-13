import { describe, expect, it } from "vitest";

import {
  buildCodegenFailureMaterializationResult,
  buildCodegenValidationErrors,
  buildInvalidCodegenMaterializationResult,
  buildSuccessfulCodegenMaterializationResult,
} from "../src/scenarios/materialize-codegen-planning.js";

describe("materialize codegen planning", () => {
  it("formats codegen validation errors for materialization results", () => {
    expect(buildCodegenValidationErrors(["missing method", "bad export"])).toEqual([
      "codegen validation: missing method",
      "codegen validation: bad export",
    ]);
  });

  it("builds successful and invalid codegen materialization results", () => {
    const persistedSpec = {
      name: "sim_one",
      family: "simulation",
      scenario_type: "simulation",
    };

    expect(
      buildSuccessfulCodegenMaterializationResult({
        persistedSpec,
        source: "module.exports = { scenario: {} }",
      }),
    ).toMatchObject({
      persistedSpec,
      source: "module.exports = { scenario: {} }",
      generatedSource: true,
      errors: [],
    });

    expect(
      buildInvalidCodegenMaterializationResult({
        persistedSpec,
        source: "module.exports = { scenario: {} }",
        errors: ["missing method"],
      }),
    ).toMatchObject({
      persistedSpec,
      source: "module.exports = { scenario: {} }",
      generatedSource: false,
      errors: ["codegen validation: missing method"],
    });
  });

  it("builds codegen failure results from thrown errors", () => {
    expect(
      buildCodegenFailureMaterializationResult({
        persistedSpec: { name: "sim_one" },
        error: new Error("boom"),
      }),
    ).toMatchObject({
      persistedSpec: { name: "sim_one" },
      source: null,
      generatedSource: false,
      errors: ["codegen failed: boom"],
    });
  });
});
