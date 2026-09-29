import { INITIAL_STAGE, isTerminal } from "./stage.js";
import type { Application } from "./types.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const DEFAULT_GHOSTED_THRESHOLD_DAYS = 14;

/**
 * A suggestion, never an automatic status change: true once enough days have
 * passed since the last event (inbound or outbound) with no reply — the user
 * still has to confirm "Ghosted" themselves for it to become the actual
 * status. Terminal stages (rejected/withdrawn) are never flagged — there's
 * nothing left to go quiet on.
 */
export function isPossiblyGhosted(
  application: Application,
  now: Date,
  thresholdDays: number = DEFAULT_GHOSTED_THRESHOLD_DAYS
): boolean {
  const stage = application.stage ?? INITIAL_STAGE;
  if (isTerminal(stage.name)) return false;

  if (application.timelineEvents.length === 0) return false;

  const lastEventAt = application.timelineEvents.reduce(
    (latest, event) => (event.timestamp > latest ? event.timestamp : latest),
    application.timelineEvents[0]!.timestamp
  );
  const daysSinceLastEvent = Math.floor((now.getTime() - new Date(lastEventAt).getTime()) / MS_PER_DAY);

  return daysSinceLastEvent >= thresholdDays;
}

/**
 * The one and only way an application's stage becomes "ghosted" — a
 * deliberate user action from the dashboard, never automatic.
 */
export function confirmGhosted(application: Application): Application {
  return { ...application, stage: { name: "ghosted" } };
}
