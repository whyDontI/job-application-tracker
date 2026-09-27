import { describe, expect, it } from "vitest";
import { ExtractionParseError, parseExtractionResponse } from "./extraction.js";

describe("parseExtractionResponse", () => {
  it("parses a well-formed extraction response with a company guess", () => {
    const raw = JSON.stringify({
      companyGuess: { name: "Acme Corp", domain: "acme.com" },
      summary: "Applied for Backend Engineer role, confirmation received.",
    });

    expect(parseExtractionResponse(raw)).toEqual({
      companyGuess: { name: "Acme Corp", domain: "acme.com" },
      summary: "Applied for Backend Engineer role, confirmation received.",
    });
  });

  it("parses a response with no company guess", () => {
    const raw = JSON.stringify({
      companyGuess: null,
      summary: "Recruiter reached out about a role, no employer name found.",
    });

    expect(parseExtractionResponse(raw).companyGuess).toBeNull();
  });

  it("tolerates surrounding prose/markdown fences around the JSON object", () => {
    const raw = [
      "Here's the extracted data:",
      "```json",
      JSON.stringify({ companyGuess: null, summary: "A summary." }),
      "```",
    ].join("\n");

    expect(parseExtractionResponse(raw).summary).toBe("A summary.");
  });

  it("throws ExtractionParseError when the response is not JSON", () => {
    expect(() => parseExtractionResponse("not json at all")).toThrow(ExtractionParseError);
  });

  it("throws ExtractionParseError when summary is missing", () => {
    const raw = JSON.stringify({ companyGuess: null });
    expect(() => parseExtractionResponse(raw)).toThrow(ExtractionParseError);
  });

  it("throws ExtractionParseError when summary is not a string", () => {
    const raw = JSON.stringify({ companyGuess: null, summary: 42 });
    expect(() => parseExtractionResponse(raw)).toThrow(ExtractionParseError);
  });

  it("throws ExtractionParseError when companyGuess has no name", () => {
    const raw = JSON.stringify({ companyGuess: { domain: "acme.com" }, summary: "x" });
    expect(() => parseExtractionResponse(raw)).toThrow(ExtractionParseError);
  });
});
