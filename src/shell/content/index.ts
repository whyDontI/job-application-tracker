import { appendTimelineEvent, findApplicationByThreadId } from "../../core/applicationMatching.js";
import { confirmTracking } from "../../core/confirmTracking.js";
import { resolveCompany } from "../../core/companyResolution.js";
import { getActiveSession } from "../../core/session.js";
import { INITIAL_STAGE, applyStageSignal } from "../../core/stage.js";
import type { TimelineEvent } from "../../core/types.js";
import { createChromeRepository } from "../storage/chromeRepository.js";
import type { ExtractThreadResponse, ExtractThreadRequest } from "../messages.js";
import { showConfirmPanel } from "./confirmPanel.js";
import { makeDraggableEdgeButton } from "./draggableEdgeButton.js";
import {
  TRACK_BUTTON_ID,
  buildThreadDeepLink,
  extractThreadIdFromUrl,
  getCurrentGmailAccount,
  getGmailAccountIndex,
  isThreadOpen,
  scrapeOpenThread,
} from "./gmailDom.js";
import { showToast } from "./toast.js";

const repository = createChromeRepository();

function buildInboundEvent(threadId: string, accountIndex: string, summary: string): TimelineEvent {
  return {
    id: crypto.randomUUID(),
    threadId,
    direction: "inbound",
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

async function handleTrackClick(button: HTMLButtonElement): Promise<void> {
  const label = button.querySelector<HTMLElement>(".job-tracker-label") ?? button;
  const originalLabel = label.textContent;
  button.disabled = true;
  label.textContent = "Tracking…";

  try {
    const scraped = scrapeOpenThread();
    const threadId = extractThreadIdFromUrl();

    if (!scraped || !threadId) {
      window.alert("Job Tracker: couldn't find an open email thread to track.");
      return;
    }

    const request: ExtractThreadRequest = { type: "EXTRACT_THREAD", threadText: scraped.threadText };
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

    if (existingApplication) {
      const newEvent = buildInboundEvent(threadId, accountIndex, response.result.summary);
      const updated = appendTimelineEvent(existingApplication, newEvent, {
        stageSignal: response.result.stageSignal,
        joiningLink: response.result.joiningLink,
      });
      await repository.saveApplication(updated);
      showToast("Job Tracker: added to the existing application's timeline.");
      return;
    }

    const companies = await repository.getCompanies();
    const { matchedCompanyId, suggestedName } = resolveCompany(companies, response.result.companyGuess);
    const suggestedStage = applyStageSignal(INITIAL_STAGE, response.result.stageSignal);
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
          event: buildInboundEvent(threadId, accountIndex, response.result.summary),
          stage: choice.stage,
          joiningLink: choice.joiningLink,
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
  } catch (error) {
    reportError("couldn't track this email", error);
  } finally {
    button.disabled = false;
    label.textContent = originalLabel;
  }
}

const DRAG_HANDLE_STYLE_ID = "job-tracker-drag-handle-style";

function ensureDragHandleStyleInjected(): void {
  if (document.getElementById(DRAG_HANDLE_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = DRAG_HANDLE_STYLE_ID;
  style.textContent = `
    #${TRACK_BUTTON_ID} .job-tracker-drag-handle { opacity: 0; transition: opacity 0.15s ease; }
    #${TRACK_BUTTON_ID}:hover .job-tracker-drag-handle { opacity: 1; }
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

function createFloatingButton(): HTMLButtonElement {
  ensureDragHandleStyleInjected();

  const button = document.createElement("button");
  button.id = TRACK_BUTTON_ID;
  button.type = "button";
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
    "font-family:system-ui,sans-serif",
    "font-size:12px",
    "font-weight:600",
    "box-shadow:-2px 2px 8px rgba(0,0,0,0.25)",
  ].join(";");

  const label = document.createElement("span");
  label.className = "job-tracker-label";
  label.textContent = "Track";

  button.append(createDragHandle(), label);
  makeDraggableEdgeButton(button, () => void handleTrackClick(button));
  return button;
}

function getOrCreateFloatingButton(): HTMLButtonElement {
  const existing = document.getElementById(TRACK_BUTTON_ID) as HTMLButtonElement | null;
  if (existing) return existing;
  const button = createFloatingButton();
  document.body.appendChild(button);
  return button;
}

function syncButtonVisibility(): void {
  const button = getOrCreateFloatingButton();
  button.style.display = isThreadOpen() ? "block" : "none";
}

window.addEventListener("hashchange", syncButtonVisibility);
const observer = new MutationObserver(() => syncButtonVisibility());
observer.observe(document.body, { childList: true, subtree: true });
syncButtonVisibility();
