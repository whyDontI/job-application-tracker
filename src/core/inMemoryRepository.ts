import type { Application, Company, Repository, Session, StoredCollection } from "./types.js";

function createMapCollection<T extends { id: string }>(seed: T[] = []): StoredCollection<T> {
  const items = new Map<string, T>(seed.map((item) => [item.id, item]));
  return {
    async getAll() {
      return [...items.values()];
    },
    async save(item) {
      items.set(item.id, item);
    },
    async remove(id) {
      items.delete(id);
    },
  };
}

export function createInMemoryRepository(seed?: {
  applications?: Application[];
  companies?: Company[];
  sessions?: Session[];
}): Repository {
  const applications = createMapCollection<Application>(seed?.applications);
  const companies = createMapCollection<Company>(seed?.companies);
  const sessions = createMapCollection<Session>(seed?.sessions);

  return {
    getApplications: () => applications.getAll(),
    saveApplication: (application) => applications.save(application),
    deleteApplication: (id) => applications.remove(id),
    getCompanies: () => companies.getAll(),
    saveCompany: (company) => companies.save(company),
    deleteCompany: (id) => companies.remove(id),
    getSessions: () => sessions.getAll(),
    saveSession: (session) => sessions.save(session),
    deleteSession: (id) => sessions.remove(id),
  };
}
