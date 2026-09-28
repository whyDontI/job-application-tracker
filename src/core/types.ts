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
}

export interface Company {
  id: string;
  name: string;
  domains: string[];
}

export interface Repository {
  getApplications(): Promise<Application[]>;
  saveApplication(application: Application): Promise<void>;
  deleteApplication(id: string): Promise<void>;
  getCompanies(): Promise<Company[]>;
  saveCompany(company: Company): Promise<void>;
  deleteCompany(id: string): Promise<void>;
}
