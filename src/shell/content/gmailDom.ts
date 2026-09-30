// Gmail's DOM is unstable and mostly unnamed, so these selectors lean on the
// handful of hooks that have stayed put for years (.hP subject, .a3s message
// body). Expect to revisit these if Gmail changes markup.
//
// We deliberately do NOT inject into Gmail's own toolbar DOM (e.g. `[gh="mtb"]`):
// Gmail's toolbar has overlapping/absolutely-positioned siblings and re-renders
// unpredictably, which made an injected child button unreliable in practice
// (unclickable, or silently detached on re-render). Instead we render our own
// button as a fixed-position overlay appended to document.body, entirely
// outside Gmail's DOM tree, shown only while a thread is open.

export const SUBJECT_SELECTOR = "h2.hP";
export const MESSAGE_BODY_SELECTOR = ".a3s";
export const MENU_BUTTON_ID = "job-tracker-menu-button";
export const MENU_ID = "job-tracker-menu";

export function extractThreadIdFromUrl(): string | null {
  const hash = window.location.hash;
  const match = hash.match(/#[^/]+\/([^/?]+)/);
  return match?.[1] ?? null;
}

export function isThreadOpen(): boolean {
  return extractThreadIdFromUrl() !== null && document.querySelector(SUBJECT_SELECTOR) !== null;
}

export interface ScrapedMessage {
  body: string;
  /** The message's real send/receive time, scraped from Gmail's own timestamp — never tracking-click time. */
  timestamp: string;
}

// The exact full timestamp for a message lives in a `title` attribute
// (Gmail shows only a relative/short date in the visible text) on a `.g3`
// span within that message's row — this is a well-known but unnamed Gmail
// convention, and as fragile as every other selector in this file.
const MESSAGE_TIMESTAMP_SELECTOR = ".g3[title]";
const MESSAGE_ROW_SELECTOR = ".gs, .adn";

function extractMessageTimestamp(bodyEl: Element): string | null {
  const row = bodyEl.closest(MESSAGE_ROW_SELECTOR);
  const title = row?.querySelector(MESSAGE_TIMESTAMP_SELECTOR)?.getAttribute("title");
  if (!title) return null;

  const parsed = new Date(title);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function scrapeOpenThread(): { subject: string; messages: ScrapedMessage[] } | null {
  const subjectEl = document.querySelector(SUBJECT_SELECTOR);
  const bodyEls = document.querySelectorAll(MESSAGE_BODY_SELECTOR);

  if (!subjectEl || bodyEls.length === 0) return null;

  const subject = subjectEl.textContent?.trim() ?? "";
  const messages: ScrapedMessage[] = [];

  for (const bodyEl of bodyEls) {
    const body = bodyEl.textContent?.trim() ?? "";
    if (!body) continue;
    messages.push({ body, timestamp: extractMessageTimestamp(bodyEl) ?? new Date().toISOString() });
  }

  return { subject, messages };
}

/**
 * The single string sent to the AI for extraction — messages are numbered
 * and dated so the model can reference "message 2" in its per-message stage
 * signals, and so a manually-overridden or unparsed timestamp is visible in
 * the text itself rather than silently lost.
 */
export function formatThreadTextForExtraction(subject: string, messages: ScrapedMessage[]): string {
  const messageBlocks = messages.map(
    (message, index) => `--- Message ${index} (${message.timestamp}) ---\n${message.body}`
  );
  return [`Subject: ${subject}`, ...messageBlocks].join("\n\n");
}

export function getGmailAccountIndex(): string {
  return window.location.pathname.match(/\/mail\/u\/(\d+)\//)?.[1] ?? "0";
}

export function getCurrentGmailAccount(accountIndex: string): string {
  const accountEl = document.querySelector(`a[href*="/mail/u/${accountIndex}/"][aria-label*="@"]`);
  return (
    accountEl?.getAttribute("aria-label")?.match(/[\w.+-]+@[\w.-]+/)?.[0] ?? `account-${accountIndex}`
  );
}

export function buildThreadDeepLink(accountIndex: string, threadId: string): string {
  // "#all" locates the thread regardless of which label/view (inbox, sent, etc.) it's under.
  return `https://mail.google.com/mail/u/${accountIndex}/#all/${threadId}`;
}
