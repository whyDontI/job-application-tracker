import type { Stage } from "./stage.js";
import type { Application, StageHistoryEntry } from "./types.js";

/**
 * Every field the dashboard's manual-edit panel lets the user change directly.
 * Deliberately a full replacement, not a partial patch: the edit panel always
 * submits every field at once, so there's no need to distinguish "field
 * omitted" from "field cleared" the way a per-field auto-save control would.
 * `stageHistory` here only ever reorders/redates existing entries — the panel
 * lets the user edit a date, not add or remove a stage the pipeline passed
 * through.
 */
export interface ApplicationEditableFields {
  companyId: string;
  stage: Stage;
  joiningLink: string | null;
  notes: string;
  createdAt: string;
  sessionId: string | null;
  stageHistory: StageHistoryEntry[];
}

export function applyApplicationEdits(
  application: Application,
  edits: ApplicationEditableFields
): Application {
  return { ...application, ...edits };
}
