import { parseExtractionResponse } from "../../core/extraction.js";
import type { ExtensionMessage, ExtractThreadResponse } from "../messages.js";
import { API_KEY_STORAGE_KEY } from "../storageKeys.js";
import { callClaudeExtraction } from "./anthropicClient.js";

async function handleExtractThread(threadText: string): Promise<ExtractThreadResponse> {
  const stored = await chrome.storage.local.get(API_KEY_STORAGE_KEY);
  const apiKey = stored[API_KEY_STORAGE_KEY] as string | undefined;

  if (!apiKey) {
    return { ok: false, error: "No Claude API key configured. Set one in the extension popup." };
  }

  try {
    const raw = await callClaudeExtraction(apiKey, threadText);
    const result = parseExtractionResponse(raw);
    return { ok: true, result };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.type === "EXTRACT_THREAD") {
    handleExtractThread(message.threadText).then(sendResponse);
    return true;
  }
  return false;
});
