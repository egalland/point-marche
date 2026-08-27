import type { PlannerTask, PlannerTaskMetrics } from "./planner-import";
import { supplierLabelFromTask, supplierSeriesForTask } from "./supplier-variations";

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : null;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function existingMetrics(value: unknown): PlannerTaskMetrics {
  const source = record(value);
  return {
    purchases12m: numberOrNull(source?.purchases12m),
    supplierCode: text(source?.supplierCode),
    announcedVariation: numberOrNull(source?.announcedVariation),
    globalVariation: numberOrNull(source?.globalVariation),
    weightedVariation: numberOrNull(source?.weightedVariation),
    tariffStructure: text(source?.tariffStructure),
  };
}

function mergeMetrics(primary: PlannerTaskMetrics, fallback: PlannerTaskMetrics): PlannerTaskMetrics {
  return {
    purchases12m: primary.purchases12m ?? fallback.purchases12m,
    supplierCode: primary.supplierCode || fallback.supplierCode,
    announcedVariation: primary.announcedVariation ?? fallback.announcedVariation,
    globalVariation: primary.globalVariation ?? fallback.globalVariation,
    weightedVariation: primary.weightedVariation ?? fallback.weightedVariation,
    tariffStructure: primary.tariffStructure || fallback.tariffStructure,
  };
}

export function enrichPointPlannerHistory(payload: unknown, tasks: PlannerTask[]) {
  const point = record(payload);
  if (!point || !Array.isArray(point.operations)) return payload;
  const tasksById = new Map(tasks.map((task) => [task.externalId, task]));
  const operations = point.operations.map((value) => {
    const operation = record(value);
    const source = record(operation?.plannerSource);
    const externalId = text(source?.externalId);
    const task = externalId ? tasksById.get(externalId) : undefined;
    if (!operation || !source || !task) return value;
    const history = supplierSeriesForTask(task, tasks);
    return {
      ...operation,
      plannerSource: {
        ...source,
        externalId,
        metrics: mergeMetrics(task.metrics, existingMetrics(source.metrics)),
        supplierLabel: text(source.supplierLabel) || supplierLabelFromTask(task.taskName),
        variationHistory: history.length ? history : Array.isArray(source.variationHistory) ? source.variationHistory : [],
      },
    };
  });
  return { ...point, operations };
}
