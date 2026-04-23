/**
 * Cross-runtime parity property test for Anthropic — 50 runs.
 *
 * Verifies structural invariants that underpin the byte-identical cross-runtime
 * parity guarantee. Mirrors openai/parity/cross-runtime-parity.property.test.ts
 * with Anthropic-specific adaptations (providerUsage, responseContent, etc.).
 */
import { describe, test, expect } from "vitest";
import * as fc from "fast-check";
import { ulid } from "ulid";
import {
  buildSuccessTrace,
  buildFailureTrace,
  buildRequestSnapshot,
} from "../../../../src/integrations/anthropic/trace-builder.js";
import { hashUserId, hashSessionId } from "../../../../src/production-traces/sdk/hashing.js";

// ─── helpers mirrored from drive-anthropic-parity-fixture.mjs ────────────────

function normalizeTrace(trace: Record<string, unknown>): Record<string, unknown> {
  const t = { ...trace };
  t["traceId"] = "PARITY_TRACE_ID_NORMALIZED";
  t["timing"] = {
    startedAt: "2024-01-01T00:00:00Z",
    endedAt: "2024-01-01T00:00:01Z",
    latencyMs: 1000,
  };
  if (
    t["source"] &&
    typeof t["source"] === "object" &&
    (t["source"] as Record<string, unknown>)["sdk"]
  ) {
    t["source"] = {
      ...(t["source"] as Record<string, unknown>),
      sdk: { name: "autocontext-sdk", version: "0.0.0" },
    };
  }
  if (Array.isArray(t["messages"])) {
    t["messages"] = (t["messages"] as Array<Record<string, unknown>>).map((m) => ({
      ...m,
      timestamp: "2024-01-01T00:00:00Z",
    }));
  }
  if (
    t["outcome"] &&
    typeof t["outcome"] === "object" &&
    (t["outcome"] as Record<string, unknown>)["error"]
  ) {
    const o = t["outcome"] as Record<string, unknown>;
    const err = { ...(o["error"] as Record<string, unknown>) };
    if (err["stack"]) err["stack"] = "NORMALIZED";
    if (err["message"]) err["message"] = "NORMALIZED";
    if (err["type"]) err["type"] = "NORMALIZED";
    t["outcome"] = { ...o, error: err };
  }
  return t;
}

function canonicalJson(obj: unknown): string {
  if (Array.isArray(obj)) return "[" + obj.map(canonicalJson).join(",") + "]";
  if (obj === null) return "null";
  if (typeof obj !== "object") return JSON.stringify(obj);
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  return (
    "{" +
    keys
      .map((k) => JSON.stringify(k) + ":" + canonicalJson((obj as Record<string, unknown>)[k]))
      .join(",") +
    "}"
  );
}

const BASE_SOURCE = { emitter: "sdk", sdk: { name: "autocontext-ts", version: "0.0.0" } };
const FIXED_TIMING = { startedAt: "2024-01-01T00:00:00Z", endedAt: "2024-01-01T00:00:01Z", latencyMs: 1000 };

// ─── property tests ──────────────────────────────────────────────────────────

