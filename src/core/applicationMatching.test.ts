import { describe, expect, it } from "vitest";
import {
  appendTimelineEvent,
  applyStageTransitions,
  findApplicationByThreadId,
  foldStageTransitions,
  resolveDatedStageSignals,
} from "./applicationMatching.js";
import type { Application, TimelineEvent } from "./types.js";

const existingEvent: TimelineEvent = {
  id: "evt_1",
  threadId: "thread_1",
  direction: "inbound",
  timestamp: "2026-09-28T00:00:00.000Z",
  summary: "Applied for Backend Engineer role.",
  deepLink: "https://mail.google.com/mail/u/0/#all/thread_1",
};

const application: Application = {
  id: "app_1",
  companyId: "co_1",
  account: "nikhil@gmail.com",
  sessionId: null,
  createdAt: "2026-09-28T00:00:00.000Z",
  timelineEvents: [existingEvent],
  stage: { name: "applied" },
  joiningLink: null,
  notes: "",
  stageHistory: [{ stage: { name: "applied" }, enteredAt: "2026-09-28T00:00:00.000Z" }],
  trackedMessageCount: 1,
};

describe("findApplicationByThreadId", () => {
  it("returns the application whose timeline includes a matching threadId", () => {
    expect(findApplicationByThreadId([application], "thread_1")).toBe(application);
  });

  it("returns undefined when no application's timeline has that threadId", () => {
    expect(findApplicationByThreadId([application], "thread_2")).toBeUndefined();
  });

  it("returns undefined for an empty application list", () => {
    expect(findApplicationByThreadId([], "thread_1")).toBeUndefined();
  });
});

describe("appendTimelineEvent", () => {
  it("returns a new application with the event appended, without mutating the original", () => {
    const newEvent: TimelineEvent = {
      id: "evt_2",
      threadId: "thread_1",
      direction: "outbound",
      timestamp: "2026-10-01T00:00:00.000Z",
      summary: "Followed up after a week of silence.",
      deepLink: "https://mail.google.com/mail/u/0/#all/thread_1",
    };

    const updated = appendTimelineEvent(application, newEvent);

    expect(updated.timelineEvents).toEqual([existingEvent, newEvent]);
    expect(application.timelineEvents).toEqual([existingEvent]);
    expect(updated).not.toBe(application);
  });

  it("leaves joiningLink untouched when no updates are given", () => {
    const withLink: Application = { ...application, joiningLink: "https://zoom.us/j/123" };
    const updated = appendTimelineEvent(withLink, existingEvent);
    expect(updated.joiningLink).toBe("https://zoom.us/j/123");
  });

  it("does not touch stage or stageHistory — that's applyStageTransitions' job", () => {
    const updated = appendTimelineEvent(application, existingEvent);
    expect(updated.stage).toEqual(application.stage);
    expect(updated.stageHistory).toEqual(application.stageHistory);
  });

  it("overwrites the joining link when a new one is provided", () => {
    const updated = appendTimelineEvent(application, existingEvent, {
      joiningLink: "https://zoom.us/j/456",
    });
    expect(updated.joiningLink).toBe("https://zoom.us/j/456");
  });

  it("keeps the existing joining link when the update has none", () => {
    const withLink: Application = { ...application, joiningLink: "https://zoom.us/j/123" };
    const updated = appendTimelineEvent(withLink, existingEvent, { joiningLink: null });
    expect(updated.joiningLink).toBe("https://zoom.us/j/123");
  });
});

describe("foldStageTransitions", () => {
  it("returns one entry per genuine stage change, in order", () => {
    const transitions = foldStageTransitions({ name: "applied" }, [
      { stageSignal: { name: "recruiter_screen" }, enteredAt: "2026-09-10T00:00:00.000Z" },
      { stageSignal: { name: "interview" }, enteredAt: "2026-09-15T00:00:00.000Z" },
      { stageSignal: { name: "interview" }, enteredAt: "2026-09-22T00:00:00.000Z" },
    ]);

    expect(transitions).toEqual([
      { stage: { name: "recruiter_screen" }, enteredAt: "2026-09-10T00:00:00.000Z" },
      { stage: { name: "interview", round: 1 }, enteredAt: "2026-09-15T00:00:00.000Z" },
      { stage: { name: "interview", round: 2 }, enteredAt: "2026-09-22T00:00:00.000Z" },
    ]);
  });

  it("skips a message whose signal doesn't move the stage (e.g. a repeat of the same round)", () => {
    const transitions = foldStageTransitions(
      { name: "interview", round: 2 },
      [{ stageSignal: { name: "interview", round: 2 }, enteredAt: "2026-09-20T00:00:00.000Z" }]
    );
    expect(transitions).toEqual([]);
  });

  it("returns an empty list when given no signals", () => {
    expect(foldStageTransitions({ name: "applied" }, [])).toEqual([]);
  });
});

