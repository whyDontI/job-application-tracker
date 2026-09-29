import type { Stage, StageName } from "../core/stage.js";

export const STAGE_LABELS: Record<StageName, string> = {
  applied: "Applied",
  recruiter_screen: "Recruiter Screen",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  ghosted: "Ghosted",
};

export function formatStage(stage: Stage): string {
  return stage.name === "interview"
    ? `${STAGE_LABELS.interview} (Round ${stage.round})`
    : STAGE_LABELS[stage.name];
}
