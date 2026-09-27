import type { Application, Company, Repository } from "../../core/types.js";

const APPLICATIONS_KEY = "applications";
const COMPANIES_KEY = "companies";

export function createChromeRepository(): Repository {
  return {
    async getApplications() {
      const result = await chrome.storage.local.get(APPLICATIONS_KEY);
      return (result[APPLICATIONS_KEY] as Application[] | undefined) ?? [];
    },
    async saveApplication(application) {
      const applications = await this.getApplications();
      const next = applications.filter((existing) => existing.id !== application.id);
      next.push(application);
      await chrome.storage.local.set({ [APPLICATIONS_KEY]: next });
    },
    async deleteApplication(id) {
      const applications = await this.getApplications();
      const next = applications.filter((existing) => existing.id !== id);
      await chrome.storage.local.set({ [APPLICATIONS_KEY]: next });
    },
    async getCompanies() {
      const result = await chrome.storage.local.get(COMPANIES_KEY);
      return (result[COMPANIES_KEY] as Company[] | undefined) ?? [];
    },
    async saveCompany(company) {
      const companies = await this.getCompanies();
      const next = companies.filter((existing) => existing.id !== company.id);
      next.push(company);
      await chrome.storage.local.set({ [COMPANIES_KEY]: next });
    },
    async deleteCompany(id) {
      const companies = await this.getCompanies();
      const next = companies.filter((existing) => existing.id !== id);
      await chrome.storage.local.set({ [COMPANIES_KEY]: next });
    },
  };
}
