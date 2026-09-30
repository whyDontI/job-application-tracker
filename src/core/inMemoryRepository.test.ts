import { describe, expect, it } from "vitest";
import { createInMemoryRepository } from "./inMemoryRepository.js";
import type { Application, Company, Session } from "./types.js";

const company: Company = { id: "co_1", name: "Acme Corp", domains: ["acme.com"] };
const session: Session = {
  id: "sess_1",
  name: "Spring hunt",
  startedAt: "2026-09-28T00:00:00.000Z",
  endedAt: null,
};
const application: Application = {
  id: "app_1",
  companyId: "co_1",
  account: "nikhil@gmail.com",
  sessionId: null,
  createdAt: "2026-09-28T00:00:00.000Z",
  timelineEvents: [],
  stage: { name: "applied" },
  joiningLink: null,
  notes: "",
  stageHistory: [],
  trackedMessageCount: 0,
};

describe("createInMemoryRepository", () => {
  it("starts empty when no seed is given", async () => {
    const repo = createInMemoryRepository();
    expect(await repo.getApplications()).toEqual([]);
    expect(await repo.getCompanies()).toEqual([]);
  });

  it("seeds initial applications and companies", async () => {
    const repo = createInMemoryRepository({ applications: [application], companies: [company] });
    expect(await repo.getApplications()).toEqual([application]);
    expect(await repo.getCompanies()).toEqual([company]);
  });

  it("round-trips a saved application, replacing any prior version by id", async () => {
    const repo = createInMemoryRepository();
    await repo.saveApplication(application);
    const updated = { ...application, sessionId: "sess_1" };
    await repo.saveApplication(updated);

    const stored = await repo.getApplications();
    expect(stored).toEqual([updated]);
  });

  it("deletes an application by id", async () => {
    const repo = createInMemoryRepository({ applications: [application] });
    await repo.deleteApplication(application.id);
    expect(await repo.getApplications()).toEqual([]);
  });

  it("round-trips a saved company and deletes it by id", async () => {
    const repo = createInMemoryRepository();
    await repo.saveCompany(company);
    expect(await repo.getCompanies()).toEqual([company]);

    await repo.deleteCompany(company.id);
    expect(await repo.getCompanies()).toEqual([]);
  });

  it("round-trips a saved session and deletes it by id", async () => {
    const repo = createInMemoryRepository();
    await repo.saveSession(session);
    expect(await repo.getSessions()).toEqual([session]);

    await repo.deleteSession(session.id);
    expect(await repo.getSessions()).toEqual([]);
  });

  it("seeds initial sessions", async () => {
    const repo = createInMemoryRepository({ sessions: [session] });
    expect(await repo.getSessions()).toEqual([session]);
  });
});
