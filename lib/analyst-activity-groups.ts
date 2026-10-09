import type { AnalystContribution } from "./analyst-stats";

type ActivityGroup = Pick<AnalystContribution, "taskId" | "taskName" | "purchases12m" | "date"> & { activities: AnalystContribution[] };

export function groupAnalystActivities(contributions: AnalystContribution[]) {
  const groups = new Map<string, ActivityGroup>();
  for (const item of contributions) {
    const activities = groups.get(item.taskId)?.activities ?? [];
    activities.push(item);
    groups.set(item.taskId, { taskId: item.taskId, taskName: item.taskName, purchases12m: item.purchases12m, date: item.date, activities });
  }
  return Array.from(groups.values()).sort((left, right) => right.date.localeCompare(left.date));
}
