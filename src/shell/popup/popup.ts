import { createBackupFromRepository, parseBackup, restoreBackup, serializeBackup } from "../../core/backup.js";
import { DEFAULT_LLM_CONFIG, LLM_CONFIG_STORAGE_KEY, LLM_PROVIDERS, LLM_PROVIDER_LABELS, type LlmConfig } from "../llmConfig.js";
import {
  DEFAULT_GHOSTED_THRESHOLD_DAYS,
  GHOSTED_THRESHOLD_STORAGE_KEY,
  isValidGhostedThreshold,
} from "../ghostedConfig.js";
import { createChromeRepository } from "../storage/chromeRepository.js";

const repository = createChromeRepository();

const providerSelect = document.getElementById("provider") as HTMLSelectElement;
const apiKeyInput = document.getElementById("apiKey") as HTMLInputElement;
const saveButton = document.getElementById("save") as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLDivElement;
const openDashboardButton = document.getElementById("openDashboard") as HTMLButtonElement;
const ghostedThresholdInput = document.getElementById("ghostedThreshold") as HTMLInputElement;
const saveGhostedThresholdButton = document.getElementById("saveGhostedThreshold") as HTMLButtonElement;
const ghostedThresholdStatusEl = document.getElementById("ghostedThresholdStatus") as HTMLDivElement;
const exportBackupButton = document.getElementById("exportBackup") as HTMLButtonElement;
const importBackupInput = document.getElementById("importBackup") as HTMLInputElement;
const backupStatusEl = document.getElementById("backupStatus") as HTMLDivElement;

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

exportBackupButton.addEventListener("click", async () => {
  const backup = await createBackupFromRepository(repository, new Date().toISOString());
  const blob = new Blob([serializeBackup(backup)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `job-tracker-backup-${backup.exportedAt.slice(0, 10)}.json`;
  link.click();

  URL.revokeObjectURL(url);
  backupStatusEl.textContent = `Exported ${backup.applications.length} applications, ${backup.companies.length} companies, ${backup.sessions.length} sessions.`;
});

importBackupInput.addEventListener("change", async () => {
  const file = importBackupInput.files?.[0];
  importBackupInput.value = "";
  if (!file) return;

  let backup;
  try {
    backup = parseBackup(await file.text());
  } catch (error) {
    backupStatusEl.textContent = `Import failed: ${error instanceof Error ? error.message : String(error)}`;
    return;
  }

  const confirmed = window.confirm(
    `This will replace ALL current data with the backup from ${new Date(backup.exportedAt).toLocaleString()} ` +
      `(${backup.applications.length} applications, ${backup.companies.length} companies, ${backup.sessions.length} sessions). This can't be undone. Continue?`
  );
  if (!confirmed) return;

  try {
    await restoreBackup(repository, backup);
    backupStatusEl.textContent = "Import complete.";
  } catch (error) {
    backupStatusEl.textContent = `Import failed partway through: ${error instanceof Error ? error.message : String(error)}`;
  }
});

openDashboardButton.addEventListener("click", () => {
  void chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
});

void init();
