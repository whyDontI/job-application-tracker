import type { Stage } from "./stage.js";
import type { Application, TimelineEvent } from "./types.js";

export interface CreateApplicationInput {
  id: string;
  companyId: string;
  account: string;
  sessionId: string | null;
  createdAt: string;
  firstEvent: TimelineEvent;
  stage: Stage;
  joiningLink: string | null;
}

export function createApplication(input: CreateApplicationInput): Application {
  return {
    id: input.id,
    companyId: input.companyId,
    account: input.account,
    sessionId: input.sessionId,
    createdAt: input.createdAt,
    timelineEvents: [input.firstEvent],
    stage: input.stage,
    joiningLink: input.joiningLink,
  };
}
