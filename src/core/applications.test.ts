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
});
