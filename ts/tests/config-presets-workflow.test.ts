import { describe, expect, it } from "vitest";

import {
  applyPreset,
  PRESETS,
} from "../src/config/presets.js";

describe("config presets workflow", () => {
  it("exposes the supported preset catalog", () => {
    expect(PRESETS.has("quick")).toBe(true);
    expect(PRESETS.has("standard")).toBe(true);
    expect(PRESETS.has("deep")).toBe(true);
    expect(PRESETS.has("rapid")).toBe(true);
    expect(PRESETS.has("long_run")).toBe(true);
    expect(PRESETS.has("short_run")).toBe(true);
  });

  it("returns cloned preset overrides so callers cannot mutate the catalog", () => {
    const quick = applyPreset("quick");
    quick.matchesPerGeneration = 99;

    expect(applyPreset("quick").matchesPerGeneration).toBe(2);
  });

  it("returns empty overrides for an empty preset name", () => {
    expect(applyPreset("")).toEqual({});
  });

  it("throws a stable error for unknown presets", () => {
    expect(() => applyPreset("unknown")).toThrow(
      "Unknown preset 'unknown'. Valid presets: deep, long_run, quick, rapid, short_run, standard",
    );
  });
});
