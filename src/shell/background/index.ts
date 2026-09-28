import { parseExtractionResponse } from "../../core/extraction.js";
import { DEFAULT_LLM_CONFIG, LLM_CONFIG_STORAGE_KEY, LLM_PROVIDER_LABELS, type LlmConfig } from "../llmConfig.js";
import type { ExtensionMessage, ExtractThreadResponse } from "../messages.js";
import { callLlmExtraction } from "./llmProviders/index.js";

async function handleExtractThread(threadText: string): Promise<ExtractThreadResponse> {
  const stored = await chrome.storage.local.get(LLM_CONFIG_STORAGE_KEY);
  const config = (stored[LLM_CONFIG_STORAGE_KEY] as LlmConfig | undefined) ?? DEFAULT_LLM_CONFIG;
  const apiKey = config.apiKeys[config.provider];

  if (!apiKey) {
    return {
      ok: false,
      error: `No ${LLM_PROVIDER_LABELS[config.provider]} API key configured. Set one in the extension popup.`,
    };
  }

  try {
    const raw = await callLlmExtraction(config.provider, apiKey, threadText);
    const result = parseExtractionResponse(raw);
    return { ok: true, result };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

console.log("[Job Tracker] background service worker started");

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.type === "EXTRACT_THREAD") {
    handleExtractThread(message.threadText)
      .then(sendResponse)
      .catch((error: unknown) => {
        console.error("[Job Tracker] unexpected error handling EXTRACT_THREAD:", error);
        sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
      });
    return true;
  }
  return false;
});
