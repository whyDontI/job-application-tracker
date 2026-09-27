import { appendTimelineEvent, findApplicationByThreadId } from "../../core/applicationMatching.js";
import { confirmTracking } from "../../core/confirmTracking.js";
import { resolveCompany } from "../../core/companyResolution.js";
import type { TimelineEvent } from "../../core/types.js";
import { createChromeRepository } from "../storage/chromeRepository.js";
import type { ExtractThreadResponse, ExtractThreadRequest } from "../messages.js";
import { showConfirmPanel } from "./confirmPanel.js";
import {
  TOOLBAR_SELECTOR,
  TRACK_BUTTON_ID,
  buildThreadDeepLink,
  extractThreadIdFromUrl,
  getCurrentGmailAccount,
  getGmailAccountIndex,
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

async function handleTrackClick(): Promise<void> {
  const scraped = scrapeOpenThread();
  const threadId = extractThreadIdFromUrl();

  if (!scraped || !threadId) {
    window.alert("Job Tracker: couldn't find an open email thread to track.");
    return;
  }

  const request: ExtractThreadRequest = { type: "EXTRACT_THREAD", threadText: scraped.threadText };
  const response = (await chrome.runtime.sendMessage(request)) as ExtractThreadResponse;

  if (!response.ok) {
    window.alert(`Job Tracker: ${response.error}`);
    return;
  }

  const accountIndex = getGmailAccountIndex();
  const applications = await repository.getApplications();
  const existingApplication = findApplicationByThreadId(applications, threadId);

  if (existingApplication) {
    const newEvent = buildInboundEvent(threadId, accountIndex, response.result.summary);
    try {
      await repository.saveApplication(appendTimelineEvent(existingApplication, newEvent));
      showToast("Job Tracker: added to the existing application's timeline.");
    } catch (error) {
      window.alert(`Job Tracker: failed to save (${error instanceof Error ? error.message : error}).`);
    }
    return;
  }

  const companies = await repository.getCompanies();
  const { matchedCompanyId, suggestedName } = resolveCompany(companies, response.result.companyGuess);

  showConfirmPanel({
    extraction: response.result,
    companies,
    suggestedCompanyId: matchedCompanyId,
    suggestedName,
    onCancel: () => {},
    onConfirm: async (choice) => {
      const { application, newCompany } = confirmTracking({
        applicationId: crypto.randomUUID(),
        account: getCurrentGmailAccount(accountIndex),
        sessionId: null,
        createdAt: new Date().toISOString(),
        companyChoice: choice,
        newCompanyId: crypto.randomUUID(),
        companyGuessDomain: response.result.companyGuess?.domain,
        event: buildInboundEvent(threadId, accountIndex, response.result.summary),
      });

      try {
        if (newCompany) {
          await repository.saveCompany(newCompany);
        }
        await repository.saveApplication(application);
      } catch (error) {
        window.alert(`Job Tracker: failed to save (${error instanceof Error ? error.message : error}).`);
      }
    },
  });
}

function createTrackButton(): HTMLButtonElement {
  const button = document.createElement("button");
  button.id = TRACK_BUTTON_ID;
  button.type = "button";
  button.textContent = "Track Application";
  button.style.cssText =
    "margin-left:8px;padding:4px 10px;border-radius:4px;border:1px solid #dadce0;background:#fff;cursor:pointer;font-size:12px;";
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void handleTrackClick();
  });
  return button;
}

function ensureButtonInjected(): void {
  const toolbar = document.querySelector(TOOLBAR_SELECTOR);
  if (!toolbar) return;
  if (toolbar.querySelector(`#${TRACK_BUTTON_ID}`)) return;
  toolbar.appendChild(createTrackButton());
}

const observer = new MutationObserver(() => ensureButtonInjected());
observer.observe(document.body, { childList: true, subtree: true });
ensureButtonInjected();
