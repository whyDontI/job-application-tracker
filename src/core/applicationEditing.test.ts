import { describe, expect, it } from "vitest";
import { applyApplicationEdits } from "./applicationEditing.js";
import type { ApplicationEditableFields } from "./applicationEditing.js";
import type { Application } from "./types.js";

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

describe("applyApplicationEdits", () => {
  it("replaces every editable field with the given values", () => {
    const application = makeApplication({});
    const edits: ApplicationEditableFields = {
      companyId: "co_2",
      stage: { name: "interview", round: 2 },
      joiningLink: "https://zoom.us/j/123",
      notes: "Recruiter mentioned a tight timeline.",
      createdAt: "2026-09-15T00:00:00.000Z",
      sessionId: "sess_1",
    };

    expect(applyApplicationEdits(application, edits)).toEqual({
      ...application,
      ...edits,
    });
  });

  it("can clear joiningLink and sessionId back to null", () => {
    const application = makeApplication({
      joiningLink: "https://zoom.us/j/123",
      sessionId: "sess_1",
    });

    const updated = applyApplicationEdits(application, {
      companyId: application.companyId,
      stage: application.stage,
      joiningLink: null,
      notes: application.notes,
      createdAt: application.createdAt,
      sessionId: null,
    });

    expect(updated.joiningLink).toBeNull();
    expect(updated.sessionId).toBeNull();
  });

  it("does not mutate the original application or its timeline events", () => {
    const application = makeApplication({});
    const updated = applyApplicationEdits(application, {
      companyId: "co_2",
      stage: { name: "offer" },
      joiningLink: null,
      notes: "",
      createdAt: application.createdAt,
      sessionId: null,
    });

    expect(updated).not.toBe(application);
    expect(application.companyId).toBe("co_1");
    expect(updated.timelineEvents).toBe(application.timelineEvents);
  });
});
