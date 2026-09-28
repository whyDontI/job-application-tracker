import {
  endActiveSession,
  getActiveSession,
  reassignApplicationSession,
  selectApplicationsForSessionScope,
  startNewSession,
} from "../../core/session.js";
import type { SessionScope } from "../../core/session.js";
import { INITIAL_STAGE } from "../../core/stage.js";
import type { Application, Company, Session } from "../../core/types.js";
import { createChromeRepository } from "../storage/chromeRepository.js";
import { formatStage } from "../stageDisplay.js";

const repository = createChromeRepository();

const UNASSIGNED_VALUE = "__unassigned__";
const ALL_SESSIONS_VALUE = "__all__";

let scope: SessionScope = { kind: "active" };

async function refresh(): Promise<void> {
  const [applications, companies, sessions] = await Promise.all([
    repository.getApplications(),
    repository.getCompanies(),
    repository.getSessions(),
  ]);

  renderSessionControls(sessions);
  renderApplicationList(applications, companies, sessions);
}

function renderSessionControls(sessions: Session[]): void {
  const activeSession = getActiveSession(sessions);
  const archivedSessions = sessions
    .filter((session) => session.endedAt !== null)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  const statusEl = document.getElementById("sessionStatus") as HTMLDivElement;
  statusEl.textContent = activeSession
    ? `Active hunt: ${activeSession.name}`
    : "No active hunt — new applications are untagged until you start one.";

  const endButton = document.getElementById("endSession") as HTMLButtonElement;
  endButton.hidden = !activeSession;

  const picker = document.getElementById("sessionScope") as HTMLSelectElement;
  picker.innerHTML = "";

  if (activeSession) {
    const opt = document.createElement("option");
    opt.value = "active";
    opt.textContent = `Active hunt: ${activeSession.name}`;
    picker.appendChild(opt);
  }
  for (const session of archivedSessions) {
    const opt = document.createElement("option");
    opt.value = session.id;
    opt.textContent = session.name;
    picker.appendChild(opt);
  }
  const allOpt = document.createElement("option");
  allOpt.value = ALL_SESSIONS_VALUE;
  allOpt.textContent = "All Sessions";
  picker.appendChild(allOpt);

  picker.value =
    scope.kind === "active" ? "active" : scope.kind === "all" ? ALL_SESSIONS_VALUE : scope.sessionId;

  // If the previously selected scope no longer resolves to an option (e.g. its
  // session was just ended/started), the browser falls back silently to the
  // first option — normalize `scope` to match what's actually now showing.
  if (picker.value === "active") {
    scope = { kind: "active" };
  } else if (picker.value === ALL_SESSIONS_VALUE) {
    scope = { kind: "all" };
  } else {
    scope = { kind: "session", sessionId: picker.value };
  }
}

function buildSessionReassignSelect(application: Application, sessions: Session[]): HTMLSelectElement {
  const select = document.createElement("select");
  select.className = "reassign-session";

  const unassignedOpt = document.createElement("option");
  unassignedOpt.value = UNASSIGNED_VALUE;
  unassignedOpt.textContent = "Unassigned";
  select.appendChild(unassignedOpt);

  for (const session of sessions) {
    const opt = document.createElement("option");
    opt.value = session.id;
    opt.textContent = session.endedAt === null ? `${session.name} (active)` : session.name;
    select.appendChild(opt);
  }

  select.value = application.sessionId ?? UNASSIGNED_VALUE;

  select.addEventListener("change", () => {
    const sessionId = select.value === UNASSIGNED_VALUE ? null : select.value;
    void repository
      .saveApplication(reassignApplicationSession(application, sessionId))
      .then(refresh);
  });

  return select;
}

function renderApplicationList(
  applications: Application[],
  companies: Company[],
  sessions: Session[]
): void {
  const companyById = new Map(companies.map((company) => [company.id, company]));
  const visibleApplications = selectApplicationsForSessionScope(applications, sessions, scope);

  const list = document.getElementById("list") as HTMLDivElement;
  const empty = document.getElementById("empty") as HTMLParagraphElement;

  list.innerHTML = "";
  empty.hidden = visibleApplications.length > 0;

  for (const application of visibleApplications) {
    const company = companyById.get(application.companyId);
    const latestEvent = application.timelineEvents.at(-1);

    const card = document.createElement("div");
    card.className = "application";

    const companyEl = document.createElement("div");
    companyEl.className = "company";
    companyEl.textContent = company?.name ?? "Unknown company";
    card.appendChild(companyEl);

    const stageEl = document.createElement("div");
    stageEl.className = "stage";
    stageEl.textContent = formatStage(application.stage ?? INITIAL_STAGE);
    card.appendChild(stageEl);

    if (application.joiningLink) {
      const joiningEl = document.createElement("div");
      joiningEl.className = "joining-link";
      const joiningAnchor = document.createElement("a");
      joiningAnchor.href = application.joiningLink;
      joiningAnchor.textContent = "Joining link";
      joiningAnchor.target = "_blank";
      joiningEl.appendChild(joiningAnchor);
      card.appendChild(joiningEl);
    }

    if (latestEvent) {
      const summaryEl = document.createElement("div");
      summaryEl.className = "summary";
      summaryEl.textContent = latestEvent.summary;
      card.appendChild(summaryEl);

      const metaEl = document.createElement("div");
      metaEl.className = "meta";
      const link = document.createElement("a");
      link.href = latestEvent.deepLink;
      link.textContent = "Open thread in Gmail";
      link.target = "_blank";
      metaEl.appendChild(link);
      card.appendChild(metaEl);
    }

    const sessionRow = document.createElement("div");
    sessionRow.className = "session-row";
    const sessionLabel = document.createElement("span");
    sessionLabel.textContent = "Session: ";
    sessionRow.append(sessionLabel, buildSessionReassignSelect(application, sessions));
    card.appendChild(sessionRow);

    list.appendChild(card);
  }
}

function initSessionControls(): void {
  const startButton = document.getElementById("startSession") as HTMLButtonElement;
  const endButton = document.getElementById("endSession") as HTMLButtonElement;
  const picker = document.getElementById("sessionScope") as HTMLSelectElement;

  startButton.addEventListener("click", () => {
    void repository.getSessions().then((sessions) => {
      const activeSession = getActiveSession(sessions);
      if (
        activeSession &&
        !window.confirm(`This will end your current hunt "${activeSession.name}" and start a new one. Continue?`)
      ) {
        return;
      }

      const name = window.prompt("Name this job hunt:", `Job Hunt ${new Date().toLocaleDateString()}`);
      if (!name) return;

      const updatedSessions = startNewSession(sessions, {
        id: crypto.randomUUID(),
        name,
        startedAt: new Date().toISOString(),
      });

      void Promise.all(updatedSessions.map((s) => repository.saveSession(s))).then(() => {
        scope = { kind: "active" };
        void refresh();
      });
    });
  });

  endButton.addEventListener("click", () => {
    if (!window.confirm("End the current hunt? Applications stay exactly where they are.")) return;

    void repository
      .getSessions()
      .then((sessions) => endActiveSession(sessions, new Date().toISOString()))
      .then((updatedSessions) => Promise.all(updatedSessions.map((s) => repository.saveSession(s))))
      .then(() => void refresh());
  });

  picker.addEventListener("change", () => {
    scope =
      picker.value === "active"
        ? { kind: "active" }
        : picker.value === ALL_SESSIONS_VALUE
          ? { kind: "all" }
          : { kind: "session", sessionId: picker.value };
    void refresh();
  });
}

initSessionControls();
void refresh();
