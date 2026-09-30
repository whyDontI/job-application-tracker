import { STAGE_NAMES } from "../../core/stage.js";
import type { Stage } from "../../core/stage.js";
import type { Company, Session, StageHistoryEntry } from "../../core/types.js";
import { buildCompanyPicker, readCompanyChoice } from "../companyPicker.js";
import { formatStage } from "../stageDisplay.js";
import { buildStagePicker, readStage } from "../stagePicker.js";

const UNASSIGNED_VALUE = "__unassigned__";

export interface ApplicationEditorFields {
  companyId: string | null;
  stage: Stage;
  joiningLink: string | null;
  notes: string;
  createdAt: string;
  sessionId: string | null;
  stageHistory: StageHistoryEntry[];
}

export interface ApplicationEditorResult {
  companyId: string | null;
  newCompanyName: string | null;
  stage: Stage;
  joiningLink: string | null;
  notes: string;
  createdAt: string;
  sessionId: string | null;
  stageHistory: StageHistoryEntry[];
}

/**
 * The single form behind both "Add Application" and "Edit Application" on
 * the dashboard — the same fields either way, just pre-filled differently
 * and with `onDelete` only wired up when editing an existing record.
 */
export function showApplicationEditor(options: {
  title: string;
  companies: Company[];
  sessions: Session[];
  initial: ApplicationEditorFields;
  onSave: (result: ApplicationEditorResult) => void;
  onCancel: () => void;
  onDelete?: () => void;
}): void {
  const overlay = document.createElement("div");
  overlay.style.cssText =
    "position:fixed;top:16px;right:16px;z-index:999999;width:340px;max-height:calc(100vh - 32px);overflow-y:auto;background:#fff;border:1px solid #ccc;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.2);padding:16px;font-family:system-ui,sans-serif;font-size:13px;color:#202124;";

  const title = document.createElement("div");
  title.textContent = options.title;
  title.style.cssText = "font-weight:600;margin-bottom:10px;";
  overlay.appendChild(title);

  function addLabel(text: string): void {
    const label = document.createElement("label");
    label.textContent = text;
    label.style.cssText = "display:block;margin-bottom:4px;";
    overlay.appendChild(label);
  }

  addLabel("Company");
  const companyPicker = buildCompanyPicker(options.companies, options.initial.companyId, "");
  overlay.append(companyPicker.select, companyPicker.newNameInput);

  addLabel("Stage");
  const stagePicker = buildStagePicker(STAGE_NAMES, options.initial.stage);
  overlay.append(stagePicker.select, stagePicker.roundInput);

  addLabel("Joining/meeting link");
  const linkInput = document.createElement("input");
  linkInput.type = "text";
  linkInput.placeholder = "https://...";
  linkInput.value = options.initial.joiningLink ?? "";
  linkInput.style.cssText = "width:100%;box-sizing:border-box;padding:4px;margin-bottom:8px;";
  overlay.appendChild(linkInput);

  addLabel("Applied on");
  const createdAtInput = document.createElement("input");
  createdAtInput.type = "date";
  createdAtInput.value = options.initial.createdAt.slice(0, 10);
  createdAtInput.style.cssText = "width:100%;box-sizing:border-box;padding:4px;margin-bottom:8px;";
  overlay.appendChild(createdAtInput);

  addLabel("Session");
  const sessionSelect = document.createElement("select");
  sessionSelect.style.cssText = "width:100%;padding:4px;margin-bottom:8px;";
  const unassignedOpt = document.createElement("option");
  unassignedOpt.value = UNASSIGNED_VALUE;
  unassignedOpt.textContent = "Unassigned";
  sessionSelect.appendChild(unassignedOpt);
  for (const session of options.sessions) {
    const opt = document.createElement("option");
    opt.value = session.id;
    opt.textContent = session.endedAt === null ? `${session.name} (active)` : session.name;
    sessionSelect.appendChild(opt);
  }
  sessionSelect.value = options.initial.sessionId ?? UNASSIGNED_VALUE;
  overlay.appendChild(sessionSelect);

  addLabel("Notes");
  const notesInput = document.createElement("textarea");
  notesInput.rows = 3;
  notesInput.value = options.initial.notes;
  notesInput.style.cssText = "width:100%;box-sizing:border-box;padding:4px;margin-bottom:10px;resize:vertical;";
  overlay.appendChild(notesInput);

  addLabel("Stage History");
  const historyDateInputs: HTMLInputElement[] = [];
  if (options.initial.stageHistory.length === 0) {
    const empty = document.createElement("div");
    empty.textContent = "No dated stages yet.";
    empty.style.cssText = "color:#666;margin-bottom:10px;";
    overlay.appendChild(empty);
  } else {
    const historyList = document.createElement("div");
    historyList.style.cssText = "margin-bottom:10px;";
    for (const entry of options.initial.stageHistory) {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;gap:8px;margin-bottom:6px;";

      const label = document.createElement("span");
      label.textContent = formatStage(entry.stage);
      label.style.cssText = "flex:1;font-size:12px;color:#444;";
      row.appendChild(label);

      const dateInput = document.createElement("input");
      dateInput.type = "date";
      dateInput.value = entry.enteredAt.slice(0, 10);
      dateInput.style.cssText = "padding:2px 4px;";
      historyDateInputs.push(dateInput);
      row.appendChild(dateInput);

      historyList.appendChild(row);
    }
    overlay.appendChild(historyList);
  }

  const buttonRow = document.createElement("div");
  buttonRow.style.cssText = "display:flex;gap:8px;justify-content:flex-end;";

  if (options.onDelete) {
    const deleteButton = document.createElement("button");
    deleteButton.textContent = "Delete";
    deleteButton.style.cssText = "color:#b3261e;margin-right:auto;";
    deleteButton.addEventListener("click", () => {
      if (!window.confirm("Delete this application? This can't be undone.")) return;
      overlay.remove();
      options.onDelete?.();
    });
    buttonRow.appendChild(deleteButton);
  }

  const cancelButton = document.createElement("button");
  cancelButton.textContent = "Cancel";
  cancelButton.addEventListener("click", () => {
    overlay.remove();
    options.onCancel();
  });

  const saveButton = document.createElement("button");
  saveButton.textContent = "Save";
  saveButton.addEventListener("click", () => {
    const stageHistory: StageHistoryEntry[] = options.initial.stageHistory.map((entry, i) => ({
      stage: entry.stage,
      enteredAt: new Date(`${historyDateInputs[i]!.value}T00:00:00.000Z`).toISOString(),
    }));

    const result: ApplicationEditorResult = {
      ...readCompanyChoice(companyPicker),
      stage: readStage(stagePicker),
      joiningLink: linkInput.value.trim() || null,
      notes: notesInput.value,
      createdAt: new Date(`${createdAtInput.value}T00:00:00.000Z`).toISOString(),
      sessionId: sessionSelect.value === UNASSIGNED_VALUE ? null : sessionSelect.value,
      stageHistory,
    };
    overlay.remove();
    options.onSave(result);
  });

  buttonRow.append(cancelButton, saveButton);
  overlay.appendChild(buttonRow);

  document.body.appendChild(overlay);
}
