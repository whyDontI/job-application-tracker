import type { MessageStageSignal } from "./extraction.js";
import { INITIAL_STAGE, applyStageSignal, stagesEqual } from "./stage.js";
import type { Stage, StageSignal } from "./stage.js";
import type { Application, StageHistoryEntry, TimelineEvent } from "./types.js";

/**
 * Matches deterministically on Gmail's own threadId — never by company name
 * or other fuzzy signals. A thread with no match always means a new
 * application; cross-thread merging is out of scope by design.
 */
export function findApplicationByThreadId(
  applications: Application[],
  threadId: string
): Application | undefined {
  return applications.find((application) =>
    application.timelineEvents.some((event) => event.threadId === threadId)
  );
}

export interface AppendTimelineEventUpdates {
  /** Overwrites the stored joining link when present; a null/omitted value keeps whatever was already stored. */
  joiningLink?: string | null;
}

/**
 * Records that a message was tracked. Stage progression is a separate
 * concern (see applyStageTransitions) — a thread can be re-tracked purely to
 * log a new message without necessarily moving the pipeline forward.
 */
export function appendTimelineEvent(
  application: Application,
  event: TimelineEvent,
  updates: AppendTimelineEventUpdates = {}
): Application {
  return {
    ...application,
    timelineEvents: [...application.timelineEvents, event],
    joiningLink: updates.joiningLink ?? application.joiningLink ?? null,
  };
}

export interface DatedStageSignal {
  stageSignal: StageSignal;
  /** The source message's real timestamp, not tracking-click time. */
  enteredAt: string;
}

/**
 * Folds a sequence of per-message stage signals through the state machine in
 * order, starting from `startingStage`, returning one entry per point where
 * the stage actually changed — skips a message with no signal and never
 * records the same stage twice in a row (e.g. two messages both confirming
 * "still interview round 2").
 */
export function foldStageTransitions(
  startingStage: Stage,
  signals: DatedStageSignal[]
): StageHistoryEntry[] {
  const entries: StageHistoryEntry[] = [];
  let stage = startingStage;

  for (const { stageSignal, enteredAt } of signals) {
    const next = applyStageSignal(stage, stageSignal);
    if (!stagesEqual(next, stage)) {
      entries.push({ stage: next, enteredAt });
    }
    stage = next;
  }

  return entries;
}

/**
 * Pairs the AI's per-message stage signals back up with the real timestamp
 * of the message each one came from, ordering by message index. Drops
 * anything below `minMessageIndex` — the AI re-classifies the WHOLE thread
 * on every track, so without this, re-tracking would re-fold already-applied
 * messages against the stage they already advanced past, corrupting round
 * numbers and dates. An out-of-range index (a malformed AI response) is also
 * dropped rather than throwing.
 */
export function resolveDatedStageSignals(
  signals: MessageStageSignal[],
  messageTimestamps: string[],
  minMessageIndex: number
): DatedStageSignal[] {
  return [...signals]
    .filter((signal) => signal.messageIndex >= minMessageIndex)
    .sort((a, b) => a.messageIndex - b.messageIndex)
    .flatMap((signal) => {
      const timestamp = messageTimestamps[signal.messageIndex];
      return timestamp ? [{ stageSignal: signal.stageSignal, enteredAt: timestamp }] : [];
    });
}

/**
 * Applies a batch of per-message stage signals to an application, advancing
 * `stage` to wherever the fold ends up and appending one dated stageHistory
 * entry per genuine transition along the way — this is what lets a single
 * "catch-up" track on a thread already containing several stage-progression
 * messages backfill a dated entry for every stage found, not just the final
 * one. Also heals a legacy record missing `stage`/`stageHistory`, same as
 * appendTimelineEvent used to for `stage` alone.
 */
export function applyStageTransitions(application: Application, signals: DatedStageSignal[]): Application {
  const currentStage = application.stage ?? INITIAL_STAGE;
  const newEntries = foldStageTransitions(currentStage, signals);

  return {
    ...application,
    stage: newEntries.at(-1)?.stage ?? currentStage,
    stageHistory: [...(application.stageHistory ?? []), ...newEntries],
  };
}
