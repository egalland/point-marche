import { desc } from "drizzle-orm";
import { getDb } from "../db";
import { marketDefinitions, plannerTasks, weeklyPoints } from "../db/schema";
import type { PlannerTask } from "./planner-import";
import { mergePlannerTaskRegistry, recoverPlannerTasksFromPoints } from "./planner-registry";

function plannerTags(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [];
  } catch {
    return [];
  }
}

export async function loadPlannerRegistry() {
  const db = getDb();
  const [rows, pointRows, marketRows] = await Promise.all([
    db.select().from(plannerTasks).orderBy(desc(plannerTasks.effectiveMonth), desc(plannerTasks.updatedAt)).limit(5000),
    db.select({ marketId: weeklyPoints.marketId, payload: weeklyPoints.payload, createdAt: weeklyPoints.createdAt }).from(weeklyPoints).orderBy(desc(weeklyPoints.createdAt)).limit(2000),
    db.select({ id: marketDefinitions.id, plannerTags: marketDefinitions.plannerTags }).from(marketDefinitions),
  ]);
  const tagsByMarket = Object.fromEntries(marketRows.map((market) => [market.id, plannerTags(market.plannerTags)]));
  const imported = rows.map((row) => JSON.parse(row.payload) as PlannerTask);
  const recovered = recoverPlannerTasksFromPoints(pointRows, tagsByMarket);
  const registry = mergePlannerTaskRegistry(imported, recovered);
  return {
    ...registry,
    updatedAt: [...rows.map((row) => row.updatedAt), ...pointRows.map((row) => row.createdAt)].sort().at(-1) ?? "",
  };
}
