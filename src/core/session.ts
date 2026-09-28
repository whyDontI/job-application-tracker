import type { Application, Session } from "./types.js";

export type SessionScope =
  | { kind: "active" }
  | { kind: "session"; sessionId: string }
  | { kind: "all" };

export function getActiveSession(sessions: Session[]): Session | null {
  return sessions.find((session) => session.endedAt === null) ?? null;
}

/**
 * Ends whichever session is currently active (if any) and adds the new one
 * as active, so there's never more than one active session — "Start New
 * Hunt" is a single user action, not two.
 */
export function startNewSession(
  sessions: Session[],
  input: { id: string; name: string; startedAt: string }
): Session[] {
  const withPriorEnded = sessions.map((session) =>
    session.endedAt === null ? { ...session, endedAt: input.startedAt } : session
  );
  return [...withPriorEnded, { id: input.id, name: input.name, startedAt: input.startedAt, endedAt: null }];
}

export function endActiveSession(sessions: Session[], endedAt: string): Session[] {
  return sessions.map((session) => (session.endedAt === null ? { ...session, endedAt } : session));
}

/**
 * The single query every dashboard view (Board/Table/Sankey) reads through,
 * so session scoping is implemented once here rather than per view.
 * "active" resolves to whatever getActiveSession finds, or to unassigned
 * applications (sessionId: null) when no session has ever been started.
 */
export function selectApplicationsForSessionScope(
  applications: Application[],
  sessions: Session[],
  scope: SessionScope
): Application[] {
  if (scope.kind === "all") return applications;

  if (scope.kind === "session") {
    return applications.filter((application) => application.sessionId === scope.sessionId);
  }

  const activeSessionId = getActiveSession(sessions)?.id ?? null;
  return applications.filter((application) => application.sessionId === activeSessionId);
}

export function reassignApplicationSession(
  application: Application,
  sessionId: string | null
): Application {
  return { ...application, sessionId };
}
