const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-sonnet-5";

const EXTRACTION_SYSTEM_PROMPT = `You extract structured job-application data from a Gmail thread.
Respond with ONLY a JSON object of this exact shape, no prose, no markdown fences:
{"companyGuess": {"name": string, "domain": string} | null, "summary": string}

"companyGuess" is your best guess at the employer this thread is about (not an ATS like Greenhouse/Lever/Workday/LinkedIn unless that's genuinely the employer).
Set it to null if you cannot confidently identify an employer.
"summary" is a concise 1-3 sentence summary of what this thread says about the application's status (stage, round, rejection/offer, joining link if present).`;

export async function callClaudeExtraction(apiKey: string, threadText: string): Promise<string> {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [{ role: "user", content: threadText }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic API request failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text?: string }>;
  };

  const textBlock = data.content.find((block) => block.type === "text");
  if (!textBlock?.text) {
    throw new Error("Anthropic API response contained no text content");
  }

  return textBlock.text;
}
