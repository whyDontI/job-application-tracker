import { createApplication } from "./applications.js";
import { foldStageTransitions } from "./applicationMatching.js";
import type { DatedStageSignal } from "./applicationMatching.js";
import { INITIAL_STAGE, stagesEqual } from "./stage.js";
import type { Stage } from "./stage.js";
import type { Application, Company, StageHistoryEntry, TimelineEvent } from "./types.js";

export interface CompanyChoice {
  companyId: string | null;
  newCompanyName: string | null;
}

export interface ConfirmTrackingInput {
  applicationId: string;
  account: string;
  sessionId: string | null;
  createdAt: string;
  companyChoice: CompanyChoice;
  /** Pre-generated id to use if companyChoice creates a new company. */
  newCompanyId: string;
  companyGuessDomain?: string;
  event: TimelineEvent;
  /** Already confirmed/overridden by the user in the confirm panel — not a raw AI signal. */
  stage: Stage;
  joiningLink: string | null;
  notes?: string;
  /** Total messages in the scraped thread at track time — stored so a later re-track only folds genuinely new messages. */
  trackedMessageCount?: number;
  /**
   * Per-message stage detections from the tracked thread. When folding them
   * from Applied lands on the same stage the user confirmed, the full dated
   * history is trusted; if the user overrode the stage instead, there's no
   * way to know which message that corresponds to, so history falls back to
   * a single entry for the confirmed stage.
   */
  messageSignals?: DatedStageSignal[];
}

export interface ConfirmTrackingResult {
  application: Application;
  newCompany: Company | null;
}

/**
 * Decides whether the confirmed choice attaches to an existing company or
 * creates a new one, then assembles the Application record. This is the
 * decision logic behind the confirm panel; kept in core so it's testable
 * without the DOM.
 */
export function confirmTracking(input: ConfirmTrackingInput): ConfirmTrackingResult {
  let companyId = input.companyChoice.companyId;
  let newCompany: Company | null = null;

  if (!companyId) {
    newCompany = {
      id: input.newCompanyId,
      name: input.companyChoice.newCompanyName || "Unknown company",
      domains: input.companyGuessDomain ? [input.companyGuessDomain] : [],
    };
    companyId = newCompany.id;
  }

  const application = createApplication({
    id: input.applicationId,
    companyId,
    account: input.account,
    sessionId: input.sessionId,
    createdAt: input.createdAt,
    firstEvent: input.event,
    stage: input.stage,
    joiningLink: input.joiningLink,
    notes: input.notes,
    stageHistory: buildInitialStageHistory(input),
    trackedMessageCount: input.trackedMessageCount,
  });

  return { application, newCompany };
}

function buildInitialStageHistory(input: ConfirmTrackingInput): StageHistoryEntry[] {
  const foldedTransitions = foldStageTransitions(INITIAL_STAGE, input.messageSignals ?? []);
  const foldedFinalStage = foldedTransitions.at(-1)?.stage ?? INITIAL_STAGE;

  if (!stagesEqual(foldedFinalStage, input.stage)) {
    return [{ stage: input.stage, enteredAt: input.createdAt }];
  }

  return [{ stage: INITIAL_STAGE, enteredAt: input.createdAt }, ...foldedTransitions];
}
