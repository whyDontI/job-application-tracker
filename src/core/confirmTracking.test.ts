import { describe, expect, it } from "vitest";
import { confirmTracking } from "./confirmTracking.js";
import type { TimelineEvent } from "./types.js";

const event: TimelineEvent = {
  id: "evt_1",
  threadId: "thread_1",
  direction: "inbound",
  timestamp: "2026-09-28T00:00:00.000Z",
  summary: "Applied for Backend Engineer role.",
  deepLink: "https://mail.google.com/mail/u/0/#all/thread_1",
};

describe("confirmTracking", () => {
  it("attaches the application to an existing company when one was chosen", () => {
    const result = confirmTracking({
      applicationId: "app_1",
      account: "nikhil@gmail.com",
      sessionId: null,
      createdAt: "2026-09-28T00:00:00.000Z",
      companyChoice: { companyId: "co_1", newCompanyName: null },
      newCompanyId: "co_new",
      companyGuessDomain: "acme.com",
      event,
      stage: { name: "applied" },
      joiningLink: null,
    });

    expect(result.newCompany).toBeNull();
    expect(result.application.companyId).toBe("co_1");
    expect(result.application.timelineEvents).toEqual([event]);
  });

  it("uses the confirmed stage and joining link as-is, without recomputing them", () => {
    const result = confirmTracking({
      applicationId: "app_1",
      account: "nikhil@gmail.com",
      sessionId: null,
      createdAt: "2026-09-28T00:00:00.000Z",
      companyChoice: { companyId: "co_1", newCompanyName: null },
      newCompanyId: "co_new",
      event,
      stage: { name: "interview", round: 2 },
      joiningLink: "https://zoom.us/j/123",
    });

    expect(result.application.stage).toEqual({ name: "interview", round: 2 });
    expect(result.application.joiningLink).toBe("https://zoom.us/j/123");
  });

  it("creates a new company from the confirmed name and guessed domain when none was chosen", () => {
    const result = confirmTracking({
      applicationId: "app_1",
      account: "nikhil@gmail.com",
      sessionId: "sess_1",
      createdAt: "2026-09-28T00:00:00.000Z",
      companyChoice: { companyId: null, newCompanyName: "Acme Corp" },
      newCompanyId: "co_new",
      companyGuessDomain: "acme.com",
      event,
      stage: { name: "applied" },
      joiningLink: null,
    });

    expect(result.newCompany).toEqual({ id: "co_new", name: "Acme Corp", domains: ["acme.com"] });
    expect(result.application.companyId).toBe("co_new");
  });

  it("falls back to 'Unknown company' when no name was confirmed", () => {
    const result = confirmTracking({
      applicationId: "app_1",
      account: "nikhil@gmail.com",
      sessionId: null,
      createdAt: "2026-09-28T00:00:00.000Z",
      companyChoice: { companyId: null, newCompanyName: "" },
      newCompanyId: "co_new",
      event,
      stage: { name: "applied" },
      joiningLink: null,
    });

    expect(result.newCompany?.name).toBe("Unknown company");
    expect(result.newCompany?.domains).toEqual([]);
  });
});
