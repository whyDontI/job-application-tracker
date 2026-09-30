import { computeSankeyLayout } from "../../core/sankey.js";
import type { SankeyEdge } from "../../core/sankey.js";
import { STAGE_LABELS } from "../stageDisplay.js";

const WIDTH = 900;
const HEIGHT = 480;
const NODE_WIDTH = 16;
const NODE_GAP = 16;

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] {
  return document.createElementNS("http://www.w3.org/2000/svg", tag);
}

/** Pure DOM rendering only — the layout math lives in core/sankey.ts (computeSankeyLayout) so it's testable without the DOM. */
export function renderSankeyChart(container: HTMLElement, edges: SankeyEdge[]): void {
  container.innerHTML = "";

  const layout = computeSankeyLayout(edges, {
    width: WIDTH,
    height: HEIGHT,
    nodeWidth: NODE_WIDTH,
    nodeGap: NODE_GAP,
  });

  if (!layout) {
    const empty = document.createElement("p");
    empty.textContent = "No stage transitions in this scope yet.";
    empty.style.color = "#888";
    container.appendChild(empty);
    return;
  }

  const svg = svgEl("svg");
  svg.setAttribute("viewBox", `0 0 ${WIDTH} ${HEIGHT}`);
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", `${HEIGHT}`);

  for (const { edge, height, sourceOffset, targetOffset } of layout.links) {
    const source = layout.nodes.get(edge.from)!;
    const target = layout.nodes.get(edge.to)!;

    const x0 = source.x + NODE_WIDTH;
    const y0 = source.y + sourceOffset + height / 2;
    const x1 = target.x;
    const y1 = target.y + targetOffset + height / 2;
    const midX = (x0 + x1) / 2;

    const path = svgEl("path");
    path.setAttribute("d", `M ${x0} ${y0} C ${midX} ${y0}, ${midX} ${y1}, ${x1} ${y1}`);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "#1a73e8");
    path.setAttribute("stroke-opacity", "0.35");
    path.setAttribute("stroke-width", String(height));

    const title = svgEl("title");
    title.textContent = `${STAGE_LABELS[edge.from]} → ${STAGE_LABELS[edge.to]}: ${edge.count}`;
    path.appendChild(title);

    svg.appendChild(path);
  }

  for (const [name, box] of layout.nodes) {
    const rect = svgEl("rect");
    rect.setAttribute("x", String(box.x));
    rect.setAttribute("y", String(box.y));
    rect.setAttribute("width", String(NODE_WIDTH));
    rect.setAttribute("height", String(box.height));
    rect.setAttribute("fill", "#1a73e8");
    svg.appendChild(rect);

    const label = svgEl("text");
    label.setAttribute("x", String(box.x + NODE_WIDTH / 2));
    label.setAttribute("y", String(box.y - 6));
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("font-size", "12");
    label.setAttribute("font-family", "system-ui, sans-serif");
    label.setAttribute("fill", "#202124");
    label.textContent = `${STAGE_LABELS[name]} (${box.value})`;
    svg.appendChild(label);
  }

  container.appendChild(svg);
}
