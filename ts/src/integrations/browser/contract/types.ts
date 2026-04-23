import type {
  BrowserAction as BrowserActionShape,
  BrowserAuditEvent as BrowserAuditEventShape,
  BrowserSessionConfig as BrowserSessionConfigShape,
  BrowserSnapshot as BrowserSnapshotShape,
} from "./generated-types.js";

export type BrowserContractSchemaVersion = "1.0";
export const BROWSER_CONTRACT_SCHEMA_VERSION: BrowserContractSchemaVersion = "1.0";

export type BrowserSessionConfig = BrowserSessionConfigShape;
export type BrowserAction = BrowserActionShape;
export type BrowserSnapshot = BrowserSnapshotShape;
export type BrowserAuditEvent = BrowserAuditEventShape;

export type BrowserProfileMode = BrowserSessionConfig["profileMode"];
export type BrowserPolicyReason = BrowserAuditEvent["policyReason"];
export type BrowserSnapshotRef = BrowserSnapshot["refs"][number];
export type BrowserActionType = BrowserAction["type"];
export type BrowserFieldKind = Extract<BrowserAction, { type: "fill" }>["params"]["fieldKind"];

export type BrowserValidationResult =
  | { readonly valid: true }
  | { readonly valid: false; readonly errors: readonly string[] };

export type BrowserPolicyDecision = {
  readonly allowed: boolean;
  readonly reason: BrowserPolicyReason;
  readonly matchedDomain?: string;
};
