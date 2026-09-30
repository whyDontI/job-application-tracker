import { describe, expect, it } from "vitest";
import { createApplication } from "./applications.js";

describe("createApplication", () => {
  it("builds an Application with one inbound timeline event from confirmed extraction data", () => {
    const application = createApplication({
      id: "app_1",
      companyId: "co_1",
      account: "nikhil@gmail.com",
      sessionId: "sess_1",
      createdAt: "2026-09-28T00:00:00.000Z",
      firstEvent: {
        id: "evt_1",
        threadId: "thread_1",
        direction: "inbound",
        timestamp: "2026-09-28T00:00:00.000Z",
        summary: "Applied for Backend Engineer role.",
        deepLink: "https://mail.google.com/mail/u/0/#inbox/thread_1",
      },
      stage: { name: "applied" },
      joiningLink: null,
    });

    expect(application).toEqual({
      id: "app_1",
      companyId: "co_1",
      account: "nikhil@gmail.com",
      sessionId: "sess_1",
      createdAt: "2026-09-28T00:00:00.000Z",
      stage: { name: "applied" },
      joiningLink: null,
      notes: "",
      stageHistory: [{ stage: { name: "applied" }, enteredAt: "2026-09-28T00:00:00.000Z" }],
      trackedMessageCount: 0,
      timelineEvents: [
        {
          id: "evt_1",
          threadId: "thread_1",
          direction: "inbound",
          timestamp: "2026-09-28T00:00:00.000Z",
          summary: "Applied for Backend Engineer role.",
          deepLink: "https://mail.google.com/mail/u/0/#inbox/thread_1",
        },
      ],
    });
  });

  it("builds an Application with no timeline events and the given notes, for a manually-added application with no tracked email", () => {
    const application = createApplication({
      id: "app_2",
      companyId: "co_1",
      account: "manual",
      sessionId: null,
      createdAt: "2026-09-28T00:00:00.000Z",
      stage: { name: "applied" },
      joiningLink: null,
      notes: "Applied via the company's careers page.",
    });

    expect(application).toEqual({
      id: "app_2",
      companyId: "co_1",
      account: "manual",
      sessionId: null,
      createdAt: "2026-09-28T00:00:00.000Z",
      stage: { name: "applied" },
      joiningLink: null,
      notes: "Applied via the company's careers page.",
      stageHistory: [{ stage: { name: "applied" }, enteredAt: "2026-09-28T00:00:00.000Z" }],
      trackedMessageCount: 0,
      timelineEvents: [],
    });
  });

  it("uses the given stageHistory instead of the single-entry default when provided", () => {
    const stageHistory = [
      { stage: { name: "applied" as const }, enteredAt: "2026-09-01T00:00:00.000Z" },
      { stage: { name: "recruiter_screen" as const }, enteredAt: "2026-09-10T00:00:00.000Z" },
    ];
    const application = createApplication({
      id: "app_3",
      companyId: "co_1",
      account: "nikhil@gmail.com",
      sessionId: null,
      createdAt: "2026-09-01T00:00:00.000Z",
      stage: { name: "recruiter_screen" },
      joiningLink: null,
      stageHistory,
    });

    expect(application.stageHistory).toEqual(stageHistory);
  });

  it("defaults trackedMessageCount to 0, or uses the given value", () => {
    const withoutCount = createApplication({
      id: "app_4",
      companyId: "co_1",
      account: "manual",
      sessionId: null,
      createdAt: "2026-09-01T00:00:00.000Z",
      stage: { name: "applied" },
      joiningLink: null,
    });
    expect(withoutCount.trackedMessageCount).toBe(0);

    const withCount = createApplication({
      id: "app_5",
      companyId: "co_1",
      account: "nikhil@gmail.com",
      sessionId: null,
      createdAt: "2026-09-01T00:00:00.000Z",
      stage: { name: "applied" },
      joiningLink: null,
      trackedMessageCount: 3,
    });
    expect(withCount.trackedMessageCount).toBe(3);
  });
});
