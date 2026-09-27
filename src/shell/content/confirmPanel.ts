import type { ExtractionResult } from "../../core/extraction.js";
import type { Company } from "../../core/types.js";

const CREATE_NEW_VALUE = "__create_new__";

export interface ConfirmPanelChoice {
  companyId: string | null;
  newCompanyName: string | null;
}

export function showConfirmPanel(options: {
  extraction: ExtractionResult;
  companies: Company[];
  suggestedCompanyId: string | null;
  suggestedName: string;
  onConfirm: (choice: ConfirmPanelChoice) => void;
  onCancel: () => void;
}): void {
  const overlay = document.createElement("div");
  overlay.style.cssText =
    "position:fixed;top:16px;right:16px;z-index:999999;width:320px;background:#fff;border:1px solid #ccc;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.2);padding:16px;font-family:system-ui,sans-serif;font-size:13px;color:#202124;";

  const title = document.createElement("div");
  title.textContent = "Track this application";
  title.style.cssText = "font-weight:600;margin-bottom:8px;";
  overlay.appendChild(title);

  const summary = document.createElement("div");
  summary.textContent = options.extraction.summary;
  summary.style.cssText = "margin-bottom:10px;color:#444;";
  overlay.appendChild(summary);

  const label = document.createElement("label");
  label.textContent = "Company";
  label.style.cssText = "display:block;margin-bottom:4px;";
  overlay.appendChild(label);

  const select = document.createElement("select");
  select.style.cssText = "width:100%;padding:4px;margin-bottom:8px;";
  for (const company of options.companies) {
    const opt = document.createElement("option");
    opt.value = company.id;
    opt.textContent = company.name;
    select.appendChild(opt);
  }
  const createOpt = document.createElement("option");
  createOpt.value = CREATE_NEW_VALUE;
  createOpt.textContent = "+ Create new company";
  select.appendChild(createOpt);

  const hasSuggestedExisting =
    options.suggestedCompanyId !== null &&
    options.companies.some((c) => c.id === options.suggestedCompanyId);
  select.value = hasSuggestedExisting ? (options.suggestedCompanyId as string) : CREATE_NEW_VALUE;
  overlay.appendChild(select);

  const newNameInput = document.createElement("input");
  newNameInput.type = "text";
  newNameInput.placeholder = "New company name";
  newNameInput.value = options.suggestedName;
  newNameInput.style.cssText = `width:100%;box-sizing:border-box;padding:4px;margin-bottom:10px;display:${
    select.value === CREATE_NEW_VALUE ? "block" : "none"
  };`;
  overlay.appendChild(newNameInput);

  select.addEventListener("change", () => {
    newNameInput.style.display = select.value === CREATE_NEW_VALUE ? "block" : "none";
  });

  const buttonRow = document.createElement("div");
  buttonRow.style.cssText = "display:flex;gap:8px;justify-content:flex-end;";

  const cancelButton = document.createElement("button");
  cancelButton.textContent = "Cancel";
  cancelButton.addEventListener("click", () => {
    overlay.remove();
    options.onCancel();
  });

  const confirmButton = document.createElement("button");
  confirmButton.textContent = "Save";
  confirmButton.addEventListener("click", () => {
    const choice: ConfirmPanelChoice =
      select.value === CREATE_NEW_VALUE
        ? { companyId: null, newCompanyName: newNameInput.value.trim() }
        : { companyId: select.value, newCompanyName: null };
    overlay.remove();
    options.onConfirm(choice);
  });

  buttonRow.append(cancelButton, confirmButton);
  overlay.appendChild(buttonRow);

  document.body.appendChild(overlay);
}
