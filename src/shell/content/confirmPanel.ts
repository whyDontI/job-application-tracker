import type { ExtractionResult } from "../../core/extraction.js";
import { AI_DETECTABLE_STAGE_NAMES } from "../../core/stage.js";
import type { Stage } from "../../core/stage.js";
import type { Company } from "../../core/types.js";
import { buildCompanyPicker, readCompanyChoice } from "../companyPicker.js";
import { buildStagePicker, readStage } from "../stagePicker.js";

export interface ConfirmPanelChoice {
  companyId: string | null;
  newCompanyName: string | null;
  stage: Stage;
  joiningLink: string | null;
}

export function showConfirmPanel(options: {
  extraction: ExtractionResult;
  companies: Company[];
  suggestedCompanyId: string | null;
  suggestedName: string;
  suggestedStage: Stage;
  suggestedJoiningLink: string | null;
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

  const companyLabel = document.createElement("label");
  companyLabel.textContent = "Company";
  companyLabel.style.cssText = "display:block;margin-bottom:4px;";
  overlay.appendChild(companyLabel);

  const companyPicker = buildCompanyPicker(options.companies, options.suggestedCompanyId, options.suggestedName);
  overlay.append(companyPicker.select, companyPicker.newNameInput);

  const stageLabel = document.createElement("label");
  stageLabel.textContent = "Stage";
  stageLabel.style.cssText = "display:block;margin-bottom:4px;";
  overlay.appendChild(stageLabel);

  const stagePicker = buildStagePicker(AI_DETECTABLE_STAGE_NAMES, options.suggestedStage);
  overlay.append(stagePicker.select, stagePicker.roundInput);

  const linkLabel = document.createElement("label");
  linkLabel.textContent = "Joining/meeting link (optional)";
  linkLabel.style.cssText = "display:block;margin-bottom:4px;";
  overlay.appendChild(linkLabel);

  const linkInput = document.createElement("input");
  linkInput.type = "text";
  linkInput.placeholder = "https://...";
  linkInput.value = options.suggestedJoiningLink ?? "";
  linkInput.style.cssText = "width:100%;box-sizing:border-box;padding:4px;margin-bottom:10px;";
  overlay.appendChild(linkInput);

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
    const choice: ConfirmPanelChoice = {
      ...readCompanyChoice(companyPicker),
      stage: readStage(stagePicker),
      joiningLink: linkInput.value.trim() || null,
    };
    overlay.remove();
    options.onConfirm(choice);
  });

  buttonRow.append(cancelButton, confirmButton);
  overlay.appendChild(buttonRow);

  document.body.appendChild(overlay);
}
