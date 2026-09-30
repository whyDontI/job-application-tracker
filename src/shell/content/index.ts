import {
  appendTimelineEvent,
  applyStageTransitions,
  findApplicationByThreadId,
  foldStageTransitions,
  resolveDatedStageSignals,
} from "../../core/applicationMatching.js";
import { confirmTracking } from "../../core/confirmTracking.js";
import { resolveCompany } from "../../core/companyResolution.js";
import { getActiveSession } from "../../core/session.js";
import { INITIAL_STAGE } from "../../core/stage.js";
import type { TimelineEvent } from "../../core/types.js";
import { createChromeRepository } from "../storage/chromeRepository.js";
import type { ExtractThreadResponse, ExtractThreadRequest } from "../messages.js";
import { showConfirmPanel } from "./confirmPanel.js";
import { makeDraggableEdgeButton } from "./draggableEdgeButton.js";
import {
  MENU_BUTTON_ID,
  MENU_ID,
  buildThreadDeepLink,
  extractThreadIdFromUrl,
  formatThreadTextForExtraction,
  getCurrentGmailAccount,
  getGmailAccountIndex,
  isThreadOpen,
  scrapeOpenThread,
} from "./gmailDom.js";
import { showToast } from "./toast.js";

const repository = createChromeRepository();

function buildTimelineEvent(
  threadId: string,
  accountIndex: string,
  direction: TimelineEvent["direction"],
  summary: string
): TimelineEvent {
  return {
    id: crypto.randomUUID(),
    threadId,
    direction,
    timestamp: new Date().toISOString(),
    summary,
    deepLink: buildThreadDeepLink(accountIndex, threadId),
  };
}

