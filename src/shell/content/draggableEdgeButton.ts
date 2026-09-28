const DEFAULT_TOP_STORAGE_KEY = "jobTrackerButtonTop";
const DRAG_THRESHOLD_PX = 5;
const EDGE_MARGIN_PX = 8;

function loadStoredTop(storageKey: string): number | null {
  try {
    const stored = window.localStorage.getItem(storageKey);
    return stored ? Number(stored) : null;
  } catch {
    return null;
  }
}

function storeTop(storageKey: string, top: number): void {
  try {
    window.localStorage.setItem(storageKey, String(top));
  } catch {
    // Per-viewer convenience only — fine to lose on a private window etc.
  }
}

function clampTop(top: number, buttonHeight: number): number {
  const max = Math.max(window.innerHeight - buttonHeight - EDGE_MARGIN_PX, EDGE_MARGIN_PX);
  return Math.min(Math.max(top, EDGE_MARGIN_PX), max);
}

export interface DraggableEdgeButtonOptions {
  /** Lets more than one edge-docked button keep an independent remembered position. */
  storageKey?: string;
  /** Where the button starts (as a fraction of viewport height) before the user ever drags it. */
  defaultTopRatio?: number;
}

/**
 * Docks the button to the right edge of the viewport and makes it draggable
 * vertically along that edge (mirrors the pattern used by extensions like
 * Simplify), persisting the chosen position across page loads. A drag beyond
 * the threshold suppresses the click; a tap under the threshold fires it.
 */
export function makeDraggableEdgeButton(
  button: HTMLButtonElement,
  onClick: () => void,
  options: DraggableEdgeButtonOptions = {}
): void {
  const storageKey = options.storageKey ?? DEFAULT_TOP_STORAGE_KEY;
  const defaultTopRatio = options.defaultTopRatio ?? 0.4;
  const initialTop = clampTop(
    loadStoredTop(storageKey) ?? window.innerHeight * defaultTopRatio,
    button.offsetHeight || 40
  );
  button.style.top = `${initialTop}px`;

  let dragging = false;
  let moved = false;
  let startY = 0;
  let startTop = 0;

  button.addEventListener("pointerdown", (event) => {
    dragging = true;
    moved = false;
    startY = event.clientY;
    startTop = button.getBoundingClientRect().top;
    button.style.cursor = "grabbing";
    button.setPointerCapture(event.pointerId);
  });

  button.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const delta = event.clientY - startY;
    if (Math.abs(delta) > DRAG_THRESHOLD_PX) moved = true;
    button.style.top = `${clampTop(startTop + delta, button.offsetHeight)}px`;
  });

  const endDrag = (event: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    button.style.cursor = "grab";
    button.releasePointerCapture(event.pointerId);
    if (moved) {
      storeTop(storageKey, Number.parseFloat(button.style.top));
    } else {
      onClick();
    }
  };

  button.addEventListener("pointerup", endDrag);
  button.addEventListener("pointercancel", endDrag);
}
