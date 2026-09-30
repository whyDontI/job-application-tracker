import { describe, expect, it } from "vitest";
import { computeSankeyEdges, computeSankeyLayout, filterApplicationsByStartDate } from "./sankey.js";
import type { SankeyEdge } from "./sankey.js";
import type { Application, StageHistoryEntry } from "./types.js";

function makeApplication(overrides: Partial<Application>): Application {
  return {
    id: "app_1",
    companyId: "co_1",
    account: "nikhil@gmail.com",
    sessionId: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    timelineEvents: [],
    stage: { name: "applied" },
    joiningLink: null,
    notes: "",
    stageHistory: [],
    trackedMessageCount: 0,
    ...overrides,
  };
}

function history(...entries: [string, string][]): StageHistoryEntry[] {
  return entries.map(([name, enteredAt]) => ({ stage: { name } as never, enteredAt }));
}

describe("computeSankeyEdges", () => {
  it("returns one edge per consecutive stage transition in an application's own history", () => {
    const application = makeApplication({
      stageHistory: history(
        ["applied", "2026-09-01T00:00:00.000Z"],
        ["recruiter_screen", "2026-09-05T00:00:00.000Z"],
        ["offer", "2026-09-20T00:00:00.000Z"]
      ),
    });

    expect(computeSankeyEdges([application])).toEqual([
      { from: "applied", to: "recruiter_screen", count: 1 },
      { from: "recruiter_screen", to: "offer", count: 1 },
    ]);
  });

  it("sums counts across multiple applications making the same transition", () => {
    const applications = [
      makeApplication({
        id: "app_1",
        companyId: "co_1",
        stageHistory: history(["applied", "2026-09-01T00:00:00.000Z"], ["rejected", "2026-09-05T00:00:00.000Z"]),
      }),
      makeApplication({
        id: "app_2",
        companyId: "co_2",
        stageHistory: history(["applied", "2026-09-02T00:00:00.000Z"], ["rejected", "2026-09-06T00:00:00.000Z"]),
      }),
    ];

    expect(computeSankeyEdges(applications)).toEqual([{ from: "applied", to: "rejected", count: 2 }]);
  });

  it("does not produce a self-loop edge between two interview rounds (collapsed to one Interview node)", () => {
    const application = makeApplication({
      stageHistory: history(
        ["applied", "2026-09-01T00:00:00.000Z"],
        ["interview", "2026-09-05T00:00:00.000Z"],
        ["interview", "2026-09-12T00:00:00.000Z"],
        ["offer", "2026-09-20T00:00:00.000Z"]
      ),
    });

    expect(computeSankeyEdges([application])).toEqual([
      { from: "applied", to: "interview", count: 1 },
      { from: "interview", to: "offer", count: 1 },
    ]);
  });

  it("merges two Application records for the same company into one combined timeline before computing edges", () => {
    // Two separate threads for the same company (a known cross-thread
    // duplicate, out of scope to fix at the data level) — one only ever
    // shows Applied, the other only shows Interview. Grouped by company,
    // they should read as one combined Applied -> Interview progression.
    const applications = [
      makeApplication({
        id: "app_1",
        companyId: "co_1",
        stageHistory: history(["applied", "2026-09-01T00:00:00.000Z"]),
      }),
      makeApplication({
        id: "app_2",
        companyId: "co_1",
        stageHistory: history(["interview", "2026-09-10T00:00:00.000Z"]),
      }),
    ];

    expect(computeSankeyEdges(applications)).toEqual([{ from: "applied", to: "interview", count: 1 }]);
  });

  it("orders a company's merged timeline by enteredAt, not by which application record it came from", () => {
    const applications = [
      makeApplication({
        id: "app_2",
        companyId: "co_1",
        stageHistory: history(["interview", "2026-09-10T00:00:00.000Z"]),
      }),
      makeApplication({
        id: "app_1",
        companyId: "co_1",
        stageHistory: history(["applied", "2026-09-01T00:00:00.000Z"]),
      }),
    ];

    expect(computeSankeyEdges(applications)).toEqual([{ from: "applied", to: "interview", count: 1 }]);
  });

  it("returns no edges for an application with only one (or zero) stageHistory entries", () => {
    const single = makeApplication({ stageHistory: history(["applied", "2026-09-01T00:00:00.000Z"]) });
    const empty = makeApplication({ id: "app_2", stageHistory: [] });
    expect(computeSankeyEdges([single, empty])).toEqual([]);
  });

  it("treats a missing stageHistory (legacy record) as an empty history rather than throwing", () => {
    const legacy = makeApplication({});
    // @ts-expect-error simulating a record persisted before stageHistory existed
    delete legacy.stageHistory;
    expect(() => computeSankeyEdges([legacy])).not.toThrow();
    expect(computeSankeyEdges([legacy])).toEqual([]);
  });
});

