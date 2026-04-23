import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AppSettingsSchema, loadSettings } from "../src/config/index.js";
import { resolveBrowserSessionConfig } from "../src/integrations/browser/policy.js";

describe("browser settings", () => {
  it("defaults to a secure disabled posture", () => {
    const settings = AppSettingsSchema.parse({});

    expect(settings.browserEnabled).toBe(false);
    expect(settings.browserBackend).toBe("chrome-cdp");
    expect(settings.browserProfileMode).toBe("ephemeral");
    expect(settings.browserAllowedDomains).toBe("");
    expect(settings.browserAllowAuth).toBe(false);
    expect(settings.browserAllowUploads).toBe(false);
    expect(settings.browserAllowDownloads).toBe(false);
    expect(settings.browserCaptureScreenshots).toBe(true);
    expect(settings.browserHeadless).toBe(true);
    expect(settings.browserDebuggerUrl).toBe("http://127.0.0.1:9222");
    expect(settings.browserPreferredTargetUrl).toBe("");
  });

  it("normalizes browser config from AUTOCONTEXT_* settings", () => {
    const config = resolveBrowserSessionConfig(AppSettingsSchema.parse({
      browserAllowedDomains: " Example.com ,*.Example.org,example.com ",
      browserAllowDownloads: true,
      browserDownloadsRoot: "/tmp/downloads",
    }));

    expect(config.allowedDomains).toEqual(["example.com", "*.example.org"]);
    expect(config.allowDownloads).toBe(true);
    expect(config.downloadsRoot).toBe("/tmp/downloads");
  });
});

describe("loadSettings browser env vars", () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("AUTOCONTEXT_")) {
        delete process.env[key];
      }
    }
  });

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it("reads the browser settings from environment variables", () => {
    process.env.AUTOCONTEXT_BROWSER_ENABLED = "true";
    process.env.AUTOCONTEXT_BROWSER_ALLOWED_DOMAINS = "example.com,*.example.org";
    process.env.AUTOCONTEXT_BROWSER_ALLOW_DOWNLOADS = "true";
    process.env.AUTOCONTEXT_BROWSER_DOWNLOADS_ROOT = "/tmp/downloads";
    process.env.AUTOCONTEXT_BROWSER_DEBUGGER_URL = "http://127.0.0.1:9333";
    process.env.AUTOCONTEXT_BROWSER_PREFERRED_TARGET_URL = "https://example.com/dashboard";

    const settings = loadSettings();

    expect(settings.browserEnabled).toBe(true);
    expect(settings.browserAllowedDomains).toBe("example.com,*.example.org");
    expect(settings.browserAllowDownloads).toBe(true);
    expect(settings.browserDownloadsRoot).toBe("/tmp/downloads");
    expect(settings.browserDebuggerUrl).toBe("http://127.0.0.1:9333");
    expect(settings.browserPreferredTargetUrl).toBe("https://example.com/dashboard");
  });
});
