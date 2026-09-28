export const DASHBOARD_VIEWS = ["board", "table"] as const;
export type DashboardView = (typeof DASHBOARD_VIEWS)[number];

export function isDashboardView(value: unknown): value is DashboardView {
  return typeof value === "string" && (DASHBOARD_VIEWS as readonly string[]).includes(value);
}

export const DASHBOARD_VIEW_STORAGE_KEY = "dashboardView";

export const DEFAULT_DASHBOARD_VIEW: DashboardView = "board";
