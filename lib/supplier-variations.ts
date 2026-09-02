import type { PlannerTask } from "./planner-import";

export type SupplierVariationPoint = {
  taskId: string;
  taskName: string;
  supplierKey: string;
  supplierLabel: string;
  supplierCode: string;
  period: string;
  purchases12m?: number | null;
  globalVariation: number | null;
  weightedVariation: number | null;
  labels: string[];
};

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, " ").trim().toLocaleLowerCase("fr-FR");
}

export function supplierLabelFromTask(taskName: string) {
  const stripped = taskName.replace(/^20\d{2}-(?:0[1-9]|1[0-2])-(?:[A-ZÀ-Ÿ]+-)?/i, "").trim();
  return stripped || taskName;
}

export function supplierKeyForTask(task: PlannerTask) {
  return task.metrics.supplierCode.trim().toUpperCase() || normalized(supplierLabelFromTask(task.taskName));
}

export function buildSupplierVariations(tasks: PlannerTask[]) {
  return tasks.flatMap((task): SupplierVariationPoint[] => {
    if (!task.effectiveMonth || (task.metrics.globalVariation === null && task.metrics.weightedVariation === null)) return [];
    const supplierLabel = supplierLabelFromTask(task.taskName);
    return [{
      taskId: task.externalId,
      taskName: task.taskName,
      supplierKey: supplierKeyForTask(task),
      supplierLabel,
      supplierCode: task.metrics.supplierCode,
      period: task.effectiveMonth,
      purchases12m: task.metrics.purchases12m ?? null,
      globalVariation: task.metrics.globalVariation,
      weightedVariation: task.metrics.weightedVariation,
      labels: task.labels,
    }];
  }).sort((left, right) => left.period.localeCompare(right.period) || left.supplierLabel.localeCompare(right.supplierLabel, "fr"));
}

export function supplierSeriesForTask(task: PlannerTask, tasks: PlannerTask[]) {
  const key = supplierKeyForTask(task);
  return buildSupplierVariations(tasks).filter((point) => point.supplierKey === key);
}

export function averageVariation(points: SupplierVariationPoint[], key: "globalVariation" | "weightedVariation") {
  const values = points.map((point) => point[key]).filter((value): value is number => value !== null);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}
