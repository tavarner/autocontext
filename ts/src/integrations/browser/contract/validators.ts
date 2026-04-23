import Ajv2020 from "ajv/dist/2020.js";
import type { ErrorObject, ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import browserActionSchema from "./json-schemas/browser-action.schema.json" with { type: "json" };
import browserAuditEventSchema from "./json-schemas/browser-audit-event.schema.json" with { type: "json" };
import browserContractSchema from "./json-schemas/browser-contract.schema.json" with { type: "json" };
import browserSessionConfigSchema from "./json-schemas/browser-session-config.schema.json" with { type: "json" };
import browserSnapshotSchema from "./json-schemas/browser-snapshot.schema.json" with { type: "json" };
import sharedDefsSchema from "./json-schemas/shared-defs.schema.json" with { type: "json" };
import type {
  BrowserAction,
  BrowserAuditEvent,
  BrowserSessionConfig,
  BrowserSnapshot,
  BrowserValidationResult,
} from "./types.js";

const AjvCtor = (Ajv2020 as unknown as { default: typeof Ajv2020 }).default ?? Ajv2020;
const addFormatsFn = (addFormats as unknown as { default: typeof addFormats }).default ?? addFormats;

const ajv = new AjvCtor({ strict: true, allErrors: true });
addFormatsFn(ajv);

ajv.addSchema(sharedDefsSchema as object);
ajv.addSchema(browserSessionConfigSchema as object);
ajv.addSchema(browserActionSchema as object);
ajv.addSchema(browserSnapshotSchema as object);
ajv.addSchema(browserAuditEventSchema as object);
ajv.addSchema(browserContractSchema as object);

const browserSessionConfigValidator = ajv.getSchema("https://autocontext.dev/schema/browser/browser-session-config.json")!;
const browserActionValidator = ajv.getSchema("https://autocontext.dev/schema/browser/browser-action.json")!;
const browserSnapshotValidator = ajv.getSchema("https://autocontext.dev/schema/browser/browser-snapshot.json")!;
const browserAuditEventValidator = ajv.getSchema("https://autocontext.dev/schema/browser/browser-audit-event.json")!;

function toResult(validate: ValidateFunction, input: unknown): BrowserValidationResult {
  const ok = validate(input);
  if (ok) {
    return { valid: true };
  }
  return {
    valid: false,
    errors: (validate.errors ?? []).map(formatError),
  };
}

function formatError(error: ErrorObject): string {
  const path = error.instancePath || "<root>";
  return `${path} ${error.message ?? "invalid"}`.trim();
}

export function validateBrowserSessionConfig(input: unknown): BrowserValidationResult {
  return toResult(browserSessionConfigValidator, input);
}

export function validateBrowserAction(input: unknown): BrowserValidationResult {
  return toResult(browserActionValidator, input);
}

export function validateBrowserSnapshot(input: unknown): BrowserValidationResult {
  return toResult(browserSnapshotValidator, input);
}

export function validateBrowserAuditEvent(input: unknown): BrowserValidationResult {
  return toResult(browserAuditEventValidator, input);
}

export type _TypeCheck =
  | BrowserSessionConfig
  | BrowserAction
  | BrowserSnapshot
  | BrowserAuditEvent;
