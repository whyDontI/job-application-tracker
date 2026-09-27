import type { CompanyGuess } from "./extraction.js";
import type { Company } from "./types.js";

export interface CompanyResolution {
  matchedCompanyId: string | null;
  suggestedName: string;
}

export function resolveCompany(
  companies: Company[],
  guess: CompanyGuess | null
): CompanyResolution {
  if (!guess) {
    return { matchedCompanyId: null, suggestedName: "" };
  }

  const domainMatch = guess.domain
    ? companies.find((company) =>
        company.domains.some((domain) => domain.toLowerCase() === guess.domain?.toLowerCase())
      )
    : undefined;

  if (domainMatch) {
    return { matchedCompanyId: domainMatch.id, suggestedName: domainMatch.name };
  }

  const nameMatch = companies.find(
    (company) => company.name.toLowerCase() === guess.name.toLowerCase()
  );

  if (nameMatch) {
    return { matchedCompanyId: nameMatch.id, suggestedName: nameMatch.name };
  }

  return { matchedCompanyId: null, suggestedName: guess.name };
}
