import { describe, expect, it } from "vitest";
import {
  endActiveSession,
  getActiveSession,
  reassignApplicationSession,
  selectApplicationsForSessionScope,
  startNewSession,
} from "./session.js";
import type { Session } from "./types.js";
import type { Application } from "./types.js";

function makeApplication(overrides: Partial<Application>): Application {
  return {
    id: "app_1",
    companyId: "co_1",
    account: "nikhil@gmail.com",
    sessionId: null,
    createdAt: "2026-09-28T00:00:00.000Z",
    timelineEvents: [],
    stage: { name: "applied" },
    joiningLink: null,
    notes: "",
    ...overrides,
  };
}

describe("startNewSession", () => {
  it("adds a new active session when there is no prior active session", () => {
    const result = startNewSession([], { id: "sess_1", name: "Spring hunt", startedAt: "2026-09-28T00:00:00.000Z" });
    expect(result).toEqual([
      { id: "sess_1", name: "Spring hunt", startedAt: "2026-09-28T00:00:00.000Z", endedAt: null },
    ]);
  });

  it("ends the currently active session before adding the new one, so only one session is ever active", () => {
    const existing: Session = {
      id: "sess_old",
      name: "Old hunt",
      startedAt: "2026-01-01T00:00:00.000Z",
      endedAt: null,
    };
    const result = startNewSession([existing], {
      id: "sess_new",
      name: "New hunt",
      startedAt: "2026-09-28T00:00:00.000Z",
    });

    expect(result).toEqual([
      { ...existing, endedAt: "2026-09-28T00:00:00.000Z" },
      { id: "sess_new", name: "New hunt", startedAt: "2026-09-28T00:00:00.000Z", endedAt: null },
    ]);
  });

  it("leaves already-archived sessions untouched", () => {
    const archived: Session = {
      id: "sess_archived",
      name: "Archived hunt",
      startedAt: "2025-01-01T00:00:00.000Z",
      endedAt: "2025-06-01T00:00:00.000Z",
    };
    const result = startNewSession([archived], {
      id: "sess_new",
      name: "New hunt",
      startedAt: "2026-09-28T00:00:00.000Z",
    });
    expect(result[0]).toEqual(archived);
  });
});

describe("endActiveSession", () => {
  it("sets endedAt on whichever session is currently active", () => {
    const active: Session = { id: "sess_1", name: "Hunt", startedAt: "2026-01-01T00:00:00.000Z", endedAt: null };
    const result = endActiveSession([active], "2026-09-28T00:00:00.000Z");
    expect(result).toEqual([{ ...active, endedAt: "2026-09-28T00:00:00.000Z" }]);
  });

  it("does nothing when there is no active session", () => {
    const archived: Session = {
      id: "sess_1",
      name: "Hunt",
      startedAt: "2026-01-01T00:00:00.000Z",
      endedAt: "2026-02-01T00:00:00.000Z",
    };
    expect(endActiveSession([archived], "2026-09-28T00:00:00.000Z")).toEqual([archived]);
  });
});

describe("getActiveSession", () => {
  it("returns the session with a null endedAt", () => {
    const active: Session = { id: "sess_1", name: "Hunt", startedAt: "2026-01-01T00:00:00.000Z", endedAt: null };
    const archived: Session = {
      id: "sess_0",
      name: "Old",
      startedAt: "2025-01-01T00:00:00.000Z",
      endedAt: "2025-06-01T00:00:00.000Z",
    };
    expect(getActiveSession([archived, active])).toEqual(active);
  });

  it("returns null when no session is active", () => {
    expect(getActiveSession([])).toBeNull();
  });
});

describe("selectApplicationsForSessionScope", () => {
  const active: Session = { id: "sess_active", name: "Active", startedAt: "2026-09-01T00:00:00.000Z", endedAt: null };
  const archived: Session = {
    id: "sess_archived",
    name: "Archived",
    startedAt: "2026-01-01T00:00:00.000Z",
    endedAt: "2026-08-01T00:00:00.000Z",
  };
  const sessions = [archived, active];

  const appInActive = makeApplication({ id: "app_active", sessionId: "sess_active" });
  const appInArchived = makeApplication({ id: "app_archived", sessionId: "sess_archived" });
  const appUntagged = makeApplication({ id: "app_untagged", sessionId: null });
  const applications = [appInActive, appInArchived, appUntagged];

  it("'active' scope returns only applications tagged to the active session", () => {
    expect(selectApplicationsForSessionScope(applications, sessions, { kind: "active" })).toEqual([
      appInActive,
    ]);
  });

  it("'active' scope with no active session returns untagged applications (sessionId: null)", () => {
    const noActiveSessions = [archived];
    expect(
      selectApplicationsForSessionScope(applications, noActiveSessions, { kind: "active" })
    ).toEqual([appUntagged]);
  });

  it("'session' scope returns applications tagged to that specific session id, regardless of active/archived", () => {
    expect(
      selectApplicationsForSessionScope(applications, sessions, {
        kind: "session",
        sessionId: "sess_archived",
      })
    ).toEqual([appInArchived]);
  });

  it("'all' scope returns every application unfiltered", () => {
    expect(selectApplicationsForSessionScope(applications, sessions, { kind: "all" })).toEqual(
      applications
    );
  });
});

describe("reassignApplicationSession", () => {
  it("returns a new application with the sessionId changed, without mutating the original", () => {
    const application = makeApplication({ sessionId: "sess_1" });
    const updated = reassignApplicationSession(application, "sess_2");
    expect(updated.sessionId).toBe("sess_2");
    expect(application.sessionId).toBe("sess_1");
    expect(updated).not.toBe(application);
  });

  it("can unassign an application back to no session", () => {
    const application = makeApplication({ sessionId: "sess_1" });
    expect(reassignApplicationSession(application, null).sessionId).toBeNull();
  });
});
