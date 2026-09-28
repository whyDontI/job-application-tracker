import { INITIAL_STAGE, STAGE_NAMES } from "./stage.js";
import type { Application, Company } from "./types.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface TableRow {
  application: Application;
  companyName: string;
  lastFollowUpAt: string | null;
  daysSinceFollowUp: number | null;
}

export type TableSortKey = "company" | "stage" | "daysSinceFollowUp";
export type SortDirection = "asc" | "desc";

/**
 * "Follow-up" only counts outbound timeline events — a reply the user sent —
 * so an inbound-only thread never looks like it was followed up on.
 */
export function computeFollowUp(
  application: Application,
  now: Date
): { lastFollowUpAt: string | null; daysSinceFollowUp: number | null } {
  const outboundTimestamps = application.timelineEvents
    .filter((event) => event.direction === "outbound")
    .map((event) => event.timestamp);

  if (outboundTimestamps.length === 0) {
    return { lastFollowUpAt: null, daysSinceFollowUp: null };
  }

  const lastFollowUpAt = outboundTimestamps.reduce((latest, timestamp) =>
    timestamp > latest ? timestamp : latest
  );
  const daysSinceFollowUp = Math.floor((now.getTime() - new Date(lastFollowUpAt).getTime()) / MS_PER_DAY);

  return { lastFollowUpAt, daysSinceFollowUp };
}

export function buildTableRows(applications: Application[], companies: Company[], now: Date): TableRow[] {
  const companyById = new Map(companies.map((company) => [company.id, company]));

  return applications.map((application) => ({
    application,
    companyName: companyById.get(application.companyId)?.name ?? "Unknown company",
    ...computeFollowUp(application, now),
  }));
}

const STAGE_RANK: Record<string, number> = Object.fromEntries(
  STAGE_NAMES.map((name, index) => [name, index])
);

const DIRECTIONAL_COMPARATORS: Record<TableSortKey, (a: TableRow, b: TableRow, sign: number) => number> = {
  company: (a, b, sign) => sign * a.companyName.localeCompare(b.companyName),
  stage: (a, b, sign) =>
    sign *
    (STAGE_RANK[(a.application.stage ?? INITIAL_STAGE).name]! -
      STAGE_RANK[(b.application.stage ?? INITIAL_STAGE).name]!),
  // Rows with no follow-up always sort to the end, in either direction — there's
  // nothing to rank them by, and putting them first under "descending" would
  // read as if they were the most overdue instead of not-yet-followed-up.
  daysSinceFollowUp: (a, b, sign) => {
    if (a.daysSinceFollowUp === null) return b.daysSinceFollowUp === null ? 0 : 1;
    if (b.daysSinceFollowUp === null) return -1;
    return sign * (a.daysSinceFollowUp - b.daysSinceFollowUp);
  },
};

export function sortTableRows(rows: TableRow[], key: TableSortKey, direction: SortDirection): TableRow[] {
  const sign = direction === "asc" ? 1 : -1;
  const comparator = DIRECTIONAL_COMPARATORS[key];
  return [...rows].sort((a, b) => comparator(a, b, sign));
}
