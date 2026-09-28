import { describe, expect, it } from "vitest";
import { appendTimelineEvent, findApplicationByThreadId } from "./applicationMatching.js";
import type { Application, TimelineEvent } from "./types.js";

const existingEvent: TimelineEvent = {
  id: "evt_1",
  threadId: "thread_1",
  direction: "inbound",
  timestamp: "2026-09-28T00:00:00.000Z",
  summary: "Applied for Backend Engineer role.",
  deepLink: "https://mail.google.com/mail/u/0/#all/thread_1",
};

const application: Application = {
  id: "app_1",
  companyId: "co_1",
  account: "nikhil@gmail.com",
  sessionId: null,
  createdAt: "2026-09-28T00:00:00.000Z",
  timelineEvents: [existingEvent],
  stage: { name: "applied" },
  joiningLink: null,
};

describe("findApplicationByThreadId", () => {
  it("returns the application whose timeline includes a matching threadId", () => {
    expect(findApplicationByThreadId([application], "thread_1")).toBe(application);
  });

  it("returns undefined when no application's timeline has that threadId", () => {
    expect(findApplicationByThreadId([application], "thread_2")).toBeUndefined();
  });

  it("returns undefined for an empty application list", () => {
    expect(findApplicationByThreadId([], "thread_1")).toBeUndefined();
  });
});

describe("appendTimelineEvent", () => {
  it("returns a new application with the event appended, without mutating the original", () => {
    const newEvent: TimelineEvent = {
      id: "evt_2",
      threadId: "thread_1",
      direction: "outbound",
      timestamp: "2026-10-01T00:00:00.000Z",
      summary: "Followed up after a week of silence.",
      deepLink: "https://mail.google.com/mail/u/0/#all/thread_1",
    };

    const updated = appendTimelineEvent(application, newEvent);

    expect(updated.timelineEvents).toEqual([existingEvent, newEvent]);
    expect(application.timelineEvents).toEqual([existingEvent]);
    expect(updated).not.toBe(application);
  });

  it("leaves stage and joiningLink untouched when no updates are given", () => {
    const withLink: Application = { ...application, joiningLink: "https://zoom.us/j/123" };
    const updated = appendTimelineEvent(withLink, existingEvent);
    expect(updated.stage).toEqual({ name: "applied" });
    expect(updated.joiningLink).toBe("https://zoom.us/j/123");
  });

  it("applies a stage signal via the same state machine as applyStageSignal", () => {
    const updated = appendTimelineEvent(application, existingEvent, {
      stageSignal: { name: "interview" },
    });
    expect(updated.stage).toEqual({ name: "interview", round: 1 });
  });

  it("overwrites the joining link when a new one is provided", () => {
    const updated = appendTimelineEvent(application, existingEvent, {
      joiningLink: "https://zoom.us/j/456",
    });
    expect(updated.joiningLink).toBe("https://zoom.us/j/456");
  });

  it("keeps the existing joining link when the update has none", () => {
    const withLink: Application = { ...application, joiningLink: "https://zoom.us/j/123" };
    const updated = appendTimelineEvent(withLink, existingEvent, { joiningLink: null });
    expect(updated.joiningLink).toBe("https://zoom.us/j/123");
  });
});
