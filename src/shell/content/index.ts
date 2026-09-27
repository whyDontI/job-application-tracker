import { confirmTracking } from "../../core/confirmTracking.js";
import { resolveCompany } from "../../core/companyResolution.js";
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

const repository = createChromeRepository();

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

  const companies = await repository.getCompanies();
  const { matchedCompanyId, suggestedName } = resolveCompany(companies, response.result.companyGuess);
  const accountIndex = getGmailAccountIndex();

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
        event: {
          id: crypto.randomUUID(),
          threadId,
          direction: "inbound",
          timestamp: new Date().toISOString(),
          summary: response.result.summary,
          deepLink: buildThreadDeepLink(accountIndex, threadId),
        },
      });

      if (newCompany) {
        await repository.saveCompany(newCompany);
      }
      await repository.saveApplication(application);
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
