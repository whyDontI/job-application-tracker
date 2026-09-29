import { DEFAULT_LLM_CONFIG, LLM_CONFIG_STORAGE_KEY, LLM_PROVIDERS, LLM_PROVIDER_LABELS, type LlmConfig } from "../llmConfig.js";
import {
  DEFAULT_GHOSTED_THRESHOLD_DAYS,
  GHOSTED_THRESHOLD_STORAGE_KEY,
  isValidGhostedThreshold,
} from "../ghostedConfig.js";

const providerSelect = document.getElementById("provider") as HTMLSelectElement;
const apiKeyInput = document.getElementById("apiKey") as HTMLInputElement;
const saveButton = document.getElementById("save") as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLDivElement;
const openDashboardButton = document.getElementById("openDashboard") as HTMLButtonElement;
const ghostedThresholdInput = document.getElementById("ghostedThreshold") as HTMLInputElement;
const saveGhostedThresholdButton = document.getElementById("saveGhostedThreshold") as HTMLButtonElement;
const ghostedThresholdStatusEl = document.getElementById("ghostedThresholdStatus") as HTMLDivElement;

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

async function loadGhostedThreshold(): Promise<number> {
  const stored = await chrome.storage.local.get(GHOSTED_THRESHOLD_STORAGE_KEY);
  const value = stored[GHOSTED_THRESHOLD_STORAGE_KEY];
  return isValidGhostedThreshold(value) ? value : DEFAULT_GHOSTED_THRESHOLD_DAYS;
}

async function saveGhostedThreshold(days: number): Promise<void> {
  await chrome.storage.local.set({ [GHOSTED_THRESHOLD_STORAGE_KEY]: days });
}

let config: LlmConfig;

async function init(): Promise<void> {
  config = await loadConfig();
  providerSelect.value = config.provider;
  apiKeyInput.value = config.apiKeys[config.provider] ?? "";
  statusEl.textContent = apiKeyInput.value ? "Key loaded." : "";

  ghostedThresholdInput.value = String(await loadGhostedThreshold());
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

saveGhostedThresholdButton.addEventListener("click", async () => {
  const days = Number(ghostedThresholdInput.value);
  if (!isValidGhostedThreshold(days)) {
    ghostedThresholdStatusEl.textContent = "Enter a whole number of days greater than 0.";
    return;
  }
  await saveGhostedThreshold(days);
  ghostedThresholdStatusEl.textContent = "Saved.";
});

openDashboardButton.addEventListener("click", () => {
  void chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
});

void init();
