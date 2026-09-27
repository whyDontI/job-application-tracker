import type { Application, Company, Repository } from "./types.js";

export function createInMemoryRepository(seed?: {
  applications?: Application[];
  companies?: Company[];
}): Repository {
  const applications = new Map<string, Application>(
    (seed?.applications ?? []).map((application) => [application.id, application])
  );
  const companies = new Map<string, Company>(
    (seed?.companies ?? []).map((company) => [company.id, company])
  );

  return {
    async getApplications() {
      return [...applications.values()];
    },
    async saveApplication(application) {
      applications.set(application.id, application);
    },
    async deleteApplication(id) {
      applications.delete(id);
    },
    async getCompanies() {
      return [...companies.values()];
    },
    async saveCompany(company) {
      companies.set(company.id, company);
    },
    async deleteCompany(id) {
      companies.delete(id);
    },
  };
}
