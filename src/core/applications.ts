import type { Stage } from "./stage.js";
import type { Application, StageHistoryEntry, TimelineEvent } from "./types.js";

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
  /** Defaults to a single entry for `stage`, dated `createdAt` — every application starts somewhere. */
  stageHistory?: StageHistoryEntry[];
  /** How many scraped thread messages were already folded into `stageHistory` above; defaults to 0 (a manually-added application has no thread at all). */
  trackedMessageCount?: number;
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
    stageHistory: input.stageHistory ?? [{ stage: input.stage, enteredAt: input.createdAt }],
    trackedMessageCount: input.trackedMessageCount ?? 0,
  };
}
