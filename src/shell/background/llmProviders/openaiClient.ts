import { EXTRACTION_SYSTEM_PROMPT } from "./prompt.js";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
// Pin to a specific, cheap chat-completions model. Revisit as OpenAI's catalog evolves.
const OPENAI_MODEL = "gpt-4o-mini";

export async function callOpenAiExtraction(apiKey: string, threadText: string): Promise<string> {
  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
        { role: "user", content: threadText },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI API request failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error("OpenAI API response contained no text content");
  }

  return text;
}
