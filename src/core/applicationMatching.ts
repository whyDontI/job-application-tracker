import { applyStageSignal } from "./stage.js";
import type { StageSignal } from "./stage.js";
import type { Application, TimelineEvent } from "./types.js";

/**
 * Matches deterministically on Gmail's own threadId — never by company name
 * or other fuzzy signals. A thread with no match always means a new
 * application; cross-thread merging is out of scope by design.
 */
export function findApplicationByThreadId(
  applications: Application[],
  threadId: string
): Application | undefined {
  return applications.find((application) =>
    application.timelineEvents.some((event) => event.threadId === threadId)
  );
}

export interface AppendTimelineEventUpdates {
  /** Applied to the application's current stage via applyStageSignal; a null/omitted signal leaves the stage untouched. */
  stageSignal?: StageSignal | null;
  /** Overwrites the stored joining link when present; a null/omitted value keeps whatever was already stored. */
  joiningLink?: string | null;
}

export function appendTimelineEvent(
  application: Application,
  event: TimelineEvent,
  updates: AppendTimelineEventUpdates = {}
): Application {
  return {
    ...application,
    timelineEvents: [...application.timelineEvents, event],
    stage: applyStageSignal(application.stage, updates.stageSignal ?? null),
    joiningLink: updates.joiningLink ?? application.joiningLink,
  };
}
