import { API_KEY_STORAGE_KEY } from "../storageKeys.js";

const apiKeyInput = document.getElementById("apiKey") as HTMLInputElement;
const saveButton = document.getElementById("save") as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLDivElement;
const openDashboardButton = document.getElementById("openDashboard") as HTMLButtonElement;

async function loadExistingKey() {
  const stored = await chrome.storage.local.get(API_KEY_STORAGE_KEY);
  const existing = stored[API_KEY_STORAGE_KEY] as string | undefined;
  if (existing) {
    apiKeyInput.value = existing;
    statusEl.textContent = "Key loaded.";
  }
}

saveButton.addEventListener("click", async () => {
  const value = apiKeyInput.value.trim();
  await chrome.storage.local.set({ [API_KEY_STORAGE_KEY]: value });
  statusEl.textContent = value ? "Saved." : "Cleared.";
});

openDashboardButton.addEventListener("click", () => {
  void chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
});

void loadExistingKey();
