import type { Application, TimelineEvent } from "./types.js";

export interface CreateApplicationInput {
  id: string;
  companyId: string;
  account: string;
  sessionId: string | null;
  createdAt: string;
  firstEvent: TimelineEvent;
}

export function createApplication(input: CreateApplicationInput): Application {
  return {
    id: input.id,
    companyId: input.companyId,
    account: input.account,
    sessionId: input.sessionId,
    createdAt: input.createdAt,
    timelineEvents: [input.firstEvent],
  };
}
