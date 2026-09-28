import type { Application, Company, Repository, Session, StoredCollection } from "../../core/types.js";

function createChromeCollection<T extends { id: string }>(storageKey: string): StoredCollection<T> {
  const getAll = async (): Promise<T[]> => {
    const result = await chrome.storage.local.get(storageKey);
    return (result[storageKey] as T[] | undefined) ?? [];
  };

  return {
    getAll,
    async save(item) {
      const items = await getAll();
      const next = items.filter((existing) => existing.id !== item.id);
      next.push(item);
      await chrome.storage.local.set({ [storageKey]: next });
    },
    async remove(id) {
      const items = await getAll();
      const next = items.filter((existing) => existing.id !== id);
      await chrome.storage.local.set({ [storageKey]: next });
    },
  };
}

export function createChromeRepository(): Repository {
  const applications = createChromeCollection<Application>("applications");
  const companies = createChromeCollection<Company>("companies");
  const sessions = createChromeCollection<Session>("sessions");

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
