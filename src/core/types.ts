import type { Stage } from "./stage.js";

export interface TimelineEvent {
  id: string;
  threadId: string;
  direction: "inbound" | "outbound";
  timestamp: string;
  summary: string;
  deepLink: string;
}

/** One point the application reached in the pipeline, dated by the source email's real timestamp (not tracking-click time). */
export interface StageHistoryEntry {
  stage: Stage;
  enteredAt: string;
}

export interface Application {
  id: string;
  companyId: string;
  account: string;
  sessionId: string | null;
  timelineEvents: TimelineEvent[];
  createdAt: string;
  stage: Stage;
  joiningLink: string | null;
  notes: string;
  stageHistory: StageHistoryEntry[];
  /**
   * How many of the scraped thread's messages have already been folded into
   * stageHistory — lets a re-track only process genuinely new messages
   * instead of re-folding old ones against the stage they already advanced
   * past (which would corrupt round numbers/dates on every re-track).
   */
  trackedMessageCount: number;
}

export interface Company {
  id: string;
  name: string;
  domains: string[];
}

export interface Session {
  id: string;
  name: string;
  startedAt: string;
  /** null while the session is active; set once the user ends/archives it. */
  endedAt: string | null;
}

/** Shared shape both repository implementations (chrome.storage.local and the in-memory test double) build each collection from. */
export interface StoredCollection<T extends { id: string }> {
  getAll(): Promise<T[]>;
  save(item: T): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface Repository {
  getApplications(): Promise<Application[]>;
  saveApplication(application: Application): Promise<void>;
  deleteApplication(id: string): Promise<void>;
  getCompanies(): Promise<Company[]>;
  saveCompany(company: Company): Promise<void>;
  deleteCompany(id: string): Promise<void>;
  getSessions(): Promise<Session[]>;
  saveSession(session: Session): Promise<void>;
  deleteSession(id: string): Promise<void>;
}
