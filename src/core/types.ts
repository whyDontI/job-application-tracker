import type { Stage } from "./stage.js";

export interface TimelineEvent {
  id: string;
  threadId: string;
  direction: "inbound" | "outbound";
  timestamp: string;
  summary: string;
  deepLink: string;
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