describe("cross-runtime parity (Anthropic, property, 50 runs)", () => {
  test("canonicalJson is idempotent and deterministic", () => {
    fc.assert(
      fc.property(fc.jsonValue(), (val) => {
        const first = canonicalJson(val);
        const second = canonicalJson(val);
        expect(first).toBe(second);
        expect(() => JSON.parse(first)).not.toThrow();
        const reparsed = JSON.parse(first);
        expect(canonicalJson(reparsed)).toBe(first);
        return true;
      }),
      { numRuns: 50 },
    );
  });

  test("normalizeTrace produces stable traceId, timing, and sdk fields", () => {
    fc.assert(
      fc.property(
        fc.record({
          model: fc.string({ minLength: 1, maxLength: 50 }),
          userContent: fc.string({ minLength: 0, maxLength: 200 }),
          tokensIn: fc.integer({ min: 0, max: 10_000 }),
          tokensOut: fc.integer({ min: 0, max: 10_000 }),
          appId: fc.stringMatching(/^[a-z][a-z0-9_-]{0,20}$/),
        }),
        ({ model, userContent, tokensIn, tokensOut, appId }) => {
          const snap = buildRequestSnapshot({
            model,
            messages: [{ role: "user", content: userContent }],
            extraKwargs: {},
          });
          const trace = buildSuccessTrace({
            requestSnapshot: snap,
            responseContent: [],
            responseUsage: { input_tokens: tokensIn, output_tokens: tokensOut },
            responseStopReason: "end_turn",
            identity: {},
            timing: FIXED_TIMING,
            env: { environmentTag: "test", appId },
            sourceInfo: BASE_SOURCE,
            traceId: ulid(),
          });

          const normalized = normalizeTrace(trace as unknown as Record<string, unknown>);

          expect(normalized["traceId"]).toBe("PARITY_TRACE_ID_NORMALIZED");
          expect((normalized["timing"] as Record<string, unknown>)["latencyMs"]).toBe(1000);
          const sdk = (normalized["source"] as Record<string, unknown>)["sdk"] as Record<string, unknown>;
          expect(sdk["name"]).toBe("autocontext-sdk");
          expect(sdk["version"]).toBe("0.0.0");
          const messages = normalized["messages"] as Array<Record<string, unknown>>;
          expect(messages.length).toBeGreaterThan(0);
          for (const msg of messages) {
            expect(msg["timestamp"]).toBe("2024-01-01T00:00:00Z");
          }
          expect(() => JSON.parse(canonicalJson(normalized))).not.toThrow();
          return true;
        },
      ),
      { numRuns: 50 },
    );
  });

  test("failure traces: error fields are always normalized", () => {
    fc.assert(
      fc.property(
        fc.record({
          model: fc.string({ minLength: 1, maxLength: 50 }),
          userContent: fc.string({ minLength: 0, maxLength: 200 }),
          errorMessage: fc.string({ minLength: 1, maxLength: 500 }),
          errorType: fc.constantFrom(
            "rateLimited",
            "timeout",
            "upstreamError",
            "overloaded",
            "uncategorized",
          ),
          appId: fc.stringMatching(/^[a-z][a-z0-9_-]{0,20}$/),
        }),
        ({ model, userContent, errorMessage, errorType, appId }) => {
          const snap = buildRequestSnapshot({
            model,
            messages: [{ role: "user", content: userContent }],
            extraKwargs: {},
          });
          const trace = buildFailureTrace({
            requestSnapshot: snap,
            identity: {},
            timing: FIXED_TIMING,
            env: { environmentTag: "test", appId },
            sourceInfo: BASE_SOURCE,
            traceId: ulid(),
            reasonKey: errorType,
            errorMessage,
            stack: "Error: at some line",
          });

          const normalized = normalizeTrace(trace as unknown as Record<string, unknown>);
          const outcome = normalized["outcome"] as Record<string, unknown>;
          const err = outcome["error"] as Record<string, unknown>;

          expect(err["message"]).toBe("NORMALIZED");
          expect(err["stack"]).toBe("NORMALIZED");
          expect(err["type"]).toBe("NORMALIZED");
          expect(outcome["label"]).toBe("failure");
          return true;
        },
      ),
      { numRuns: 50 },
    );
  });

  test("session hashing: same salt+userId always produces same hash", () => {
    const PARITY_SALT = "853482c52c98d13b39045c7da0bb1d5cdee13629821bae2ce148566c427c36f7";
    fc.assert(
      fc.property(
        fc.record({
          userId: fc.string({ minLength: 1, maxLength: 200 }),
          sessionId: fc.string({ minLength: 1, maxLength: 200 }),
        }),
        ({ userId, sessionId }) => {
          const hash1 = hashUserId(userId, PARITY_SALT);
          const hash2 = hashUserId(userId, PARITY_SALT);
          expect(hash1).toBe(hash2);
          expect(hash1).toMatch(/^[0-9a-f]{64}$/);

          const sHash1 = hashSessionId(sessionId, PARITY_SALT);
          const sHash2 = hashSessionId(sessionId, PARITY_SALT);
          expect(sHash1).toBe(sHash2);
          expect(sHash1).toMatch(/^[0-9a-f]{64}$/);
          return true;
        },
      ),
      { numRuns: 50 },
    );
  });

  test("Anthropic traces include providerUsage with cache-aware token accounting", () => {
    fc.assert(
      fc.property(
        fc.record({
          model: fc.string({ minLength: 1, maxLength: 50 }),
          tokensIn: fc.integer({ min: 0, max: 1_000 }),
          tokensOut: fc.integer({ min: 0, max: 1_000 }),
          cacheCreate: fc.integer({ min: 0, max: 1_000 }),
          cacheRead: fc.integer({ min: 0, max: 1_000 }),
          appId: fc.stringMatching(/^[a-z][a-z0-9_-]{0,20}$/),
        }),
        ({ model, tokensIn, tokensOut, cacheCreate, cacheRead, appId }) => {
          const snap = buildRequestSnapshot({
            model,
            messages: [{ role: "user", content: "test" }],
            extraKwargs: {},
          });
          const trace = buildSuccessTrace({
            requestSnapshot: snap,
            responseContent: [],
            responseUsage: {
              input_tokens: tokensIn,
              output_tokens: tokensOut,
              cache_creation_input_tokens: cacheCreate,
              cache_read_input_tokens: cacheRead,
            },
            responseStopReason: "end_turn",
            identity: {},
            timing: FIXED_TIMING,
            env: { environmentTag: "test", appId },
            sourceInfo: BASE_SOURCE,
            traceId: ulid(),
          });
          const t = trace as unknown as Record<string, unknown>;
          const usage = t["usage"] as Record<string, unknown>;
          expect(usage["tokensIn"]).toBe(tokensIn + cacheCreate + cacheRead);
          expect(usage["tokensOut"]).toBe(tokensOut);
          const pu = usage["providerUsage"] as Record<string, number>;
          expect(pu["inputTokens"]).toBe(tokensIn);
          expect(pu["cacheCreationInputTokens"]).toBe(cacheCreate);
          expect(pu["cacheReadInputTokens"]).toBe(cacheRead);
          expect(pu["outputTokens"]).toBe(tokensOut);
          return true;
        },
      ),
      { numRuns: 50 },
    );
  });

  test("traces without identity have no session field", () => {
    fc.assert(
      fc.property(
        fc.record({
          model: fc.string({ minLength: 1, maxLength: 50 }),
          userContent: fc.string({ minLength: 0, maxLength: 200 }),
          appId: fc.stringMatching(/^[a-z][a-z0-9_-]{0,20}$/),
        }),
        ({ model, userContent, appId }) => {
          const snap = buildRequestSnapshot({
            model,
            messages: [{ role: "user", content: userContent }],
            extraKwargs: {},
          });
          const trace = buildSuccessTrace({
            requestSnapshot: snap,
            responseContent: [],
            responseUsage: { input_tokens: 1, output_tokens: 1 },
            responseStopReason: null,
            identity: {},
            timing: FIXED_TIMING,
            env: { environmentTag: "test", appId },
            sourceInfo: BASE_SOURCE,
            traceId: ulid(),
          });
          const t = trace as unknown as Record<string, unknown>;
          expect(t["session"]).toBeUndefined();
          return true;
        },
      ),
      { numRuns: 50 },
    );
  });
});
