import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const scenariosDir = join(import.meta.dirname, "..", "src", "scenarios");
const removedWrapperFiles = [
  "materialize-scenario-request-handoff.ts",
  "materialize-scenario-execution-delegation.ts",
  "materialize-scenario-execution-delegation-input.ts",
  "materialize-scenario-execution-delegation-composition.ts",
  "materialize-scenario-execution-delegation-orchestration.ts",
  "materialize-scenario-execution-delegation-finalization.ts",
  "materialize-scenario-execution-delegation-finalization-assembly.ts",
  "materialize-scenario-execution-delegation-finalization-composition.ts",
  "materialize-scenario-execution-delegation-finalization-result-assembly.ts",
  "materialize-scenario-execution-delegation-finalization-result-composition.ts",
  "materialize-scenario-execution-delegation-finalization-result-builder.ts",
  "materialize-workflow-dependency-resolution.ts",
  "materialize-workflow-request-public-helper.ts",
  "materialize-workflow-request-assembly.ts",
];

describe("materialize compatibility cleanup", () => {
  it("routes orchestration through substantive owners instead of wrapper modules", () => {
    const requestHandoffDelegationSource = readFileSync(
      join(scenariosDir, "materialize-scenario-request-handoff-delegation.ts"),
      "utf-8",
    );
    const workflowRequestAssemblySource = readFileSync(
      join(scenariosDir, "materialize-scenario-request-assembly.ts"),
      "utf-8",
    );
    const workflowRequestCompositionSource = readFileSync(
      join(scenariosDir, "materialize-workflow-request-composition.ts"),
      "utf-8",
    );

    expect(requestHandoffDelegationSource).not.toContain(
      "./materialize-scenario-execution-delegation-input.js",
    );
    expect(requestHandoffDelegationSource).not.toContain(
      "./materialize-scenario-execution-delegation.js",
    );
    expect(workflowRequestAssemblySource).not.toContain(
      "./materialize-workflow-request-public-helper.js",
    );
    expect(workflowRequestAssemblySource).not.toContain(
      "./materialize-workflow-request-assembly.js",
    );
    expect(workflowRequestCompositionSource).not.toContain(
      "./materialize-workflow-dependency-resolution.js",
    );
  });

  it("does not retain the collapsed wrapper-only materialize modules", () => {
    for (const wrapperFile of removedWrapperFiles) {
      expect(existsSync(join(scenariosDir, wrapperFile))).toBe(false);
    }
  });
});
