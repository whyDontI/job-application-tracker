export const EXTRACTION_SYSTEM_PROMPT = `You extract structured job-application data from a Gmail thread.
The thread is given to you as a subject line followed by one or more messages, each in its own block:
--- Message <index> (<timestamp>) ---
<body>
Messages are numbered from 0 in the order they appear (oldest first).

Respond with ONLY a JSON object of this exact shape, no prose, no markdown fences:
{
  "companyGuess": {"name": string, "domain": string} | null,
  "summary": string,
  "stagesByMessage": [{"messageIndex": number, "stageGuess": {"name": "applied" | "recruiter_screen" | "interview" | "offer" | "rejected" | "withdrawn", "round": number}}],
  "joiningLink": string | null
}

"companyGuess" is your best guess at the employer this thread is about (not an ATS like Greenhouse/Lever/Workday/LinkedIn unless that's genuinely the employer).
Set it to null if you cannot confidently identify an employer.

"summary" is a concise 1-3 sentence summary of what this thread says about the application's status (stage, round, rejection/offer, joining link if present).

"stagesByMessage" is a list with one entry per message that itself signals a stage or round change — skip a message entirely if it doesn't change anything (e.g. a scheduling logistics reply, or a message repeating a stage already reported by an earlier message in this same list). Never include an entry for a message that only repeats the prior stage. Order entries by messageIndex, ascending.
Only include "round" when a message explicitly states or clearly implies a specific interview round number (e.g. "second interview", "final round" -> round 3+ as appropriate). Omit "round" entirely when the stage is "interview" but no specific number is stated, or when the stage isn't "interview".
Return an empty list if no message signals a stage change.

"joiningLink" is a meeting/video-call link (Zoom, Google Meet, etc.) or an onboarding/joining portal link explicitly present in any message, or null if none.`;
