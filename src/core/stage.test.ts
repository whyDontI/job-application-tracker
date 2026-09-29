import { describe, expect, it } from "vitest";
import { INITIAL_STAGE, applyStageSignal, isTerminal } from "./stage.js";
import type { Stage } from "./stage.js";

describe("applyStageSignal", () => {
  it("starts at Applied", () => {
    expect(INITIAL_STAGE).toEqual({ name: "applied" });
  });

  it("returns the current stage unchanged when there is no signal", () => {
    const current: Stage = { name: "recruiter_screen" };
    expect(applyStageSignal(current, null)).toEqual(current);
  });

  it("moves to a non-round stage directly", () => {
    expect(applyStageSignal(INITIAL_STAGE, { name: "recruiter_screen" })).toEqual({
      name: "recruiter_screen",
    });
  });

  it("enters interview at round 1 when no explicit round is given", () => {
    const current: Stage = { name: "recruiter_screen" };
    expect(applyStageSignal(current, { name: "interview" })).toEqual({
      name: "interview",
      round: 1,
    });
  });

  it("increments the round when a new interview signal arrives with no explicit round", () => {
    const current: Stage = { name: "interview", round: 1 };
    expect(applyStageSignal(current, { name: "interview" })).toEqual({
      name: "interview",
      round: 2,
    });
  });

  it("adopts an explicit round number when stated", () => {
    const current: Stage = { name: "interview", round: 1 };
    expect(applyStageSignal(current, { name: "interview", round: 3 })).toEqual({
      name: "interview",
      round: 3,
    });
  });

  it("never regresses the round when an explicit but lower round is stated", () => {
    const current: Stage = { name: "interview", round: 3 };
    expect(applyStageSignal(current, { name: "interview", round: 1 })).toEqual({
      name: "interview",
      round: 3,
    });
  });

  it("starts interview at an explicit round when coming from a non-interview stage", () => {
    expect(applyStageSignal(INITIAL_STAGE, { name: "interview", round: 2 })).toEqual({
      name: "interview",
      round: 2,
    });
  });

  it("moves to a terminal stage (rejected) from any prior stage, including mid-interview", () => {
    const current: Stage = { name: "interview", round: 2 };
    expect(applyStageSignal(current, { name: "rejected" })).toEqual({ name: "rejected" });
  });

  it("moves to withdrawn directly from applied", () => {
    expect(applyStageSignal(INITIAL_STAGE, { name: "withdrawn" })).toEqual({ name: "withdrawn" });
  });

  it("allows a terminal stage to move to another terminal stage (e.g. an offer later rescinded)", () => {
    const current: Stage = { name: "offer" };
    expect(applyStageSignal(current, { name: "rejected" })).toEqual({ name: "rejected" });
  });

  it("allows forward movement that skips stages (e.g. straight from Applied to Offer)", () => {
    expect(applyStageSignal(INITIAL_STAGE, { name: "offer" })).toEqual({ name: "offer" });
  });

  it("rejects a non-terminal backward signal from a later non-round stage to an earlier one", () => {
    const current: Stage = { name: "offer" };
    expect(applyStageSignal(current, { name: "recruiter_screen" })).toEqual(current);
  });

  it("rejects a non-terminal backward signal out of Interview to an earlier stage", () => {
    const current: Stage = { name: "interview", round: 2 };
    expect(applyStageSignal(current, { name: "applied" })).toEqual(current);
  });

  it("rejects a backward signal into Interview from a later stage (Offer)", () => {
    const current: Stage = { name: "offer" };
    expect(applyStageSignal(current, { name: "interview", round: 1 })).toEqual(current);
  });

  it("never leaves a terminal stage once reached, even on an explicit non-terminal signal", () => {
    const current: Stage = { name: "rejected" };
    expect(applyStageSignal(current, { name: "interview", round: 1 })).toEqual(current);
    expect(applyStageSignal(current, { name: "applied" })).toEqual(current);
  });

  it("never leaves 'ghosted' once manually confirmed, even on a later AI-detected signal", () => {
    const current: Stage = { name: "ghosted" };
    expect(applyStageSignal(current, { name: "interview", round: 1 })).toEqual(current);
    expect(applyStageSignal(current, { name: "offer" })).toEqual(current);
  });
});

describe("isTerminal", () => {
  it("treats rejected, withdrawn, and ghosted as terminal", () => {
    expect(isTerminal("rejected")).toBe(true);
    expect(isTerminal("withdrawn")).toBe(true);
    expect(isTerminal("ghosted")).toBe(true);
  });

  it("treats every other stage as non-terminal", () => {
    expect(isTerminal("applied")).toBe(false);
    expect(isTerminal("recruiter_screen")).toBe(false);
    expect(isTerminal("interview")).toBe(false);
    expect(isTerminal("offer")).toBe(false);
  });
});
