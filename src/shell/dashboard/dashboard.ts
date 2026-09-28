import { groupApplicationsByStage } from "../../core/board.js";
import {
  endActiveSession,
  getActiveSession,
  reassignApplicationSession,
  selectApplicationsForSessionScope,
  startNewSession,
} from "../../core/session.js";
import type { SessionScope } from "../../core/session.js";
import { INITIAL_STAGE } from "../../core/stage.js";
import { buildTableRows, sortTableRows } from "../../core/table.js";
import type { SortDirection, TableSortKey } from "../../core/table.js";
import type { Application, Company, Session } from "../../core/types.js";
import {
  DASHBOARD_VIEW_STORAGE_KEY,
  DEFAULT_DASHBOARD_VIEW,
  isDashboardView,
} from "../dashboardViewConfig.js";
import type { DashboardView } from "../dashboardViewConfig.js";
import { createChromeRepository } from "../storage/chromeRepository.js";
import { formatStage, STAGE_LABELS } from "../stageDisplay.js";

const repository = createChromeRepository();

const UNASSIGNED_VALUE = "__unassigned__";
const ALL_SESSIONS_VALUE = "__all__";

const SORT_HEADER_LABELS: Record<TableSortKey, string> = {
  company: "Company",
  stage: "Stage",
  daysSinceFollowUp: "Days Since Follow-up",
};

let scope: SessionScope = { kind: "active" };
let currentView: DashboardView = DEFAULT_DASHBOARD_VIEW;
let tableSort: { key: TableSortKey; direction: SortDirection } = { key: "company", direction: "asc" };

async function refresh(): Promise<void> {
  const [applications, companies, sessions] = await Promise.all([
    repository.getApplications(),
    repository.getCompanies(),
    repository.getSessions(),
  ]);

  renderSessionControls(sessions);
  renderViews(applications, companies, sessions);
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

function buildApplicationCard(
  application: Application,
  company: Company | undefined,
  sessions: Session[]
): HTMLDivElement {
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

  return card;
}

function renderBoard(visibleApplications: Application[], companies: Company[], sessions: Session[]): void {
  const companyById = new Map(companies.map((company) => [company.id, company]));
  const board = document.getElementById("board") as HTMLDivElement;
  board.innerHTML = "";

  for (const column of groupApplicationsByStage(visibleApplications)) {
    const columnEl = document.createElement("div");
    columnEl.className = "column";

    const headerEl = document.createElement("div");
    headerEl.className = "column-header";
    headerEl.textContent = `${STAGE_LABELS[column.stage]} (${column.applications.length})`;
    columnEl.appendChild(headerEl);

    const cardsEl = document.createElement("div");
    cardsEl.className = "column-cards";
    for (const application of column.applications) {
      cardsEl.appendChild(buildApplicationCard(application, companyById.get(application.companyId), sessions));
    }
    columnEl.appendChild(cardsEl);

    board.appendChild(columnEl);
  }
}

function renderTable(visibleApplications: Application[], companies: Company[]): void {
  const rows = sortTableRows(
    buildTableRows(visibleApplications, companies, new Date()),
    tableSort.key,
    tableSort.direction
  );

  const tableBody = document.getElementById("tableBody") as HTMLTableSectionElement;
  tableBody.innerHTML = "";

  for (const row of rows) {
    const stage = row.application.stage ?? INITIAL_STAGE;
    const tr = document.createElement("tr");

    const companyTd = document.createElement("td");
    companyTd.textContent = row.companyName;

    const stageTd = document.createElement("td");
    stageTd.textContent = STAGE_LABELS[stage.name];

    const roundTd = document.createElement("td");
    roundTd.textContent = stage.name === "interview" ? String(stage.round) : "—";

    const joiningTd = document.createElement("td");
    if (row.application.joiningLink) {
      const joiningAnchor = document.createElement("a");
      joiningAnchor.href = row.application.joiningLink;
      joiningAnchor.textContent = "Joining link";
      joiningAnchor.target = "_blank";
      joiningTd.appendChild(joiningAnchor);
    } else {
      joiningTd.textContent = "—";
    }

    const lastFollowUpTd = document.createElement("td");
    lastFollowUpTd.textContent = row.lastFollowUpAt ? new Date(row.lastFollowUpAt).toLocaleDateString() : "—";

    const daysSinceTd = document.createElement("td");
    daysSinceTd.textContent = row.daysSinceFollowUp === null ? "—" : String(row.daysSinceFollowUp);

    const statusTd = document.createElement("td");
    statusTd.textContent = formatStage(stage);

    tr.append(companyTd, stageTd, roundTd, joiningTd, lastFollowUpTd, daysSinceTd, statusTd);
    tableBody.appendChild(tr);
  }

  for (const header of document.querySelectorAll<HTMLTableCellElement>("th.sortable")) {
    const key = header.dataset.sortKey as TableSortKey;
    const baseLabel = SORT_HEADER_LABELS[key];
    header.textContent =
      key === tableSort.key ? `${baseLabel} ${tableSort.direction === "asc" ? "▲" : "▼"}` : baseLabel;
  }
}

function renderViews(applications: Application[], companies: Company[], sessions: Session[]): void {
  const visibleApplications = selectApplicationsForSessionScope(applications, sessions, scope);
  const empty = document.getElementById("empty") as HTMLParagraphElement;
  empty.hidden = visibleApplications.length > 0;

  renderBoard(visibleApplications, companies, sessions);
  renderTable(visibleApplications, companies);
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

function initViewToggle(): void {
  const board = document.getElementById("board") as HTMLDivElement;
  const table = document.getElementById("table") as HTMLTableElement;
  const showBoardButton = document.getElementById("showBoard") as HTMLButtonElement;
  const showTableButton = document.getElementById("showTable") as HTMLButtonElement;

  function apply(): void {
    board.hidden = currentView !== "board";
    table.hidden = currentView !== "table";
    showBoardButton.classList.toggle("active", currentView === "board");
    showTableButton.classList.toggle("active", currentView === "table");
  }

  function selectView(view: DashboardView): void {
    currentView = view;
    apply();
    void savePreferredView(view);
  }

  showBoardButton.addEventListener("click", () => selectView("board"));
  showTableButton.addEventListener("click", () => selectView("table"));

  apply();
}

async function loadPreferredView(): Promise<DashboardView> {
  const stored = await chrome.storage.local.get(DASHBOARD_VIEW_STORAGE_KEY);
  const value = stored[DASHBOARD_VIEW_STORAGE_KEY];
  return isDashboardView(value) ? value : DEFAULT_DASHBOARD_VIEW;
}

async function savePreferredView(view: DashboardView): Promise<void> {
  await chrome.storage.local.set({ [DASHBOARD_VIEW_STORAGE_KEY]: view });
}

function initTableSorting(): void {
  for (const header of document.querySelectorAll<HTMLTableCellElement>("th.sortable")) {
    header.addEventListener("click", () => {
      const key = header.dataset.sortKey as TableSortKey;
      tableSort =
        tableSort.key === key
          ? { key, direction: tableSort.direction === "asc" ? "desc" : "asc" }
          : { key, direction: "asc" };
      void refresh();
    });
  }
}

async function init(): Promise<void> {
  currentView = await loadPreferredView();
  initSessionControls();
  initViewToggle();
  initTableSorting();
  await refresh();
}

void init();
