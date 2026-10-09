import { desc } from "drizzle-orm";
import { getDb } from "../db";
import { marketDefinitions, plannerTasks, weeklyPoints } from "../db/schema";
import { parsePlannerTaskMetrics, type PlannerTask, type PlannerTaskMetrics } from "./planner-import";
import { mergePlannerTaskRegistry, recoverPlannerTasksFromPoints } from "./planner-registry";

function plannerTags(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [];
  } catch {
    return [];
  }
}

function mergeMetrics(current: PlannerTaskMetrics, recovered: PlannerTaskMetrics): PlannerTaskMetrics {
  return {
    purchases12m: current.purchases12m ?? recovered.purchases12m,
    supplierCode: current.supplierCode || recovered.supplierCode,
    announcedVariation: current.announcedVariation ?? recovered.announcedVariation,
    globalVariation: current.globalVariation ?? recovered.globalVariation,
    weightedVariation: current.weightedVariation ?? recovered.weightedVariation,
    tariffStructure: current.tariffStructure || recovered.tariffStructure,
  };
}

function rehydrateMetrics(task: PlannerTask): PlannerTask {
  return { ...task, metrics: mergeMetrics(task.metrics, parsePlannerTaskMetrics(task.comments)) };
}

export async function loadPlannerRegistry() {
  const db = getDb();
  const [rows, pointRows, marketRows] = await Promise.all([
    db.select().from(plannerTasks).orderBy(desc(plannerTasks.effectiveMonth), desc(plannerTasks.updatedAt)).limit(5000),
    db.select({ marketId: weeklyPoints.marketId, payload: weeklyPoints.payload, createdAt: weeklyPoints.createdAt }).from(weeklyPoints).orderBy(desc(weeklyPoints.createdAt)).limit(2000),
    db.select({ id: marketDefinitions.id, plannerTags: marketDefinitions.plannerTags }).from(marketDefinitions),
  ]);
  const tagsByMarket = Object.fromEntries(marketRows.map((market) => [market.id, plannerTags(market.plannerTags)]));
  const imported = rows.map((row) => rehydrateMetrics(JSON.parse(row.payload) as PlannerTask));
  const recovered = recoverPlannerTasksFromPoints(pointRows, tagsByMarket);
  const registry = mergePlannerTaskRegistry(imported, recovered);
  return {
    ...registry,
    tagsByMarket,
    updatedAt: [...rows.map((row) => row.updatedAt), ...pointRows.map((row) => row.createdAt)].sort().at(-1) ?? "",
  };
}
