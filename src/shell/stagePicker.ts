import type { Stage, StageName } from "../core/stage.js";
import { STAGE_LABELS } from "./stageDisplay.js";

export interface StagePickerElements {
  select: HTMLSelectElement;
  roundInput: HTMLInputElement;
}

/**
 * The stage-select-plus-round-number control shared by the confirm panel
 * (tracking a new email) and the dashboard's application editor (manual
 * add/edit) — same shape, different callers, and a different allowed set of
 * stage names per caller (e.g. the confirm panel excludes "ghosted").
 */
export function buildStagePicker(stageNames: readonly StageName[], initialStage: Stage): StagePickerElements {
  const select = document.createElement("select");
  select.style.cssText = "width:100%;padding:4px;margin-bottom:8px;";
  for (const name of stageNames) {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = STAGE_LABELS[name];
    select.appendChild(opt);
  }
  select.value = initialStage.name;

  const roundInput = document.createElement("input");
  roundInput.type = "number";
  roundInput.min = "1";
  roundInput.placeholder = "Round number";
  roundInput.value = String(initialStage.name === "interview" ? initialStage.round : 1);
  roundInput.style.cssText = `width:100%;box-sizing:border-box;padding:4px;margin-bottom:8px;display:${
    select.value === "interview" ? "block" : "none"
  };`;

  select.addEventListener("change", () => {
    roundInput.style.display = select.value === "interview" ? "block" : "none";
  });

  return { select, roundInput };
}

export function readStage(elements: StagePickerElements): Stage {
  const stageName = elements.select.value as StageName;
  return stageName === "interview"
    ? { name: "interview", round: Math.max(1, Number.parseInt(elements.roundInput.value, 10) || 1) }
    : { name: stageName };
}
