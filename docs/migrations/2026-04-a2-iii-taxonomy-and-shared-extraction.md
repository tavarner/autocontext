# Migration: `OutcomeReasonKey` expansion + `_shared` primitives extraction

**Released in:** A2-III (branch `a2-iii-anthropic-integration`)
**Affects:** Code that type-checks against `OutcomeReasonKey`; code that imports sink/session from `integrations/openai`
**Severity:** Additive only — all existing openai consumers compile and run unchanged.

---

## Background

A2-III introduced two backward-compatible changes to support the Anthropic integration
alongside the existing OpenAI integration:

1. **`OutcomeReasonKey` expanded** — a new `"overloaded"` value was added to the shared
   taxonomy to represent Anthropic's HTTP 529 capacity-exhaustion response.

2. **Sink and session primitives extracted to `_shared`** — `FileSink`, `TraceSink`,
   `autocontext_session` (Python) / `autocontextSession` (TS) moved from
   `integrations/openai` to a new `integrations/_shared` module. The openai integration
   re-exports all these symbols unchanged; no import paths break.

---

## Change 1: `OutcomeReasonKey` — `"overloaded"` added

### Python (`autocontext.integrations._shared.taxonomy`)

**Before (A2-II-b):**
```python
OutcomeReasonKey = Literal["timeout", "context_length_exceeded", "content_filter", "auth_error", "rate_limited", "unknown"]
```

**After (A2-III):**
```python
OutcomeReasonKey = Literal["timeout", "context_length_exceeded", "content_filter", "auth_error", "rate_limited", "overloaded", "unknown"]
```

### TypeScript (`autoctx/integrations/_shared`)

**Before:**
```typescript
export type OutcomeReasonKey = "timeout" | "context_length_exceeded" | "content_filter" | "auth_error" | "rate_limited" | "unknown";
```

**After:**
```typescript
export type OutcomeReasonKey = "timeout" | "context_length_exceeded" | "content_filter" | "auth_error" | "rate_limited" | "overloaded" | "unknown";
```

### Action required

None for existing code. If you have an exhaustive `switch` / `match` on `OutcomeReasonKey`
without a default case, add a `"overloaded"` arm.

---

## Change 2: Sink + session primitives moved to `_shared`

### Python

**Before (A2-II-b):** `FileSink`, `TraceSink`, `autocontext_session` lived in
`autocontext/integrations/openai/_sink.py` + `_session.py`.

**After (A2-III):** These now live in `autocontext/integrations/_shared/` and are
re-exported from `autocontext.integrations.openai` unchanged.

### TypeScript

**Before (A2-II-b):** `FileSink`, `TraceSink`, `autocontextSession`, `currentSession`
lived in `ts/src/integrations/openai/sink.ts` + `session.ts`.

**After (A2-III):** These now live in `ts/src/integrations/_shared/` and are re-exported
from `autoctx/integrations/openai` unchanged. A new `autoctx/integrations/anthropic`
subpath also re-exports these same symbols.

### Action required

None. All existing imports from `autocontext.integrations.openai` /
`autoctx/integrations/openai` continue to work without change. The `_shared` subpath
is internal and not part of the public surface — do not import from it directly.

---

## New subpaths (A2-III additions)

| Subpath | Language | Content |
|---------|----------|---------|
| `autocontext.integrations.anthropic` | Python | `instrument_client`, `FileSink`, `TraceSink`, `autocontext_session` |
| `autoctx/integrations/anthropic` | TypeScript | `instrumentClient`, `FileSink`, `TraceSink`, `autocontextSession` |
| `autoctx/detectors/anthropic-python` | TypeScript | `plugin` (`DetectorPlugin` for Python Anthropic SDK) |
| `autoctx/detectors/anthropic-ts` | TypeScript | `plugin` (`DetectorPlugin` for TS `@anthropic-ai/sdk`) |

These are **new** exports — existing openai integrations are unaffected.