describe("filterApplicationsByStartDate", () => {
  const early = makeApplication({ id: "app_early", createdAt: "2026-08-01T00:00:00.000Z" });
  const mid = makeApplication({ id: "app_mid", createdAt: "2026-09-01T00:00:00.000Z" });
  const late = makeApplication({ id: "app_late", createdAt: "2026-10-01T00:00:00.000Z" });
  const applications = [early, mid, late];

  it("returns every application when no range is given", () => {
    expect(filterApplicationsByStartDate(applications, {})).toEqual(applications);
  });

  it("excludes applications created before 'from'", () => {
    expect(filterApplicationsByStartDate(applications, { from: "2026-09-01T00:00:00.000Z" })).toEqual([mid, late]);
  });

  it("excludes applications created after 'to'", () => {
    expect(filterApplicationsByStartDate(applications, { to: "2026-09-01T00:00:00.000Z" })).toEqual([early, mid]);
  });

  it("applies both bounds together", () => {
    expect(
      filterApplicationsByStartDate(applications, {
        from: "2026-08-15T00:00:00.000Z",
        to: "2026-09-15T00:00:00.000Z",
      })
    ).toEqual([mid]);
  });
});

describe("computeSankeyLayout", () => {
  const layoutOptions = { width: 900, height: 480, nodeWidth: 16, nodeGap: 16 };

  it("returns null when there are no edges to lay out", () => {
    expect(computeSankeyLayout([], layoutOptions)).toBeNull();
  });

  it("places each stage in its pipeline-order column, with all terminal stages sharing the last column", () => {
    const edges: SankeyEdge[] = [
      { from: "applied", to: "recruiter_screen", count: 3 },
      { from: "recruiter_screen", to: "rejected", count: 1 },
      { from: "recruiter_screen", to: "withdrawn", count: 1 },
    ];

    const layout = computeSankeyLayout(edges, layoutOptions)!;

    const appliedX = layout.nodes.get("applied")!.x;
    const screenX = layout.nodes.get("recruiter_screen")!.x;
    const rejectedX = layout.nodes.get("rejected")!.x;
    const withdrawnX = layout.nodes.get("withdrawn")!.x;

    expect(appliedX).toBeLessThan(screenX);
    expect(screenX).toBeLessThan(rejectedX);
    expect(rejectedX).toBe(withdrawnX);
  });

  it("sizes each node by the larger of its total incoming or outgoing flow", () => {
    const edges: SankeyEdge[] = [
      { from: "applied", to: "recruiter_screen", count: 4 },
      { from: "recruiter_screen", to: "interview", count: 3 },
      { from: "recruiter_screen", to: "rejected", count: 1 },
    ];

    const layout = computeSankeyLayout(edges, layoutOptions)!;

    expect(layout.nodes.get("applied")!.value).toBe(4);
    expect(layout.nodes.get("recruiter_screen")!.value).toBe(4);
    expect(layout.nodes.get("interview")!.value).toBe(3);
  });

  it("stacks multiple links leaving or entering the same node without overlapping offsets", () => {
    const edges: SankeyEdge[] = [
      { from: "recruiter_screen", to: "interview", count: 2 },
      { from: "recruiter_screen", to: "rejected", count: 1 },
    ];

    const layout = computeSankeyLayout(edges, layoutOptions)!;
    const [first, second] = layout.links;

    expect(first!.sourceOffset).toBe(0);
    expect(second!.sourceOffset).toBe(first!.height);
  });
});
