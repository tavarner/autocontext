import { describe, expect, it } from "vitest";

import { generateSchemaEvolutionSource } from "../src/scenarios/codegen/schema-evolution-codegen.js";
import { SCHEMA_EVOLUTION_SCENARIO_TEMPLATE } from "../src/scenarios/codegen/templates/schema-evolution-template.js";

describe("template-backed schema-evolution codegen", () => {
  it("exposes a reusable schema-evolution template", () => {
    expect(SCHEMA_EVOLUTION_SCENARIO_TEMPLATE).toContain("module.exports = { scenario }");
    expect(SCHEMA_EVOLUTION_SCENARIO_TEMPLATE).toContain("__SCENARIO_NAME__");
  });

  it("generates schema-evolution code with all placeholders resolved", () => {
    const source = generateSchemaEvolutionSource(
      {
        description: "Schema migration",
        environment_description: "Versioned datastore",
        initial_state_description: "Version 0 schema",
        success_criteria: ["latest schema handled"],
        failure_modes: ["stale schema not detected"],
        max_steps: 5,
        mutations: [
          { version: 1, description: "Add column", changes: { add: "new_field" } },
        ],
        actions: [
          { name: "migrate", description: "Run migration", parameters: {}, preconditions: [], effects: [] },
        ],
      },
      "schema_migration",
    );

    expect(source).toContain("schema_migration");
    expect(source).toContain("applyMutation");
    expect(source).not.toMatch(/__[A-Z0-9_]+__/);
    expect(() => new Function(source)).not.toThrow();
  });

  it("preserves placeholder-like schema-evolution text literally", () => {
    const source = generateSchemaEvolutionSource(
      {
        description: "__MAX_STEPS__ desc",
        environment_description: "Versioned datastore",
        initial_state_description: "__SCENARIO_NAME__ init",
        success_criteria: ["latest schema handled"],
        failure_modes: ["stale schema not detected"],
        max_steps: 7,
        mutations: [
          { version: 1, description: "__MUTATIONS__ description", changes: { add: "new_field" } },
        ],
        actions: [],
      },
      "schema_migration",
    );

    expect(source).toContain('return "__MAX_STEPS__ desc";');
    expect(source).toContain('initialStateDescription: "__SCENARIO_NAME__ init"');
    expect(source).toContain('"description": "__MUTATIONS__ description"');
    expect(() => new Function(source)).not.toThrow();
  });

  it("accepts placeholder-shaped schema-evolution text from the spec", () => {
    expect(() =>
      generateSchemaEvolutionSource(
        {
          description: "__SAFE_MODE__",
          environment_description: "Versioned datastore",
          initial_state_description: "Version 0 schema",
          success_criteria: ["latest schema handled"],
          failure_modes: ["__SAFE_MODE__"],
          max_steps: 7,
          mutations: [],
          actions: [],
        },
        "schema_migration",
      ),
    ).not.toThrow();
  });
});
