import { STAGE_NAMES } from "./stage.js";
import type { StageName } from "./stage.js";
import type { Application, StageHistoryEntry } from "./types.js";

export interface SankeyEdge {
  from: StageName;
  to: StageName;
  count: number;
}

function collapseConsecutiveSameStage(entries: StageHistoryEntry[]): StageHistoryEntry[] {
  const collapsed: StageHistoryEntry[] = [];
  for (const entry of entries) {
    if (collapsed.length === 0 || collapsed[collapsed.length - 1]!.stage.name !== entry.stage.name) {
      collapsed.push(entry);
    }
  }
  return collapsed;
}

/**
 * Transition edges between pipeline stages (stage A → stage B counts),
 * aggregated per company rather than per raw Application record — two
 * separate Application records for the same company (e.g. from two
 * unmerged Gmail threads, a known gap; see #1's "no cross-thread
 * auto-merge" decision) still contribute to one combined progression
 * instead of reading as two disconnected fragments. Interview rounds
 * collapse into a single "interview" node, so two consecutive rounds never
 * produce a same-stage self-loop edge.
 */
export function computeSankeyEdges(applications: Application[]): SankeyEdge[] {
  const historyByCompany = new Map<string, StageHistoryEntry[]>();

  for (const application of applications) {
    const history = application.stageHistory ?? [];
    const existing = historyByCompany.get(application.companyId) ?? [];
    historyByCompany.set(application.companyId, existing.concat(history));
  }

  const edgeCounts = new Map<string, number>();

  for (const history of historyByCompany.values()) {
    const sorted = [...history].sort((a, b) => a.enteredAt.localeCompare(b.enteredAt));
    const timeline = collapseConsecutiveSameStage(sorted);

    for (let i = 0; i < timeline.length - 1; i++) {
      const key = `${timeline[i]!.stage.name}->${timeline[i + 1]!.stage.name}`;
      edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1);
    }
  }

  return [...edgeCounts.entries()].map(([key, count]) => {
    const [from, to] = key.split("->") as [StageName, StageName];
    return { from, to, count };
  });
}

// All non-terminal stages sit in their own pipeline-order column; every
// terminal stage (rejected/withdrawn/ghosted) shares the rightmost column,
// since the pipeline can end there from any prior stage.
const STAGE_COLUMN: Record<StageName, number> = {
  applied: 0,
  recruiter_screen: 1,
  interview: 2,
  offer: 3,
  rejected: 4,
  withdrawn: 4,
  ghosted: 4,
};

export interface SankeyNodeBox {
  x: number;
  y: number;
  height: number;
  value: number;
}

export interface SankeyLinkLayout {
  edge: SankeyEdge;
  height: number;
  sourceOffset: number;
  targetOffset: number;
}

export interface SankeyLayout {
  nodes: Map<StageName, SankeyNodeBox>;
  links: SankeyLinkLayout[];
}

export interface SankeyLayoutOptions {
  width: number;
  height: number;
  nodeWidth: number;
  nodeGap: number;
}

/**
 * A hand-rolled, simplified Sankey layout (no charting library, consistent
 * with this codebase's zero-runtime-dependency convention): pipeline stages
 * are a DAG by construction (forward-only, terminal states reachable from
 * any prior stage — see stage.ts), so columns can be assigned directly from
 * that ordering rather than needing a general graph-layout algorithm.
 * Returns null when there's nothing to lay out.
 */
export function computeSankeyLayout(edges: SankeyEdge[], options: SankeyLayoutOptions): SankeyLayout | null {
  if (edges.length === 0) return null;

  const nodeNames = new Set<StageName>();
  for (const edge of edges) {
    nodeNames.add(edge.from);
    nodeNames.add(edge.to);
  }

  const incoming = new Map<StageName, number>();
  const outgoing = new Map<StageName, number>();
  for (const edge of edges) {
    outgoing.set(edge.from, (outgoing.get(edge.from) ?? 0) + edge.count);
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + edge.count);
  }

  const nodeValue = new Map<StageName, number>();
  for (const name of nodeNames) {
    nodeValue.set(name, Math.max(incoming.get(name) ?? 0, outgoing.get(name) ?? 0));
  }

  const columns = new Map<number, StageName[]>();
  for (const name of STAGE_NAMES) {
    if (!nodeNames.has(name)) continue;
    const column = STAGE_COLUMN[name];
    const names = columns.get(column) ?? [];
    names.push(name);
    columns.set(column, names);
  }

  const columnCount = Math.max(...columns.keys()) + 1;
  const columnGap = (options.width - options.nodeWidth * columnCount) / (columnCount - 1);
  const maxColumnTotal = Math.max(
    ...[...columns.values()].map((names) => names.reduce((sum, name) => sum + nodeValue.get(name)!, 0))
  );
  const maxNodesPerColumn = Math.max(...[...columns.values()].map((names) => names.length));
  const usableHeight = options.height - 40;
  const scale = (usableHeight - options.nodeGap * maxNodesPerColumn) / maxColumnTotal;

  const nodes = new Map<StageName, SankeyNodeBox>();
  for (const [column, names] of columns) {
    let y = 20;
    for (const name of names) {
      const value = nodeValue.get(name)!;
      const height = Math.max(value * scale, 4);
      nodes.set(name, { x: column * (options.nodeWidth + columnGap), y, height, value });
      y += height + options.nodeGap;
    }
  }

  const outCursor = new Map<StageName, number>();
  const inCursor = new Map<StageName, number>();
  const links: SankeyLinkLayout[] = [];

  for (const edge of [...edges].sort((a, b) => STAGE_COLUMN[a.from] - STAGE_COLUMN[b.from])) {
    const height = Math.max(edge.count * scale, 2);
    const sourceOffset = outCursor.get(edge.from) ?? 0;
    const targetOffset = inCursor.get(edge.to) ?? 0;
    outCursor.set(edge.from, sourceOffset + height);
    inCursor.set(edge.to, targetOffset + height);
    links.push({ edge, height, sourceOffset, targetOffset });
  }

  return { nodes, links };
}

export interface DateRange {
  /** Inclusive lower bound on `createdAt`. */
  from?: string;
  /** Inclusive upper bound on `createdAt`. */
  to?: string;
}

/** Narrows applications to those started within `range` — the Sankey diagram's optional date-range filter. */
export function filterApplicationsByStartDate(applications: Application[], range: DateRange): Application[] {
  return applications.filter((application) => {
    if (range.from && application.createdAt < range.from) return false;
    if (range.to && application.createdAt > range.to) return false;
    return true;
  });
}
