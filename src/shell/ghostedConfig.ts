import { DEFAULT_GHOSTED_THRESHOLD_DAYS } from "../core/ghosted.js";

export { DEFAULT_GHOSTED_THRESHOLD_DAYS };

export const GHOSTED_THRESHOLD_STORAGE_KEY = "ghostedThresholdDays";

export function isValidGhostedThreshold(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}
