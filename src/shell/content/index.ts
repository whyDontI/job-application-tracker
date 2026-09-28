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
import type { DraggableEdgeButtonOptions } from "./draggableEdgeButton.js";
import {
  FOLLOWUP_BUTTON_ID,
  TRACK_BUTTON_ID,
  buildThreadDeepLink,
  extractThreadIdFromUrl,
  getCurrentGmailAccount,
  getGmailAccountIndex,
  isSentThreadOpen,
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
      const newEvent = buildTimelineEvent(threadId, accountIndex, "inbound", response.result.summary);
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
          event: buildTimelineEvent(threadId, accountIndex, "inbound", response.result.summary),
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
  style.textContent = [TRACK_BUTTON_ID, FOLLOWUP_BUTTON_ID]
    .map(
      (id) =>
        `#${id} .job-tracker-drag-handle { opacity: 0; transition: opacity 0.15s ease; }
         #${id}:hover .job-tracker-drag-handle { opacity: 1; }`
    )
    .join("\n");
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

function createFloatingButton(
  id: string,
  labelText: string,
  onClick: (button: HTMLButtonElement) => void,
  dragOptions: DraggableEdgeButtonOptions
): HTMLButtonElement {
  ensureDragHandleStyleInjected();

  const button = document.createElement("button");
  button.id = id;
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
  label.textContent = labelText;

  button.append(createDragHandle(), label);
  makeDraggableEdgeButton(button, () => onClick(button), dragOptions);
  return button;
}

function getOrCreateButton(
  id: string,
  labelText: string,
  onClick: (button: HTMLButtonElement) => void,
  dragOptions: DraggableEdgeButtonOptions
): HTMLButtonElement {
  const existing = document.getElementById(id) as HTMLButtonElement | null;
  if (existing) return existing;
  const button = createFloatingButton(id, labelText, onClick, dragOptions);
  document.body.appendChild(button);
  return button;
}

function syncButtonVisibility(): void {
  const trackButton = getOrCreateButton(TRACK_BUTTON_ID, "Track", (button) => void handleTrackClick(button), {});
  trackButton.style.display = isThreadOpen() ? "block" : "none";

  const followUpButton = getOrCreateButton(
    FOLLOWUP_BUTTON_ID,
    "Log Follow-up",
    (button) => void handleFollowUpClick(button),
    { storageKey: "jobTrackerFollowUpButtonTop", defaultTopRatio: 0.55 }
  );
  followUpButton.style.display = isSentThreadOpen() ? "block" : "none";
}

window.addEventListener("hashchange", syncButtonVisibility);
const observer = new MutationObserver(() => syncButtonVisibility());
observer.observe(document.body, { childList: true, subtree: true });
syncButtonVisibility();
