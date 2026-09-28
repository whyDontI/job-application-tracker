import type { LlmProvider } from "../../llmConfig.js";
import { callAnthropicExtraction } from "./anthropicClient.js";
import { callGeminiExtraction } from "./geminiClient.js";
import { callOpenAiExtraction } from "./openaiClient.js";

export async function callLlmExtraction(
  provider: LlmProvider,
  apiKey: string,
  threadText: string
): Promise<string> {
  switch (provider) {
    case "anthropic":
      return callAnthropicExtraction(apiKey, threadText);
    case "gemini":
      return callGeminiExtraction(apiKey, threadText);
    case "openai":
      return callOpenAiExtraction(apiKey, threadText);
  }
}
