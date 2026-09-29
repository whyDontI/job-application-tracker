/**
 * The subset of stages the AI is allowed to detect from email text. "Ghosted"
 * is deliberately excluded: it's never inferred automatically, only set via
 * the user's own explicit confirmation (see ghosted.ts's confirmGhosted) —
 * an email never says "you've been ghosted," silence does.
 */
export const AI_DETECTABLE_STAGE_NAMES = [
  "applied",
  "recruiter_screen",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
] as const;

export const STAGE_NAMES = [...AI_DETECTABLE_STAGE_NAMES, "ghosted"] as const;

export type StageName = (typeof STAGE_NAMES)[number];

export type Stage =
  | { name: "applied" }
  | { name: "recruiter_screen" }
  | { name: "interview"; round: number }
  | { name: "offer" }
  | { name: "rejected" }
  | { name: "withdrawn" }
  | { name: "ghosted" };

/**
 * A stage change detected from a single message. `round` is only meaningful
 * alongside `name: "interview"`, and only set when the source explicitly
 * stated a round number (e.g. "second interview") — otherwise omitted, and
 * applyStageSignal infers it by incrementing.
 */
export interface StageSignal {
  name: (typeof AI_DETECTABLE_STAGE_NAMES)[number];
  round?: number;
}

export const INITIAL_STAGE: Stage = { name: "applied" };

type ForwardStageName = "applied" | "recruiter_screen" | "interview" | "offer";

const FORWARD_STAGE_RANK: Record<ForwardStageName, number> = {
  applied: 0,
  recruiter_screen: 1,
  interview: 2,
  offer: 3,
};

export function isTerminal(name: StageName): name is "rejected" | "withdrawn" | "ghosted" {
  return name === "rejected" || name === "withdrawn" || name === "ghosted";
}

/**
 * Enforces the pipeline as an actual state machine, not just a free-form
 * label with a round counter:
 * - Rejected/Withdrawn are reachable as terminal states from any prior stage.
 * - Once terminal, the pipeline has ended: a later non-terminal signal
 *   (e.g. a misclassified message) can't resurrect it.
 * - Forward movement (including skipping stages) is always allowed; moving
 *   backward along Applied → Recruiter Screen → Interview → Offer is not.
 * - Within Interview, the round counter never regresses.
 */
export function applyStageSignal(current: Stage, signal: StageSignal | null): Stage {
  if (!signal) return current;

  if (isTerminal(signal.name)) {
    return { name: signal.name };
  }

  if (isTerminal(current.name)) {
    return current;
  }

  if (signal.name !== "interview") {
    if (FORWARD_STAGE_RANK[signal.name] < FORWARD_STAGE_RANK[current.name]) {
      return current;
    }
    return { name: signal.name };
  }

  if (current.name !== "interview" && FORWARD_STAGE_RANK.interview < FORWARD_STAGE_RANK[current.name]) {
    return current;
  }

  const knownRound = current.name === "interview" ? current.round : 0;

  if (typeof signal.round === "number") {
    return { name: "interview", round: Math.max(signal.round, knownRound) };
  }

  return { name: "interview", round: knownRound + 1 };
}
