import { describe, expect, it } from "vitest";
import { ExtractionParseError, parseExtractionResponse } from "./extraction.js";

describe("parseExtractionResponse", () => {
  it("parses a well-formed extraction response with a company guess", () => {
    const raw = JSON.stringify({
      companyGuess: { name: "Acme Corp", domain: "acme.com" },
      summary: "Applied for Backend Engineer role, confirmation received.",
      stageGuess: null,
      joiningLink: null,
    });

    expect(parseExtractionResponse(raw)).toEqual({
      companyGuess: { name: "Acme Corp", domain: "acme.com" },
      summary: "Applied for Backend Engineer role, confirmation received.",
      stageSignal: null,
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

  it("parses a stage guess with an explicit round", () => {
    const raw = JSON.stringify({
      companyGuess: null,
      summary: "Scheduled for a second interview.",
      stageGuess: { name: "interview", round: 2 },
    });

    expect(parseExtractionResponse(raw).stageSignal).toEqual({ name: "interview", round: 2 });
  });

  it("parses a stage guess with no round", () => {
    const raw = JSON.stringify({
      companyGuess: null,
      summary: "Application received.",
      stageGuess: { name: "applied" },
    });

    expect(parseExtractionResponse(raw).stageSignal).toEqual({ name: "applied" });
  });

  it("defaults stageSignal to null when stageGuess is omitted", () => {
    const raw = JSON.stringify({ companyGuess: null, summary: "x" });
    expect(parseExtractionResponse(raw).stageSignal).toBeNull();
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

  it("throws ExtractionParseError when stageGuess.name is not a known stage", () => {
    const raw = JSON.stringify({ companyGuess: null, summary: "x", stageGuess: { name: "bogus" } });
    expect(() => parseExtractionResponse(raw)).toThrow(ExtractionParseError);
  });

  it("throws ExtractionParseError when stageGuess.round is not a positive integer", () => {
    const raw = JSON.stringify({
      companyGuess: null,
      summary: "x",
      stageGuess: { name: "interview", round: -1 },
    });
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