function reportError(context: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[Job Tracker] ${context}:`, error);
  window.alert(`Job Tracker: ${context} (${message})`);
}

async function withBusyLabel(
  button: HTMLButtonElement,
  busyText: string,
  errorContext: string,
  action: () => Promise<void>
): Promise<void> {
  const label = button.querySelector<HTMLElement>(".job-tracker-label") ?? button;
  const originalLabel = label.textContent;
  button.disabled = true;
  label.textContent = busyText;

  try {
    await action();
  } catch (error) {
    reportError(errorContext, error);
  } finally {
    button.disabled = false;
    label.textContent = originalLabel;
  }
}

async function handleTrackClick(button: HTMLButtonElement): Promise<void> {
  await withBusyLabel(button, "Tracking…", "couldn't track this email", async () => {
    const scraped = scrapeOpenThread();
    const threadId = extractThreadIdFromUrl();

    if (!scraped || !threadId) {
      window.alert("Job Tracker: couldn't find an open email thread to track.");
      return;
    }

    const threadText = formatThreadTextForExtraction(scraped.subject, scraped.messages);
    const request: ExtractThreadRequest = { type: "EXTRACT_THREAD", threadText };
    const response = (await chrome.runtime.sendMessage(request)) as ExtractThreadResponse | undefined;

    if (!response) {
      throw new Error(
        "no response from the background worker — try reloading the extension and this Gmail tab"
      );
    }

    if (!response.ok) {
      window.alert(`Job Tracker: ${response.error}`);
      return;
    }

    const accountIndex = getGmailAccountIndex();
    const applications = await repository.getApplications();
    const existingApplication = findApplicationByThreadId(applications, threadId);

    const messageTimestamps = scraped.messages.map((message) => message.timestamp);

    if (existingApplication) {
      const newMessageSignals = resolveDatedStageSignals(
        response.result.stageSignalsByMessage,
        messageTimestamps,
        existingApplication.trackedMessageCount ?? 0
      );
      const newEvent = buildTimelineEvent(threadId, accountIndex, "inbound", response.result.summary);
      let updated = appendTimelineEvent(existingApplication, newEvent, {
        joiningLink: response.result.joiningLink,
      });
      updated = applyStageTransitions(updated, newMessageSignals);
      updated = { ...updated, trackedMessageCount: scraped.messages.length };
      await repository.saveApplication(updated);
      showToast("Job Tracker: added to the existing application's timeline.");
      return;
    }

    const messageSignals = resolveDatedStageSignals(response.result.stageSignalsByMessage, messageTimestamps, 0);
    const companies = await repository.getCompanies();
    const { matchedCompanyId, suggestedName } = resolveCompany(companies, response.result.companyGuess);
    const suggestedStage = foldStageTransitions(INITIAL_STAGE, messageSignals).at(-1)?.stage ?? INITIAL_STAGE;
    const activeSessionId = getActiveSession(await repository.getSessions())?.id ?? null;

    showConfirmPanel({
      extraction: response.result,
      companies,
      suggestedCompanyId: matchedCompanyId,
      suggestedName,
      suggestedStage,
      suggestedJoiningLink: response.result.joiningLink,
      onCancel: () => {},
      onConfirm: async (choice) => {
        const { application, newCompany } = confirmTracking({
          applicationId: crypto.randomUUID(),
          account: getCurrentGmailAccount(accountIndex),
          sessionId: activeSessionId,
          createdAt: new Date().toISOString(),
          companyChoice: choice,
          newCompanyId: crypto.randomUUID(),
          companyGuessDomain: response.result.companyGuess?.domain,
          event: buildTimelineEvent(threadId, accountIndex, "inbound", response.result.summary),
          stage: choice.stage,
          joiningLink: choice.joiningLink,
          messageSignals,
          trackedMessageCount: scraped.messages.length,
        });

        try {
          if (newCompany) {
            await repository.saveCompany(newCompany);
          }
          await repository.saveApplication(application);
          showToast("Job Tracker: application saved.");
        } catch (error) {
          reportError("failed to save", error);
        }
      },
    });
  });
}

async function handleFollowUpClick(button: HTMLButtonElement): Promise<void> {
  await withBusyLabel(button, "Logging…", "couldn't log this follow-up", async () => {
    const threadId = extractThreadIdFromUrl();
    if (!threadId) {
      window.alert("Job Tracker: couldn't find an open email thread to log a follow-up for.");
      return;
    }

    const accountIndex = getGmailAccountIndex();
    const applications = await repository.getApplications();
    const existingApplication = findApplicationByThreadId(applications, threadId);

    if (!existingApplication) {
      window.alert(
        "Job Tracker: no tracked application matches this thread yet — track the original email first."
      );
      return;
    }

    const outboundEvent = buildTimelineEvent(threadId, accountIndex, "outbound", "Follow-up sent");
    const updated = appendTimelineEvent(existingApplication, outboundEvent);
    await repository.saveApplication(updated);
    showToast("Job Tracker: follow-up logged.");
  });
}

const DRAG_HANDLE_STYLE_ID = "job-tracker-drag-handle-style";

function ensureDragHandleStyleInjected(): void {
  if (document.getElementById(DRAG_HANDLE_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = DRAG_HANDLE_STYLE_ID;
  style.textContent = `
    #${MENU_BUTTON_ID} .job-tracker-drag-handle { opacity: 0; transition: opacity 0.15s ease; }
    #${MENU_BUTTON_ID}:hover .job-tracker-drag-handle { opacity: 1; }
  `;
  document.head.appendChild(style);
}

function createDragHandle(): HTMLSpanElement {
  const handle = document.createElement("span");
  handle.className = "job-tracker-drag-handle";
  handle.style.cssText =
    "display:inline-grid;grid-template-columns:repeat(2,3px);grid-auto-rows:3px;gap:2px;margin-right:6px;vertical-align:middle;";
  for (let i = 0; i < 6; i += 1) {
    const dot = document.createElement("span");
    dot.style.cssText = "width:3px;height:3px;border-radius:50%;background:currentColor;";
    handle.appendChild(dot);
  }
  return handle;
}

function createMenuIcon(): SVGSVGElement {
  // Placeholder glyph (a bookmark) until real branding is supplied — see
  // ticket #14. Anything more specific than "this is the tracker" risks
  // implying a logo that doesn't exist yet.
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("fill", "currentColor");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z");
  svg.appendChild(path);
  return svg;
}

function createMenuButton(): HTMLButtonElement {
  ensureDragHandleStyleInjected();

  const button = document.createElement("button");
  button.id = MENU_BUTTON_ID;
  button.type = "button";
  button.setAttribute("aria-label", "Job Tracker");
  // Docked to the right edge, outside Gmail's own DOM tree — see the note in
  // gmailDom.ts on why we don't inject into Gmail's toolbar. Vertically
  // draggable along the edge (see draggableEdgeButton.ts); "top" is set by
  // makeDraggableEdgeButton, not here. A 6-dot grip fades in on hover to
  // signal that the button is draggable, mirroring extensions like Simplify.
  button.style.cssText = [
    "position:fixed",
    "right:0",
    "z-index:2147483647",
    "display:flex",
    "align-items:center",
    "padding:10px 12px",
    "border-radius:8px 0 0 8px",
    "border:1px solid #dadce0",
    "border-right:none",
    "background:#1a73e8",
    "color:#fff",
    "cursor:grab",
    "touch-action:none",
    "box-shadow:-2px 2px 8px rgba(0,0,0,0.25)",
  ].join(";");

  button.append(createDragHandle(), createMenuIcon());
  makeDraggableEdgeButton(button, toggleMenu);
  return button;
}

function getOrCreateMenuButton(): HTMLButtonElement {
  const existing = document.getElementById(MENU_BUTTON_ID) as HTMLButtonElement | null;
  if (existing) return existing;
  const button = createMenuButton();
  document.body.appendChild(button);
  return button;
}

function createMenuItem(labelText: string): HTMLButtonElement {
  const item = document.createElement("button");
  item.type = "button";
  item.textContent = labelText;
  item.style.cssText = [
    "display:block",
    "width:100%",
    "text-align:left",
    "padding:10px 14px",
    "border:none",
    "background:#fff",
    "color:#202124",
    "cursor:pointer",
    "font:inherit",
  ].join(";");
  item.addEventListener("mouseenter", () => {
    if (!item.disabled) item.style.background = "#f1f3f4";
  });
  item.addEventListener("mouseleave", () => {
    item.style.background = "#fff";
  });
  return item;
}

function setMenuItemEnabled(item: HTMLButtonElement, enabled: boolean, disabledReason: string): void {
  item.disabled = !enabled;
  item.style.color = enabled ? "#202124" : "#9aa0a6";
  item.style.cursor = enabled ? "pointer" : "not-allowed";
  item.title = enabled ? "" : disabledReason;
}

let menuOpen = false;
let openMenuRequestId = 0;

function createMenu(): { menu: HTMLDivElement; trackItem: HTMLButtonElement; followUpItem: HTMLButtonElement } {
  const menu = document.createElement("div");
  menu.id = MENU_ID;
  menu.hidden = true;
  menu.style.cssText = [
    "position:fixed",
    "z-index:2147483647",
    "min-width:170px",
    "background:#fff",
    "border:1px solid #dadce0",
    "border-radius:8px",
    "box-shadow:0 4px 16px rgba(0,0,0,0.25)",
    "overflow:hidden",
    "font-family:system-ui,sans-serif",
    "font-size:13px",
  ].join(";");

  const trackItem = createMenuItem("Track Application");
  const followUpItem = createMenuItem("Log Follow-up");
  menu.append(trackItem, followUpItem);
  document.body.appendChild(menu);
  return { menu, trackItem, followUpItem };
}

const menuButton = getOrCreateMenuButton();
const { menu, trackItem, followUpItem } = createMenu();

function closeMenu(): void {
  menuOpen = false;
  menu.hidden = true;
  document.removeEventListener("pointerdown", handleOutsidePointerDown, true);
}

function handleOutsidePointerDown(event: PointerEvent): void {
  const target = event.target as Node | null;
  if (target && (menu.contains(target) || menuButton.contains(target))) return;
  closeMenu();
}

async function openMenu(): Promise<void> {
  const rect = menuButton.getBoundingClientRect();
  menu.style.top = `${rect.top}px`;
  menu.style.right = `${window.innerWidth - rect.left + 8}px`;
  menu.hidden = false;
  menuOpen = true;
  document.addEventListener("pointerdown", handleOutsidePointerDown, true);

  setMenuItemEnabled(followUpItem, false, "");
  const requestId = ++openMenuRequestId;
  const threadId = extractThreadIdFromUrl();
  const applications = threadId ? await repository.getApplications() : [];
  const hasMatch = threadId !== null && findApplicationByThreadId(applications, threadId) !== undefined;
  // Stale if the menu was closed, or reopened again (for the same or a
  // different thread) while this lookup was in flight — only the most
  // recent open() is allowed to settle the item's enabled state.
  if (!menuOpen || requestId !== openMenuRequestId) return;
  setMenuItemEnabled(followUpItem, hasMatch, "Track the original email first");
}

function toggleMenu(): void {
  if (menuOpen) {
    closeMenu();
  } else {
    void openMenu();
  }
}

trackItem.addEventListener("click", () => {
  closeMenu();
  void handleTrackClick(trackItem);
});
followUpItem.addEventListener("click", () => {
  if (followUpItem.disabled) return;
  closeMenu();
  void handleFollowUpClick(followUpItem);
});

function syncButtonVisibility(): void {
  menuButton.style.display = isThreadOpen() ? "block" : "none";
  if (!isThreadOpen()) closeMenu();
}

window.addEventListener("hashchange", syncButtonVisibility);
const observer = new MutationObserver(() => syncButtonVisibility());
observer.observe(document.body, { childList: true, subtree: true });
syncButtonVisibility();
