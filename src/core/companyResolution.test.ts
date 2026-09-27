import { describe, expect, it } from "vitest";
import { resolveCompany } from "./companyResolution.js";
import type { Company } from "./types.js";

const companies: Company[] = [
  { id: "co_1", name: "Acme Corp", domains: ["acme.com"] },
  { id: "co_2", name: "Globex", domains: ["globex.io", "globex.com"] },
];

describe("resolveCompany", () => {
  it("matches an existing company by domain", () => {
    const result = resolveCompany(companies, { name: "Acme", domain: "acme.com" });
    expect(result).toEqual({ matchedCompanyId: "co_1", suggestedName: "Acme Corp" });
  });

  it("matches an existing company by case-insensitive exact name when no domain match", () => {
    const result = resolveCompany(companies, { name: "globex" });
    expect(result).toEqual({ matchedCompanyId: "co_2", suggestedName: "Globex" });
  });

  it("prefers a domain match over a name match", () => {
    const result = resolveCompany(companies, { name: "Globex", domain: "acme.com" });
    expect(result.matchedCompanyId).toBe("co_1");
  });

  it("suggests creating a new company when nothing matches", () => {
    const result = resolveCompany(companies, { name: "Initech", domain: "initech.com" });
    expect(result).toEqual({ matchedCompanyId: null, suggestedName: "Initech" });
  });

  it("suggests an empty name when there is no guess at all", () => {
    const result = resolveCompany(companies, null);
    expect(result).toEqual({ matchedCompanyId: null, suggestedName: "" });
  });
});
