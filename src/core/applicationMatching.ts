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

export function appendTimelineEvent(application: Application, event: TimelineEvent): Application {
  return {
    ...application,
    timelineEvents: [...application.timelineEvents, event],
  };
}
