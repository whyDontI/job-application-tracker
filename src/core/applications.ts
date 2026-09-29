import type { Stage } from "./stage.js";
import type { Application, TimelineEvent } from "./types.js";

export interface CreateApplicationInput {
  id: string;
  companyId: string;
  account: string;
  sessionId: string | null;
  createdAt: string;
  /** Omitted for a manually-added application with no tracked email yet. */
  firstEvent?: TimelineEvent;
  stage: Stage;
  joiningLink: string | null;
  notes?: string;
}

export function createApplication(input: CreateApplicationInput): Application {
  return {
    id: input.id,
    companyId: input.companyId,
    account: input.account,
    sessionId: input.sessionId,
    createdAt: input.createdAt,
    timelineEvents: input.firstEvent ? [input.firstEvent] : [],
    stage: input.stage,
    joiningLink: input.joiningLink,
    notes: input.notes ?? "",
  };
}
