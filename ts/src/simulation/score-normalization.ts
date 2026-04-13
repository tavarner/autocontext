import { roundToDecimals } from "../analytics/number-utils.js";

export const SIMULATION_NUMERIC_DECIMALS = 4;

export function normalizeSimulationScore(value: number): number {
  return roundToDecimals(value, SIMULATION_NUMERIC_DECIMALS);
}

export function normalizeSimulationDelta(value: number): number {
  return roundToDecimals(value, SIMULATION_NUMERIC_DECIMALS);
}

export function normalizeSimulationSweepValue(value: number): number {
  return roundToDecimals(value, SIMULATION_NUMERIC_DECIMALS);
}
