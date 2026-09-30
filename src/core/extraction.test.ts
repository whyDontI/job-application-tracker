import { describe, expect, it } from "vitest";
import { ExtractionParseError, parseExtractionResponse } from "./extraction.js";

describe("parseExtractionResponse", () => {
  it("parses a well-formed extraction response with a company guess", () => {
    const raw = JSON.stringify({
      companyGuess: { name: "Acme Corp", domain: "acme.com" },
      summary: "Applied for Backend Engineer role, confirmation received.",
      stagesByMessage: [],
      joiningLink: null,
    });

    expect(parseExtractionResponse(raw)).toEqual({
      companyGuess: { name: "Acme Corp", domain: "acme.com" },
      summary: "Applied for Backend Engineer role, confirmation received.",
      stageSignalsByMessage: [],
      joiningLink: null,
    });
  });

  it("parses a response with no company guess", () => {
    const raw = JSON.stringify({
      companyGuess: null,
      summary: "Recruiter reached out about a role, no employer name found.",
    });

    expect(parseExtractionResponse(raw).companyGuess).toBeNull();
  });

  it("parses stage guesses for multiple messages, each with its own message index", () => {
    const raw = JSON.stringify({
      companyGuess: null,
      summary: "Progressed from recruiter screen to a second interview.",
      stagesByMessage: [
        { messageIndex: 1, stageGuess: { name: "recruiter_screen" } },
        { messageIndex: 3, stageGuess: { name: "interview", round: 2 } },
      ],
    });

    expect(parseExtractionResponse(raw).stageSignalsByMessage).toEqual([
      { messageIndex: 1, stageSignal: { name: "recruiter_screen" } },
      { messageIndex: 3, stageSignal: { name: "interview", round: 2 } },
    ]);
  });

  it("defaults stageSignalsByMessage to an empty array when stagesByMessage is omitted", () => {
    const raw = JSON.stringify({ companyGuess: null, summary: "x" });
    expect(parseExtractionResponse(raw).stageSignalsByMessage).toEqual([]);
  });

  it("parses a joining link when present", () => {
    const raw = JSON.stringify({
      companyGuess: null,
      summary: "Offer accepted, here's your Zoom link.",
      joiningLink: "https://zoom.us/j/123",
    });

    expect(parseExtractionResponse(raw).joiningLink).toBe("https://zoom.us/j/123");
  });

  it("defaults joiningLink to null when omitted", () => {
    const raw = JSON.stringify({ companyGuess: null, summary: "x" });
    expect(parseExtractionResponse(raw).joiningLink).toBeNull();
  });

  it("throws ExtractionParseError when a stageGuess.name is not a known stage", () => {
    const raw = JSON.stringify({
      companyGuess: null,
      summary: "x",
      stagesByMessage: [{ messageIndex: 0, stageGuess: { name: "bogus" } }],
    });
    expect(() => parseExtractionResponse(raw)).toThrow(ExtractionParseError);
  });

  it("throws ExtractionParseError when a stageGuess.name is 'ghosted' — never AI-detectable, only set via manual confirmation", () => {
    const raw = JSON.stringify({
      companyGuess: null,
      summary: "x",
      stagesByMessage: [{ messageIndex: 0, stageGuess: { name: "ghosted" } }],
    });
    expect(() => parseExtractionResponse(raw)).toThrow(ExtractionParseError);
  });

  it("throws ExtractionParseError when a stageGuess.round is not a positive integer", () => {
    const raw = JSON.stringify({
      companyGuess: null,
      summary: "x",
      stagesByMessage: [{ messageIndex: 0, stageGuess: { name: "interview", round: -1 } }],
    });
    expect(() => parseExtractionResponse(raw)).toThrow(ExtractionParseError);
  });

  it("throws ExtractionParseError when a messageIndex is missing or negative", () => {
    const missing = JSON.stringify({
      companyGuess: null,
      summary: "x",
      stagesByMessage: [{ stageGuess: { name: "applied" } }],
    });
    const negative = JSON.stringify({
      companyGuess: null,
      summary: "x",
      stagesByMessage: [{ messageIndex: -1, stageGuess: { name: "applied" } }],
    });
    expect(() => parseExtractionResponse(missing)).toThrow(ExtractionParseError);
    expect(() => parseExtractionResponse(negative)).toThrow(ExtractionParseError);
  });

  it("throws ExtractionParseError when stagesByMessage is not an array", () => {
    const raw = JSON.stringify({ companyGuess: null, summary: "x", stagesByMessage: "nope" });
    expect(() => parseExtractionResponse(raw)).toThrow(ExtractionParseError);
  });

  it("throws ExtractionParseError when joiningLink is not a string", () => {
    const raw = JSON.stringify({ companyGuess: null, summary: "x", joiningLink: 42 });
    expect(() => parseExtractionResponse(raw)).toThrow(ExtractionParseError);
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
