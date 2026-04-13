import { readFileSync } from "node:fs";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readJsonObject(path: string, label: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf-8"));
  } catch (err) {
    throw new Error(`Invalid ${label}: ${(err as Error).message}`);
  }

  if (!isRecord(parsed)) {
    throw new Error(`Invalid ${label}: expected a JSON object`);
  }

  return parsed;
}
