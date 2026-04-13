/**
 * Shared numeric normalization helpers.
 *
 * Policy:
 * - logic/control-flow metrics use stable numeric normalization
 * - confidence/threshold values are clamped to the unit interval
 * - presentation formatting should happen separately via toFixed()/Intl in UI strings
 */

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function roundToDecimals(value: number, digits = 6): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function normalizeDecisionMetric(value: number, digits = 6): number {
  return roundToDecimals(value, digits);
}

export function normalizeConfidence(value: number, digits = 4): number {
  return roundToDecimals(clamp(value, 0, 1), digits);
}

export function normalizePreviewThreshold(value: number, digits = 3): number {
  return normalizeConfidence(value, digits);
}

export function normalizeConfidence(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return roundToDecimals(Math.min(1, Math.max(0, value)), 4);
}

export function normalizePreviewThreshold(value: number): number {
  return normalizeConfidence(value);
}
