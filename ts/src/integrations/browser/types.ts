import type {
  BrowserAuditEvent,
  BrowserFieldKind,
  BrowserSessionConfig,
  BrowserSnapshot,
} from "./contract/index.js";

export type {
  BrowserAction,
  BrowserActionType,
  BrowserAuditEvent,
  BrowserContractSchemaVersion,
  BrowserFieldKind,
  BrowserPolicyDecision,
  BrowserPolicyReason,
  BrowserProfileMode,
  BrowserSessionConfig,
  BrowserSnapshot,
  BrowserSnapshotRef,
  BrowserValidationResult,
} from "./contract/index.js";

export interface BrowserSessionPort {
  readonly config: BrowserSessionConfig;
  navigate(url: string): Promise<BrowserAuditEvent>;
  snapshot(): Promise<BrowserSnapshot>;
  click(ref: string): Promise<BrowserAuditEvent>;
  fill(ref: string, text: string, opts?: { fieldKind?: BrowserFieldKind }): Promise<BrowserAuditEvent>;
  press(key: string): Promise<BrowserAuditEvent>;
  screenshot(name: string): Promise<BrowserAuditEvent>;
  close(): Promise<void>;
}

export interface BrowserRuntimePort {
  createSession(config: BrowserSessionConfig): Promise<BrowserSessionPort>;
}

export interface BrowserSettingsLike {
  readonly browserProfileMode: BrowserSessionConfig["profileMode"];
  readonly browserAllowedDomains: string;
  readonly browserAllowAuth: boolean;
  readonly browserAllowUploads: boolean;
  readonly browserAllowDownloads: boolean;
  readonly browserCaptureScreenshots: boolean;
  readonly browserHeadless: boolean;
  readonly browserDebuggerUrl: string;
  readonly browserPreferredTargetUrl: string;
  readonly browserDownloadsRoot: string;
  readonly browserUploadsRoot: string;
}
