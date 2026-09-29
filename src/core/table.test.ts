import { describe, expect, it } from "vitest";
import { buildTableRows, computeFollowUp, sortTableRows } from "./table.js";
import type { TableRow } from "./table.js";
import type { Application, Company, TimelineEvent } from "./types.js";

function makeEvent(overrides: Partial<TimelineEvent>): TimelineEvent {
  return {
    id: "evt_1",
    threadId: "thread_1",
    direction: "inbound",
    timestamp: "2026-09-01T00:00:00.000Z",
    summary: "",
    deepLink: "https://mail.google.com/thread_1",
    ...overrides,
  };
}

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
    ...overrides,
  };
}

const company: Company = { id: "co_1", name: "Acme Corp", domains: ["acme.com"] };

describe("computeFollowUp", () => {
  const now = new Date("2026-09-28T00:00:00.000Z");

  it("returns null lastFollowUpAt and daysSinceFollowUp when there is no outbound event", () => {
    const application = makeApplication({
      timelineEvents: [makeEvent({ direction: "inbound", timestamp: "2026-09-01T00:00:00.000Z" })],
    });
    expect(computeFollowUp(application, now)).toEqual({ lastFollowUpAt: null, daysSinceFollowUp: null });
  });

  it("uses the most recent outbound event's timestamp", () => {
    const application = makeApplication({
      timelineEvents: [
        makeEvent({ id: "evt_early", direction: "outbound", timestamp: "2026-09-10T00:00:00.000Z" }),
        makeEvent({ id: "evt_late", direction: "outbound", timestamp: "2026-09-20T00:00:00.000Z" }),
        makeEvent({ id: "evt_inbound", direction: "inbound", timestamp: "2026-09-25T00:00:00.000Z" }),
      ],
    });
    expect(computeFollowUp(application, now)).toEqual({
      lastFollowUpAt: "2026-09-20T00:00:00.000Z",
      daysSinceFollowUp: 8,
    });
  });

  it("rounds down to whole days", () => {
    const application = makeApplication({
      timelineEvents: [makeEvent({ direction: "outbound", timestamp: "2026-09-27T12:00:00.000Z" })],
    });
    expect(computeFollowUp(application, now).daysSinceFollowUp).toBe(0);
  });
});

describe("buildTableRows", () => {
  it("joins each application with its company name and follow-up info", () => {
    const now = new Date("2026-09-28T00:00:00.000Z");
    const application = makeApplication({
      timelineEvents: [makeEvent({ direction: "outbound", timestamp: "2026-09-18T00:00:00.000Z" })],
    });

    const [row] = buildTableRows([application], [company], now);

    expect(row).toEqual({
      application,
      companyName: "Acme Corp",
      lastFollowUpAt: "2026-09-18T00:00:00.000Z",
      daysSinceFollowUp: 10,
    });
  });

  it("falls back to 'Unknown company' when the company can't be found", () => {
    const application = makeApplication({ companyId: "missing" });
    const [row] = buildTableRows([application], [company], new Date());
    expect(row!.companyName).toBe("Unknown company");
  });
});

describe("sortTableRows", () => {
  const now = new Date("2026-09-28T00:00:00.000Z");
  const rowA = buildTableRows(
    [makeApplication({ id: "app_a", companyId: "co_1", stage: { name: "offer" } })],
    [company],
    now
  )[0]!;
  const rowB = buildTableRows(
    [
      makeApplication({
        id: "app_b",
        companyId: "co_2",
        stage: { name: "applied" },
      }),
    ],
    [{ id: "co_2", name: "Zeta Inc", domains: [] }],
    now
  )[0]!;

  it("sorts by company name alphabetically", () => {
    expect(sortTableRows([rowB, rowA], "company", "asc").map((r) => r.companyName)).toEqual([
      "Acme Corp",
      "Zeta Inc",
    ]);
    expect(sortTableRows([rowA, rowB], "company", "desc").map((r) => r.companyName)).toEqual([
      "Zeta Inc",
      "Acme Corp",
    ]);
  });

  it("sorts by stage in pipeline order", () => {
    // rowA is 'offer' (later in the pipeline), rowB is 'applied' (earlier)
    expect(sortTableRows([rowA, rowB], "stage", "asc").map((r) => r.application.id)).toEqual([
      "app_b",
      "app_a",
    ]);
    expect(sortTableRows([rowA, rowB], "stage", "desc").map((r) => r.application.id)).toEqual([
      "app_a",
      "app_b",
    ]);
  });

  it("treats a row with no stage recorded as Applied for sorting, matching applicationMatching's fallback", () => {
    const legacy = makeApplication({ id: "app_legacy" });
    // @ts-expect-error simulating a record saved before `stage` existed
    delete legacy.stage;
    const legacyRow = buildTableRows([legacy], [company], now)[0]!;

    expect(sortTableRows([rowA, legacyRow], "stage", "asc").map((r) => r.application.id)).toEqual([
      "app_legacy",
      "app_a",
    ]);
  });

  it("sorts by days-since-follow-up, always placing rows with no follow-up last", () => {
    const withFollowUp: TableRow = {
      application: makeApplication({ id: "app_followed" }),
      companyName: "A",
      lastFollowUpAt: "2026-09-20T00:00:00.000Z",
      daysSinceFollowUp: 8,
    };
    const noFollowUp: TableRow = {
      application: makeApplication({ id: "app_unfollowed" }),
      companyName: "B",
      lastFollowUpAt: null,
      daysSinceFollowUp: null,
    };
    const olderFollowUp: TableRow = {
      application: makeApplication({ id: "app_old" }),
      companyName: "C",
      lastFollowUpAt: "2026-09-01T00:00:00.000Z",
      daysSinceFollowUp: 27,
    };

    expect(
      sortTableRows([withFollowUp, noFollowUp, olderFollowUp], "daysSinceFollowUp", "asc").map(
        (r) => r.application.id
      )
    ).toEqual(["app_followed", "app_old", "app_unfollowed"]);

    expect(
      sortTableRows([withFollowUp, noFollowUp, olderFollowUp], "daysSinceFollowUp", "desc").map(
        (r) => r.application.id
      )
    ).toEqual(["app_old", "app_followed", "app_unfollowed"]);
  });

  it("does not mutate the input array", () => {
    const rows = [rowA, rowB];
    const copy = [...rows];
    sortTableRows(rows, "company", "asc");
    expect(rows).toEqual(copy);
  });
});
