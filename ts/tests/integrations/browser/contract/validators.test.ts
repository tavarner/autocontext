import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

import {
  validateBrowserAction,
  validateBrowserAuditEvent,
  validateBrowserSessionConfig,
  validateBrowserSnapshot,
} from "../../../../src/integrations/browser/contract/validators.js";

const FIXTURES_DIR = resolve(__dirname, "..", "fixtures");

function validatorForFixture(file: string) {
  if (file.includes("-session-config-")) return validateBrowserSessionConfig;
  if (file.includes("-action-")) return validateBrowserAction;
  if (file.includes("-snapshot-")) return validateBrowserSnapshot;
  if (file.includes("-audit-event-")) return validateBrowserAuditEvent;
  throw new Error(`unrecognized fixture file: ${file}`);
}

describe("browser contract fixtures", () => {
  const fixtureFiles = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith(".json")).sort();

  test("non-empty fixture set", () => {
    expect(fixtureFiles.length).toBeGreaterThanOrEqual(10);
  });

  for (const file of fixtureFiles) {
    const isInvalid = file.startsWith("invalid-");
    test(`${file}: validator ${isInvalid ? "rejects" : "accepts"}`, () => {
      const body = readFileSync(resolve(FIXTURES_DIR, file), "utf-8");
      const data: unknown = JSON.parse(body);
      const result = validatorForFixture(file)(data);

      expect(result.valid).toBe(!isInvalid);
    });
  }
});
