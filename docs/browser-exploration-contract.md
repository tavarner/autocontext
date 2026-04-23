# Browser Exploration Contract

This document defines the shared browser exploration foundation used by both published packages:

- `autocontext` on PyPI
- `autoctx` on npm

The goal is to support browser exploration in a way that is thin, inspectable, and enterprise-safe.

## Design Guide

The architecture is inspired by thin browser-control projects such as `browser-harness`, but adapted to fit AutoContext's package model:

- shared contract, separate Python and TypeScript projections
- no heavyweight browser framework bundled into core
- security-first defaults
- explicit evidence and audit records
- compatibility with future thin CDP backends or optional external adapters

## Current Scope

This foundation now includes the shared contract and policy layer plus a thin Chrome/CDP attachment path.

Included:

- canonical JSON Schemas for browser session config, actions, snapshots, and audit events
- TypeScript validators and generated contract types
- mirrored Python schemas and generated Pydantic models
- shared cross-runtime fixtures and parity tests
- security-focused policy helpers for allowlists and auth-sensitive actions
- mirrored `AUTOCONTEXT_BROWSER_*` settings in both packages
- thin evidence stores for browser audit and snapshot artifacts
- thin CDP session wrappers for `navigate`, `snapshot`, `click`, `fill`, `press`, and `screenshot`
- thin websocket CDP transports
- thin CDP runtimes that create sessions from a debugger target
- debugger target discovery from `/json/list` with allowlist-aware selection
- settings-backed runtime factories that resolve a session config plus runtime together
- investigation wiring in both CLIs via `investigate --browser-url <url>`, which captures a policy-checked browser snapshot and feeds stable context/evidence into investigation prompts and reports

Not yet included:

- browser process launching or lifecycle management
- domain-skill persistence
- broader scenario or operator-loop execution wiring beyond the explicit investigate entry point
- uploads/downloads as first-class browser actions

## Contract Documents

The canonical schemas live under:

- `ts/src/integrations/browser/contract/json-schemas/`

They are mirrored into Python under:

- `autocontext/src/autocontext/integrations/browser/contract/json_schemas/`

The shared document types are:

- `BrowserSessionConfig`
- `BrowserAction`
- `BrowserSnapshot`
- `BrowserAuditEvent`

## Security Defaults

The shared defaults intentionally favor enterprise adoption:

- browser exploration is off by default
- profile mode defaults to `ephemeral`
- auth, uploads, and downloads default to `false`
- headless defaults to `true`
- screenshot capture defaults to `true` for auditability
- navigation is expected to use an explicit domain allowlist

Policy helpers currently enforce:

- exact and wildcard domain allowlists for navigation
- rejection of invalid navigation URLs
- rejection of inline-credential navigation when auth is disabled
- rejection of password-field fills when auth is disabled
- rejection of download/upload-enabled session configs without an explicit root
- rejection of `user-profile` mode unless auth is explicitly enabled

Debugger target discovery additionally enforces:

- page-target-only attachment
- allowlist-aware target selection using the same navigation policy rules
- optional preferred target URL hints without bypassing policy

## Package Surfaces

TypeScript exposes the shared browser module at:

- `autoctx/integrations/browser`

Python exposes the matching validation and policy helpers under:

- `autocontext.integrations.browser`

Both surfaces are intentionally small and backend-agnostic so a thin CDP implementation can be introduced later without changing the contract.

The current CDP implementation is intentionally attach-oriented:

- use `AUTOCONTEXT_BROWSER_DEBUGGER_URL` / `browserDebuggerUrl` to point at an existing Chrome debugger endpoint
- use `AUTOCONTEXT_BROWSER_PREFERRED_TARGET_URL` / `browserPreferredTargetUrl` to prefer a specific page when multiple allowed targets are present
- keep browser launch/orchestration separate from the contract so enterprise deployments can choose their own browser-management model

## Regeneration

TypeScript generated types:

```bash
cd ts
node scripts/generate-browser-contract-types.mjs
```

Python mirrored schemas and models:

```bash
cd ts
node scripts/sync-python-browser-contract-schemas.mjs
```

Drift checks:

```bash
cd ts
npm run check:browser-contract-schemas
```
