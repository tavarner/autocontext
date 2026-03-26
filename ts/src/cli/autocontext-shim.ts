#!/usr/bin/env node
/**
 * Redirect shim: `autocontext` → `autoctx` (AC-395).
 *
 * If someone runs `autocontext` (e.g. via `npx autocontext` or after installing
 * the wrong package), this shim prints a naming callout to stderr then
 * delegates to the real `autoctx` CLI with all original arguments.
 *
 * This is installed as an additional bin entry in package.json so that
 * `npm install -g autoctx` claims the `autocontext` command name too.
 */

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const realCli = join(__dirname, "index.ts");

console.error(
  'Note: The correct CLI command is `autoctx`, not `autocontext`.\n' +
  'Install: npm install -g autoctx\n' +
  'Forwarding to autoctx...\n',
);

// Forward all arguments to the real CLI
const args = process.argv.slice(2);

try {
  execFileSync(process.execPath, [realCli, ...args], {
    stdio: ["inherit", "inherit", "inherit"],
    env: process.env,
  });
} catch (err: unknown) {
  const code = (err as { status?: number }).status;
  process.exit(code ?? 1);
}
