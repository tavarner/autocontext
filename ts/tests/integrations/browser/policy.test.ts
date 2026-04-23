import { describe, expect, it } from "vitest";

import {
  buildDefaultBrowserSessionConfig,
  evaluateBrowserActionPolicy,
} from "../../../src/integrations/browser/policy.js";

describe("browser action policy", () => {
  it("blocks navigation outside the allowlist", () => {
    const config = buildDefaultBrowserSessionConfig({
      allowedDomains: ["example.com"],
    });

    const decision = evaluateBrowserActionPolicy(config, {
      schemaVersion: "1.0",
      actionId: "act_nav_1",
      sessionId: "session_1",
      timestamp: "2026-04-22T12:00:00Z",
      type: "navigate",
      params: { url: "https://blocked.example.net/dashboard" },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("domain_not_allowed");
  });

  it("allows exact and wildcard domains", () => {
    const config = buildDefaultBrowserSessionConfig({
      allowedDomains: ["example.com", "*.example.org"],
    });

    expect(evaluateBrowserActionPolicy(config, {
      schemaVersion: "1.0",
      actionId: "act_nav_exact",
      sessionId: "session_1",
      timestamp: "2026-04-22T12:00:00Z",
      type: "navigate",
      params: { url: "https://example.com/path" },
    }).allowed).toBe(true);

    expect(evaluateBrowserActionPolicy(config, {
      schemaVersion: "1.0",
      actionId: "act_nav_wild",
      sessionId: "session_1",
      timestamp: "2026-04-22T12:00:01Z",
      type: "navigate",
      params: { url: "https://app.example.org/path" },
    }).allowed).toBe(true);
  });

  it("blocks password fills unless auth is enabled", () => {
    const config = buildDefaultBrowserSessionConfig();

    const decision = evaluateBrowserActionPolicy(config, {
      schemaVersion: "1.0",
      actionId: "act_fill_pw",
      sessionId: "session_1",
      timestamp: "2026-04-22T12:00:00Z",
      type: "fill",
      params: {
        ref: "@e1",
        text: "super-secret",
        fieldKind: "password",
      },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("auth_blocked");
  });
});
