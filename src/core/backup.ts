import type { Application, Company, Repository, Session } from "./types.js";

export const BACKUP_VERSION = 1;

export interface Backup {
  version: number;
  exportedAt: string;
  applications: Application[];
  companies: Company[];
  sessions: Session[];
}

export class BackupParseError extends Error {
  constructor(reason: string) {
    super(`Could not parse backup file: ${reason}`);
    this.name = "BackupParseError";
  }
}

export function createBackup(
  data: { applications: Application[]; companies: Company[]; sessions: Session[] },
  exportedAt: string
): Backup {
  return { version: BACKUP_VERSION, exportedAt, ...data };
}

export function serializeBackup(backup: Backup): string {
  return JSON.stringify(backup, null, 2);
}

/**
 * Only confirms each collection is an array of objects — per-item FIELD
 * validation is left to the same defensive `?? fallback` reads already used
 * throughout the app for records from any source, not re-implemented here.
 * This still rejects something like `applications: [1, 2, 3]` up front,
 * rather than letting a non-object item reach `saveApplication` and corrupt
 * storage silently until something else crashes on it later.
 */
function assertArrayOfObjects(value: unknown, field: string): void {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "object" || item === null)) {
    throw new BackupParseError(`'${field}' must be an array of objects`);
  }
}

export function parseBackup(raw: string): Backup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BackupParseError("not valid JSON");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new BackupParseError("top-level value must be an object");
  }

  const body = parsed as Record<string, unknown>;

  if (typeof body.version !== "number") {
    throw new BackupParseError("missing or invalid 'version'");
  }
  if (typeof body.exportedAt !== "string") {
    throw new BackupParseError("missing or invalid 'exportedAt'");
  }
  assertArrayOfObjects(body.applications, "applications");
  assertArrayOfObjects(body.companies, "companies");
  assertArrayOfObjects(body.sessions, "sessions");

  return {
    version: body.version,
    exportedAt: body.exportedAt,
    applications: body.applications as Application[],
    companies: body.companies as Company[],
    sessions: body.sessions as Session[],
  };
}

export async function createBackupFromRepository(repository: Repository, exportedAt: string): Promise<Backup> {
  const [applications, companies, sessions] = await Promise.all([
    repository.getApplications(),
    repository.getCompanies(),
    repository.getSessions(),
  ]);
  return createBackup({ applications, companies, sessions }, exportedAt);
}

async function replaceCollection<T extends { id: string }>(
  getAll: () => Promise<T[]>,
  remove: (id: string) => Promise<void>,
  save: (item: T) => Promise<void>,
  items: T[]
): Promise<void> {
  const existing = await getAll();
  await Promise.all(existing.map((item) => remove(item.id)));
  await Promise.all(items.map((item) => save(item)));
}

/** Wipes every existing application/company/session and replaces them with the backup's contents. */
export async function restoreBackup(repository: Repository, backup: Backup): Promise<void> {
  await Promise.all([
    replaceCollection(
      () => repository.getApplications(),
      (id) => repository.deleteApplication(id),
      (item) => repository.saveApplication(item),
      backup.applications
    ),
    replaceCollection(
      () => repository.getCompanies(),
      (id) => repository.deleteCompany(id),
      (item) => repository.saveCompany(item),
      backup.companies
    ),
    replaceCollection(
      () => repository.getSessions(),
      (id) => repository.deleteSession(id),
      (item) => repository.saveSession(item),
      backup.sessions
    ),
  ]);
}
