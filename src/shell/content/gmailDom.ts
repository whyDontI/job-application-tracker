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
export const TRACK_BUTTON_ID = "job-tracker-track-button";

export function extractThreadIdFromUrl(): string | null {
  const hash = window.location.hash;
  const match = hash.match(/#[^/]+\/([^/?]+)/);
  return match?.[1] ?? null;
}

export function isThreadOpen(): boolean {
  return extractThreadIdFromUrl() !== null && document.querySelector(SUBJECT_SELECTOR) !== null;
}

export function scrapeOpenThread(): { subject: string; threadText: string } | null {
  const subjectEl = document.querySelector(SUBJECT_SELECTOR);
  const bodyEls = document.querySelectorAll(MESSAGE_BODY_SELECTOR);

  if (!subjectEl || bodyEls.length === 0) return null;

  const subject = subjectEl.textContent?.trim() ?? "";
  const bodies = [...bodyEls]
    .map((el) => el.textContent?.trim() ?? "")
    .filter((text) => text.length > 0);

  return {
    subject,
    threadText: [`Subject: ${subject}`, ...bodies].join("\n\n---\n\n"),
  };
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
