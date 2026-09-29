import type { ExtractionResult } from "../../core/extraction.js";
import { AI_DETECTABLE_STAGE_NAMES } from "../../core/stage.js";
import type { Stage, StageName } from "../../core/stage.js";
import type { Company } from "../../core/types.js";
import { STAGE_LABELS } from "../stageDisplay.js";

const CREATE_NEW_VALUE = "__create_new__";

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

  const companySelect = document.createElement("select");
  companySelect.style.cssText = "width:100%;padding:4px;margin-bottom:8px;";
  for (const company of options.companies) {
    const opt = document.createElement("option");
    opt.value = company.id;
    opt.textContent = company.name;
    companySelect.appendChild(opt);
  }
  const createOpt = document.createElement("option");
  createOpt.value = CREATE_NEW_VALUE;
  createOpt.textContent = "+ Create new company";
  companySelect.appendChild(createOpt);

  const hasSuggestedExisting =
    options.suggestedCompanyId !== null &&
    options.companies.some((c) => c.id === options.suggestedCompanyId);
  companySelect.value = hasSuggestedExisting
    ? (options.suggestedCompanyId as string)
    : CREATE_NEW_VALUE;
  overlay.appendChild(companySelect);

  const newNameInput = document.createElement("input");
  newNameInput.type = "text";
  newNameInput.placeholder = "New company name";
  newNameInput.value = options.suggestedName;
  newNameInput.style.cssText = `width:100%;box-sizing:border-box;padding:4px;margin-bottom:10px;display:${
    companySelect.value === CREATE_NEW_VALUE ? "block" : "none"
  };`;
  overlay.appendChild(newNameInput);

  companySelect.addEventListener("change", () => {
    newNameInput.style.display = companySelect.value === CREATE_NEW_VALUE ? "block" : "none";
  });

  const stageLabel = document.createElement("label");
  stageLabel.textContent = "Stage";
  stageLabel.style.cssText = "display:block;margin-bottom:4px;";
  overlay.appendChild(stageLabel);

  const stageSelect = document.createElement("select");
  stageSelect.style.cssText = "width:100%;padding:4px;margin-bottom:8px;";
  for (const name of AI_DETECTABLE_STAGE_NAMES) {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = STAGE_LABELS[name];
    stageSelect.appendChild(opt);
  }
  stageSelect.value = options.suggestedStage.name;
  overlay.appendChild(stageSelect);

  const roundInput = document.createElement("input");
  roundInput.type = "number";
  roundInput.min = "1";
  roundInput.placeholder = "Round number";
  roundInput.value = String(
    options.suggestedStage.name === "interview" ? options.suggestedStage.round : 1
  );
  roundInput.style.cssText = `width:100%;box-sizing:border-box;padding:4px;margin-bottom:8px;display:${
    stageSelect.value === "interview" ? "block" : "none"
  };`;
  overlay.appendChild(roundInput);

  stageSelect.addEventListener("change", () => {
    roundInput.style.display = stageSelect.value === "interview" ? "block" : "none";
  });

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
    const stageName = stageSelect.value as StageName;
    const stage: Stage =
      stageName === "interview"
        ? { name: "interview", round: Math.max(1, Number.parseInt(roundInput.value, 10) || 1) }
        : { name: stageName };

    const choice: ConfirmPanelChoice = {
      ...(companySelect.value === CREATE_NEW_VALUE
        ? { companyId: null, newCompanyName: newNameInput.value.trim() }
        : { companyId: companySelect.value, newCompanyName: null }),
      stage,
      joiningLink: linkInput.value.trim() || null,
    };
    overlay.remove();
    options.onConfirm(choice);
  });

  buttonRow.append(cancelButton, confirmButton);
  overlay.appendChild(buttonRow);

  document.body.appendChild(overlay);
}
