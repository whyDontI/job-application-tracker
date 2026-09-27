export interface CompanyGuess {
  name: string;
  domain?: string;
}

export interface ExtractionResult {
  companyGuess: CompanyGuess | null;
  summary: string;
}

export class ExtractionParseError extends Error {
  constructor(reason: string) {
    super(`Could not parse AI extraction response: ${reason}`);
    this.name = "ExtractionParseError";
  }
}

function extractJsonObject(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? raw;

  try {
    return JSON.parse(candidate.trim());
  } catch {
    throw new ExtractionParseError("response did not contain valid JSON");
  }
}

function parseCompanyGuess(value: unknown): CompanyGuess | null {
  if (value === null || value === undefined) return null;

  if (typeof value !== "object") {
    throw new ExtractionParseError("companyGuess must be an object or null");
  }

  const guess = value as Record<string, unknown>;
  if (typeof guess.name !== "string" || guess.name.trim() === "") {
    throw new ExtractionParseError("companyGuess.name must be a non-empty string");
  }

  const domain = guess.domain;
  if (domain !== undefined && typeof domain !== "string") {
    throw new ExtractionParseError("companyGuess.domain must be a string when present");
  }

  return domain ? { name: guess.name, domain } : { name: guess.name };
}

export function parseExtractionResponse(raw: string): ExtractionResult {
  const parsed = extractJsonObject(raw);

  if (typeof parsed !== "object" || parsed === null) {
    throw new ExtractionParseError("top-level response must be a JSON object");
  }

  const body = parsed as Record<string, unknown>;

  if (typeof body.summary !== "string" || body.summary.trim() === "") {
    throw new ExtractionParseError("summary must be a non-empty string");
  }

  return {
    companyGuess: parseCompanyGuess(body.companyGuess),
    summary: body.summary,
  };
}
