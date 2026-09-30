import { describe, expect, it } from "vitest";
import { groupApplicationsByStage } from "./board.js";
import { STAGE_NAMES } from "./stage.js";
import type { Application } from "./types.js";

function makeApplication(overrides: Partial<Application>): Application {
  return {
    id: "app_1",
    companyId: "co_1",
    account: "nikhil@gmail.com",
    sessionId: null,
    createdAt: "2026-09-28T00:00:00.000Z",
    timelineEvents: [],
    stage: { name: "applied" },
    joiningLink: null,
    notes: "",
    stageHistory: [],
    trackedMessageCount: 0,
    ...overrides,
  };
}

describe("groupApplicationsByStage", () => {
  it("returns one column per pipeline stage, in pipeline order, even when empty", () => {
    const columns = groupApplicationsByStage([]);
    expect(columns.map((column) => column.stage)).toEqual(STAGE_NAMES);
    expect(columns.every((column) => column.applications.length === 0)).toBe(true);
  });

  it("places each application in the column matching its current stage", () => {
    const applied = makeApplication({ id: "app_applied", stage: { name: "applied" } });
    const screen = makeApplication({ id: "app_screen", stage: { name: "recruiter_screen" } });
    const interview = makeApplication({ id: "app_interview", stage: { name: "interview", round: 2 } });
    const offer = makeApplication({ id: "app_offer", stage: { name: "offer" } });
    const rejected = makeApplication({ id: "app_rejected", stage: { name: "rejected" } });
    const withdrawn = makeApplication({ id: "app_withdrawn", stage: { name: "withdrawn" } });

    const columns = groupApplicationsByStage([applied, screen, interview, offer, rejected, withdrawn]);
    const byStage = new Map(columns.map((column) => [column.stage, column.applications]));

    expect(byStage.get("applied")).toEqual([applied]);
    expect(byStage.get("recruiter_screen")).toEqual([screen]);
    expect(byStage.get("interview")).toEqual([interview]);
    expect(byStage.get("offer")).toEqual([offer]);
    expect(byStage.get("rejected")).toEqual([rejected]);
    expect(byStage.get("withdrawn")).toEqual([withdrawn]);
  });

  it("preserves input order of applications within a column", () => {
    const first = makeApplication({ id: "app_first", stage: { name: "applied" } });
    const second = makeApplication({ id: "app_second", stage: { name: "applied" } });

    const columns = groupApplicationsByStage([second, first]);
    const appliedColumn = columns.find((column) => column.stage === "applied");

    expect(appliedColumn?.applications).toEqual([second, first]);
  });

  it("treats an application with no stage recorded as Applied, matching applicationMatching's fallback", () => {
    const legacy = makeApplication({ id: "app_legacy" });
    // @ts-expect-error simulating a record saved before `stage` existed
    delete legacy.stage;

    const columns = groupApplicationsByStage([legacy]);
    const appliedColumn = columns.find((column) => column.stage === "applied");

    expect(appliedColumn?.applications).toEqual([legacy]);
  });
});