describe("applyStageTransitions", () => {
  it("backfills a dated entry for every stage found in a single catch-up track", () => {
    const updated = applyStageTransitions(application, [
      { stageSignal: { name: "recruiter_screen" }, enteredAt: "2026-09-10T00:00:00.000Z" },
      { stageSignal: { name: "interview", round: 1 }, enteredAt: "2026-09-15T00:00:00.000Z" },
      { stageSignal: { name: "offer" }, enteredAt: "2026-09-25T00:00:00.000Z" },
    ]);

    expect(updated.stage).toEqual({ name: "offer" });
    expect(updated.stageHistory).toEqual([
      { stage: { name: "applied" }, enteredAt: "2026-09-28T00:00:00.000Z" },
      { stage: { name: "recruiter_screen" }, enteredAt: "2026-09-10T00:00:00.000Z" },
      { stage: { name: "interview", round: 1 }, enteredAt: "2026-09-15T00:00:00.000Z" },
      { stage: { name: "offer" }, enteredAt: "2026-09-25T00:00:00.000Z" },
    ]);
  });

  it("leaves stage and stageHistory unchanged when no signal actually moves the stage", () => {
    const updated = applyStageTransitions(application, []);
    expect(updated.stage).toEqual(application.stage);
    expect(updated.stageHistory).toEqual(application.stageHistory);
  });

  it("does not mutate the original application", () => {
    const updated = applyStageTransitions(application, [
      { stageSignal: { name: "offer" }, enteredAt: "2026-09-25T00:00:00.000Z" },
    ]);
    expect(updated).not.toBe(application);
    expect(application.stage).toEqual({ name: "applied" });
  });

  it("defaults a pre-stage-field record (stage/stageHistory missing from storage) to Applied instead of throwing", () => {
    const legacyApplication = { ...application } as Application;
    // @ts-expect-error simulating a record persisted before `stage` existed
    delete legacyApplication.stage;
    // @ts-expect-error simulating a record persisted before `stageHistory` existed
    delete legacyApplication.stageHistory;

    const updated = applyStageTransitions(legacyApplication, [
      { stageSignal: { name: "recruiter_screen" }, enteredAt: "2026-09-10T00:00:00.000Z" },
    ]);

    expect(updated.stage).toEqual({ name: "recruiter_screen" });
    expect(updated.stageHistory).toEqual([{ stage: { name: "recruiter_screen" }, enteredAt: "2026-09-10T00:00:00.000Z" }]);
  });
});

describe("resolveDatedStageSignals", () => {
  const messageTimestamps = [
    "2026-09-01T00:00:00.000Z",
    "2026-09-05T00:00:00.000Z",
    "2026-09-12T00:00:00.000Z",
    "2026-09-20T00:00:00.000Z",
  ];

  it("pairs each signal with its message's real timestamp, sorted by message index", () => {
    const resolved = resolveDatedStageSignals(
      [
        { messageIndex: 2, stageSignal: { name: "interview" } },
        { messageIndex: 0, stageSignal: { name: "applied" } },
      ],
      messageTimestamps,
      0
    );

    expect(resolved).toEqual([
      { stageSignal: { name: "applied" }, enteredAt: "2026-09-01T00:00:00.000Z" },
      { stageSignal: { name: "interview" }, enteredAt: "2026-09-12T00:00:00.000Z" },
    ]);
  });

  it("drops any signal below minMessageIndex — this is what makes a re-track only process new messages", () => {
    const resolved = resolveDatedStageSignals(
      [
        { messageIndex: 1, stageSignal: { name: "recruiter_screen" } },
        { messageIndex: 2, stageSignal: { name: "interview" } },
        { messageIndex: 3, stageSignal: { name: "interview", round: 2 } },
      ],
      messageTimestamps,
      3
    );

    expect(resolved).toEqual([
      { stageSignal: { name: "interview", round: 2 }, enteredAt: "2026-09-20T00:00:00.000Z" },
    ]);
  });

  it("drops a signal whose message index is out of range instead of throwing", () => {
    const resolved = resolveDatedStageSignals(
      [{ messageIndex: 99, stageSignal: { name: "offer" } }],
      messageTimestamps,
      0
    );
    expect(resolved).toEqual([]);
  });

  it("regression: re-resolving a whole re-classified thread against the previous message count no longer re-folds an old implicit-round signal against the already-advanced stage", () => {
    // Reproduces the exact bug found in review: message 2 ("interview", no
    // explicit round) was already folded once (application now at round 1).
    // A re-track re-sends the whole thread and the AI reports messages 1, 2,
    // and the new message 3 ("interview", round 2, explicit) again. Filtering
    // by the previously-tracked count (3) must drop messages 1 and 2 so only
    // message 3's real, correctly-dated signal is folded.
    const alreadyAdvanced: Application = { ...application, stage: { name: "interview", round: 1 } };

    const resolved = resolveDatedStageSignals(
      [
        { messageIndex: 1, stageSignal: { name: "recruiter_screen" } },
        { messageIndex: 2, stageSignal: { name: "interview" } },
        { messageIndex: 3, stageSignal: { name: "interview", round: 2 } },
      ],
      messageTimestamps,
      3
    );
    const updated = applyStageTransitions(alreadyAdvanced, resolved);

    expect(updated.stage).toEqual({ name: "interview", round: 2 });
    expect(updated.stageHistory).toEqual([
      ...alreadyAdvanced.stageHistory,
      { stage: { name: "interview", round: 2 }, enteredAt: "2026-09-20T00:00:00.000Z" },
    ]);
  });
});
