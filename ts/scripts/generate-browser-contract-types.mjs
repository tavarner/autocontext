#!/usr/bin/env node
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { compile } from "json-schema-to-typescript";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TS_ROOT = resolve(__dirname, "..");
const SCHEMAS_DIR = join(TS_ROOT, "src/integrations/browser/contract/json-schemas");
const OUTPUT_FILE = join(TS_ROOT, "src/integrations/browser/contract/generated-types.ts");

const BANNER = [
  "/* eslint-disable */",
  "// AUTO-GENERATED from src/integrations/browser/contract/json-schemas/ — DO NOT EDIT.",
  "// Regenerate with: node scripts/generate-browser-contract-types.mjs",
  "// CI gate: node scripts/generate-browser-contract-types.mjs --check",
].join("\n");

const files = readdirSync(SCHEMAS_DIR)
  .filter((f) => f.endsWith(".schema.json"))
  .filter((f) => f !== "browser-contract.schema.json")
  .sort();

const schemasById = new Map();
for (const file of files) {
  const full = join(SCHEMAS_DIR, file);
  const raw = JSON.parse(readFileSync(full, "utf-8"));
  if (typeof raw.$id !== "string") {
    throw new Error(`${file}: schema missing top-level $id`);
  }
  schemasById.set(raw.$id, raw);
}

const idResolver = {
  order: 1,
  canRead: true,
  async read(file) {
    const schema = schemasById.get(file.url);
    if (!schema) {
      throw new Error(`idResolver: unknown $id ${file.url}`);
    }
    return JSON.stringify(schema);
  },
};

const options = {
  bannerComment: "",
  additionalProperties: false,
  declareExternallyReferenced: true,
  unknownAny: true,
  style: { singleQuote: false, semi: true, printWidth: 120 },
  $refOptions: {
    resolve: {
      autocontext: idResolver,
    },
  },
  cwd: SCHEMAS_DIR,
};

const outputs = [];
for (const file of files) {
  const full = join(SCHEMAS_DIR, file);
  const schema = JSON.parse(readFileSync(full, "utf-8"));
  const name = schema.title ?? file.replace(/\.schema\.json$/, "");
  // eslint-disable-next-line no-await-in-loop
  const ts = await compile(schema, name, options);
  outputs.push(`// ---- ${file} ----\n${ts.trim()}\n`);
}

const merged = dedupeDeclarations(outputs.join("\n"));
const final = `${BANNER}\n\n${merged.trim()}\n`;

if (process.argv.slice(2).includes("--check")) {
  const existing = readFileSync(OUTPUT_FILE, "utf-8");
  if (existing !== final) {
    console.error("drift detected: browser generated-types.ts differs from canonical schemas.");
    console.error("run: node scripts/generate-browser-contract-types.mjs");
    process.exit(1);
  }
  console.log("browser generated-types.ts is up to date.");
  process.exit(0);
}

writeFileSync(OUTPUT_FILE, final);
console.log(`wrote ${OUTPUT_FILE}`);

function dedupeDeclarations(src) {
  const seen = new Set();
  const lines = src.split("\n");
  const out = [];
  let skipping = false;
  let braceDepth = 0;
  for (const line of lines) {
    if (skipping) {
      for (const ch of line) {
        if (ch === "{") braceDepth += 1;
        else if (ch === "}") braceDepth -= 1;
      }
      if (braceDepth <= 0) {
        skipping = false;
        braceDepth = 0;
      }
      continue;
    }
    const match = line.match(/^export (interface|type|enum)\s+([A-Za-z0-9_]+)/);
    if (match) {
      const name = match[2];
      if (seen.has(name)) {
        skipping = true;
        for (const ch of line) {
          if (ch === "{") braceDepth += 1;
          else if (ch === "}") braceDepth -= 1;
        }
        if (match[1] === "type" && line.trim().endsWith(";")) {
          skipping = false;
          braceDepth = 0;
        }
        continue;
      }
      seen.add(name);
    }
    out.push(line);
  }
  return out.join("\n");
}
