import { describe, expect, it } from "vitest";
import { DEFAULT_GHOSTED_THRESHOLD_DAYS, confirmGhosted, isPossiblyGhosted } from "./ghosted.js";
import type { Application, TimelineEvent } from "./types.js";

function makeEvent(overrides: Partial<TimelineEvent>): TimelineEvent {
  return {
    id: "evt_1",
    threadId: "thread_1",
    direction: "inbound",
    timestamp: "2026-09-01T00:00:00.000Z",
    summary: "",
    deepLink: "https://mail.google.com/thread_1",
    ...overrides,
  };
}

function makeApplication(overrides: Partial<Application>): Application {
  return {
    id: "app_1",
    companyId: "co_1",
    account: "nikhil@gmail.com",
    sessionId: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    timelineEvents: [],
    stage: { name: "applied" },
    joiningLink: null,
    notes: "",
    ...overrides,
  };
}

describe("isPossiblyGhosted", () => {
  const now = new Date("2026-09-29T00:00:00.000Z");

  it("defaults to a 14-day threshold", () => {
    expect(DEFAULT_GHOSTED_THRESHOLD_DAYS).toBe(14);
  });

  it("is false when the last event is under the threshold", () => {
    const application = makeApplication({
      timelineEvents: [makeEvent({ timestamp: "2026-09-20T00:00:00.000Z" })],
    });
    expect(isPossiblyGhosted(application, now)).toBe(false);
  });

  it("is true when the last event is at or beyond the threshold", () => {
    const application = makeApplication({
      timelineEvents: [makeEvent({ timestamp: "2026-09-15T00:00:00.000Z" })],
    });
    expect(isPossiblyGhosted(application, now)).toBe(true);
  });

  it("considers both inbound and outbound events, using whichever is most recent", () => {
    const application = makeApplication({
      timelineEvents: [
        makeEvent({ id: "evt_old", direction: "inbound", timestamp: "2026-08-01T00:00:00.000Z" }),
        makeEvent({ id: "evt_recent", direction: "outbound", timestamp: "2026-09-25T00:00:00.000Z" }),
      ],
    });
    expect(isPossiblyGhosted(application, now)).toBe(false);
  });

  it("respects a custom threshold", () => {
    const application = makeApplication({
      timelineEvents: [makeEvent({ timestamp: "2026-09-25T00:00:00.000Z" })],
    });
    expect(isPossiblyGhosted(application, now, 3)).toBe(true);
    expect(isPossiblyGhosted(application, now, 5)).toBe(false);
  });

  it("is false for an application with no events yet", () => {
    const application = makeApplication({ timelineEvents: [] });
    expect(isPossiblyGhosted(application, now)).toBe(false);
  });

  it("is false once the application has reached a terminal stage (rejected or withdrawn)", () => {
    const rejected = makeApplication({
      stage: { name: "rejected" },
      timelineEvents: [makeEvent({ timestamp: "2026-08-01T00:00:00.000Z" })],
    });
    const withdrawn = makeApplication({
      stage: { name: "withdrawn" },
      timelineEvents: [makeEvent({ timestamp: "2026-08-01T00:00:00.000Z" })],
    });
    expect(isPossiblyGhosted(rejected, now)).toBe(false);
    expect(isPossiblyGhosted(withdrawn, now)).toBe(false);
  });

  it("treats an application with no stage recorded as Applied (non-terminal), matching the codebase's fallback elsewhere", () => {
    const legacy = makeApplication({
      timelineEvents: [makeEvent({ timestamp: "2026-08-01T00:00:00.000Z" })],
    });
    // @ts-expect-error simulating a record saved before `stage` existed
    delete legacy.stage;
    expect(isPossiblyGhosted(legacy, now)).toBe(true);
  });

  it("is false once the application is already confirmed ghosted — nothing left to suggest", () => {
    const application = makeApplication({
      stage: { name: "ghosted" },
      timelineEvents: [makeEvent({ timestamp: "2026-08-01T00:00:00.000Z" })],
    });
    expect(isPossiblyGhosted(application, now)).toBe(false);
  });
});

describe("confirmGhosted", () => {
  it("sets the stage to ghosted without mutating the original application", () => {
    const application = makeApplication({ stage: { name: "interview", round: 2 } });
    const updated = confirmGhosted(application);
    expect(updated.stage).toEqual({ name: "ghosted" });
    expect(application.stage).toEqual({ name: "interview", round: 2 });
    expect(updated).not.toBe(application);
  });
});
