export const LLM_PROVIDERS = ["anthropic", "gemini", "openai"] as const;
export type LlmProvider = (typeof LLM_PROVIDERS)[number];

export const LLM_PROVIDER_LABELS: Record<LlmProvider, string> = {
  anthropic: "Claude (Anthropic)",
  gemini: "Gemini (Google)",
  openai: "OpenAI",
};

export function isLlmProvider(value: unknown): value is LlmProvider {
  return typeof value === "string" && (LLM_PROVIDERS as readonly string[]).includes(value);
}

export interface LlmConfig {
  provider: LlmProvider;
  apiKeys: Partial<Record<LlmProvider, string>>;
}

export const LLM_CONFIG_STORAGE_KEY = "llmConfig";

export const DEFAULT_LLM_CONFIG: LlmConfig = { provider: "anthropic", apiKeys: {} };
