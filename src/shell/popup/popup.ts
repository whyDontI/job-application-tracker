import { DEFAULT_LLM_CONFIG, LLM_CONFIG_STORAGE_KEY, LLM_PROVIDERS, LLM_PROVIDER_LABELS, type LlmConfig } from "../llmConfig.js";

const providerSelect = document.getElementById("provider") as HTMLSelectElement;
const apiKeyInput = document.getElementById("apiKey") as HTMLInputElement;
const saveButton = document.getElementById("save") as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLDivElement;
const openDashboardButton = document.getElementById("openDashboard") as HTMLButtonElement;

for (const provider of LLM_PROVIDERS) {
  const option = document.createElement("option");
  option.value = provider;
  option.textContent = LLM_PROVIDER_LABELS[provider];
  providerSelect.appendChild(option);
}

async function loadConfig(): Promise<LlmConfig> {
  const stored = await chrome.storage.local.get(LLM_CONFIG_STORAGE_KEY);
  return (stored[LLM_CONFIG_STORAGE_KEY] as LlmConfig | undefined) ?? { ...DEFAULT_LLM_CONFIG, apiKeys: {} };
}

async function saveConfig(config: LlmConfig): Promise<void> {
  await chrome.storage.local.set({ [LLM_CONFIG_STORAGE_KEY]: config });
}

let config: LlmConfig;

async function init(): Promise<void> {
  config = await loadConfig();
  providerSelect.value = config.provider;
  apiKeyInput.value = config.apiKeys[config.provider] ?? "";
  statusEl.textContent = apiKeyInput.value ? "Key loaded." : "";
}

providerSelect.addEventListener("change", () => {
  const provider = providerSelect.value as LlmConfig["provider"];
  apiKeyInput.value = config.apiKeys[provider] ?? "";
  statusEl.textContent = "";
});

saveButton.addEventListener("click", async () => {
  const provider = providerSelect.value as LlmConfig["provider"];
  const value = apiKeyInput.value.trim();
  config = { provider, apiKeys: { ...config.apiKeys, [provider]: value } };
  await saveConfig(config);
  statusEl.textContent = value ? "Saved." : "Cleared.";
});

openDashboardButton.addEventListener("click", () => {
  void chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
});

void init();
