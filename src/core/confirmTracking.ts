import { createApplication } from "./applications.js";
import type { Application, Company, TimelineEvent } from "./types.js";

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
  });

  return { application, newCompany };
}
