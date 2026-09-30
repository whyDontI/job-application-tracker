import { AI_DETECTABLE_STAGE_NAMES } from "./stage.js";
import type { StageSignal } from "./stage.js";

export interface CompanyGuess {
  name: string;
  domain?: string;
}

/** A stage detected from one specific message in the thread, identified by its position in the scraped message list. */
export interface MessageStageSignal {
  messageIndex: number;
  stageSignal: StageSignal;
}

export interface ExtractionResult {
  companyGuess: CompanyGuess | null;
  summary: string;
  /**
   * Per-message, not one aggregate guess for the whole thread — this is what
   * lets a single "catch-up" track on a thread that already progressed
   * through several stages backfill a dated entry for each one, rather than
   * only ever seeing the final stage. Empty when no message signals a stage
   * change.
   */
  stageSignalsByMessage: MessageStageSignal[];
  joiningLink: string | null;
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

function parseStageSignal(value: unknown): StageSignal {
  if (typeof value !== "object" || value === null) {
    throw new ExtractionParseError("stageGuess must be an object");
  }

  const guess = value as Record<string, unknown>;
  if (
    typeof guess.name !== "string" ||
    !(AI_DETECTABLE_STAGE_NAMES as readonly string[]).includes(guess.name)
  ) {
    throw new ExtractionParseError(`stageGuess.name must be one of: ${AI_DETECTABLE_STAGE_NAMES.join(", ")}`);
  }

  const round = guess.round;
  if (round !== undefined && (typeof round !== "number" || round <= 0 || !Number.isInteger(round))) {
    throw new ExtractionParseError("stageGuess.round must be a positive integer when present");
  }

  return round === undefined
    ? { name: guess.name as StageSignal["name"] }
    : { name: guess.name as StageSignal["name"], round };
}

function parseStageSignalsByMessage(value: unknown): MessageStageSignal[] {
  if (value === null || value === undefined) return [];

  if (!Array.isArray(value)) {
    throw new ExtractionParseError("stagesByMessage must be an array when present");
  }

  return value.map((entry, i) => {
    if (typeof entry !== "object" || entry === null) {
      throw new ExtractionParseError(`stagesByMessage[${i}] must be an object`);
    }

    const record = entry as Record<string, unknown>;
    if (
      typeof record.messageIndex !== "number" ||
      !Number.isInteger(record.messageIndex) ||
      record.messageIndex < 0
    ) {
      throw new ExtractionParseError(`stagesByMessage[${i}].messageIndex must be a non-negative integer`);
    }

    return { messageIndex: record.messageIndex, stageSignal: parseStageSignal(record.stageGuess) };
  });
}

function parseJoiningLink(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") {
    throw new ExtractionParseError("joiningLink must be a string or null");
  }
  return value.trim() === "" ? null : value;
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
    stageSignalsByMessage: parseStageSignalsByMessage(body.stagesByMessage),
    joiningLink: parseJoiningLink(body.joiningLink),
  };
}
