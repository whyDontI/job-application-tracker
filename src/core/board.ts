import { INITIAL_STAGE, STAGE_NAMES } from "./stage.js";
import type { StageName } from "./stage.js";
import type { Application } from "./types.js";

export interface BoardColumn {
  stage: StageName;
  applications: Application[];
}

/**
 * Groups applications into one column per pipeline stage, in pipeline order,
 * so the Kanban board always shows every stage (even empty ones) rather than
 * only the stages currently in use.
 */
export function groupApplicationsByStage(applications: Application[]): BoardColumn[] {
  const columns = new Map<StageName, Application[]>(STAGE_NAMES.map((stage) => [stage, []]));

  for (const application of applications) {
    const stage = application.stage ?? INITIAL_STAGE;
    columns.get(stage.name)?.push(application);
  }

  return STAGE_NAMES.map((stage) => ({ stage, applications: columns.get(stage) ?? [] }));
}
