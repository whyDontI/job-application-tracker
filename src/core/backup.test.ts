import { describe, expect, it } from "vitest";
import {
  BackupParseError,
  createBackup,
  createBackupFromRepository,
  parseBackup,
  restoreBackup,
  serializeBackup,
} from "./backup.js";
import { createInMemoryRepository } from "./inMemoryRepository.js";
import type { Application, Company, Session } from "./types.js";

function makeApplication(overrides: Partial<Application>): Application {
  return {
    id: "app_1",
    companyId: "co_1",
    account: "nikhil@gmail.com",
    sessionId: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    timelineEvents: [],
    stage: { name: "applied" },
    joiningLink: null,
    notes: "",
    stageHistory: [],
    trackedMessageCount: 0,
    ...overrides,
  };
}

const company: Company = { id: "co_1", name: "Acme Corp", domains: ["acme.com"] };
const session: Session = { id: "sess_1", name: "Fall hunt", startedAt: "2026-09-01T00:00:00.000Z", endedAt: null };

describe("createBackup / serializeBackup / parseBackup round-trip", () => {
  it("round-trips applications, companies, and sessions through JSON unchanged", () => {
    const application = makeApplication({});
    const backup = createBackup(
      { applications: [application], companies: [company], sessions: [session] },
      "2026-10-01T00:00:00.000Z"
    );

    const parsed = parseBackup(serializeBackup(backup));

    expect(parsed).toEqual(backup);
  });

  it("stamps the backup with a version and the given exportedAt", () => {
    const backup = createBackup({ applications: [], companies: [], sessions: [] }, "2026-10-01T00:00:00.000Z");
    expect(backup.version).toBe(1);
    expect(backup.exportedAt).toBe("2026-10-01T00:00:00.000Z");
  });
});

describe("parseBackup validation", () => {
  it("throws BackupParseError for invalid JSON", () => {
    expect(() => parseBackup("not json")).toThrow(BackupParseError);
  });

  it("throws BackupParseError when the top-level value isn't an object", () => {
    expect(() => parseBackup("42")).toThrow(BackupParseError);
    expect(() => parseBackup("null")).toThrow(BackupParseError);
  });

  it("throws BackupParseError when 'version' is missing", () => {
    const raw = JSON.stringify({ exportedAt: "x", applications: [], companies: [], sessions: [] });
    expect(() => parseBackup(raw)).toThrow(BackupParseError);
  });

  it("throws BackupParseError when 'applications'/'companies'/'sessions' aren't arrays", () => {
    const base = { version: 1, exportedAt: "x", applications: [], companies: [], sessions: [] };
    expect(() => parseBackup(JSON.stringify({ ...base, applications: "nope" }))).toThrow(BackupParseError);
    expect(() => parseBackup(JSON.stringify({ ...base, companies: "nope" }))).toThrow(BackupParseError);
    expect(() => parseBackup(JSON.stringify({ ...base, sessions: "nope" }))).toThrow(BackupParseError);
  });

  it("throws BackupParseError when a collection contains a non-object entry, instead of letting it reach storage", () => {
    const base = { version: 1, exportedAt: "x", applications: [], companies: [], sessions: [] };
    expect(() => parseBackup(JSON.stringify({ ...base, applications: [1, 2, 3] }))).toThrow(BackupParseError);
    expect(() => parseBackup(JSON.stringify({ ...base, companies: [null] }))).toThrow(BackupParseError);
    expect(() => parseBackup(JSON.stringify({ ...base, sessions: ["not an object"] }))).toThrow(BackupParseError);
  });
});

describe("createBackupFromRepository", () => {
  it("builds a backup from whatever the repository currently holds", async () => {
    const application = makeApplication({});
    const repository = createInMemoryRepository({
      applications: [application],
      companies: [company],
      sessions: [session],
    });

    const backup = await createBackupFromRepository(repository, "2026-10-01T00:00:00.000Z");

    expect(backup.applications).toEqual([application]);
    expect(backup.companies).toEqual([company]);
    expect(backup.sessions).toEqual([session]);
    expect(backup.exportedAt).toBe("2026-10-01T00:00:00.000Z");
  });
});

describe("restoreBackup", () => {
  it("replaces every existing application, company, and session with the backup's contents", async () => {
    const staleApplication = makeApplication({ id: "app_stale", companyId: "co_stale" });
    const staleCompany: Company = { id: "co_stale", name: "Stale Inc", domains: [] };
    const staleSession: Session = { id: "sess_stale", name: "Old hunt", startedAt: "2025-01-01T00:00:00.000Z", endedAt: "2025-02-01T00:00:00.000Z" };
    const repository = createInMemoryRepository({
      applications: [staleApplication],
      companies: [staleCompany],
      sessions: [staleSession],
    });

    const freshApplication = makeApplication({ id: "app_fresh" });
    const backup = createBackup(
      { applications: [freshApplication], companies: [company], sessions: [session] },
      "2026-10-01T00:00:00.000Z"
    );

    await restoreBackup(repository, backup);

    expect(await repository.getApplications()).toEqual([freshApplication]);
    expect(await repository.getCompanies()).toEqual([company]);
    expect(await repository.getSessions()).toEqual([session]);
  });

  it("leaves the repository empty when restoring an empty backup", async () => {
    const repository = createInMemoryRepository({
      applications: [makeApplication({})],
      companies: [company],
      sessions: [session],
    });

    const emptyBackup = createBackup({ applications: [], companies: [], sessions: [] }, "2026-10-01T00:00:00.000Z");
    await restoreBackup(repository, emptyBackup);

    expect(await repository.getApplications()).toEqual([]);
    expect(await repository.getCompanies()).toEqual([]);
    expect(await repository.getSessions()).toEqual([]);
  });
});
