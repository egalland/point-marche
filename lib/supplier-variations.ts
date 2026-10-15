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
  integratedAt?: string;
  createdAt?: string;
  importedAt?: string;
};

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, " ").trim().toLocaleLowerCase("fr-FR");
}

export function supplierLabelFromTask(taskName: string) {
  const stripped = taskName.replace(/^(?:20\d{2}-(?:0[1-9]|1[0-2])-(?:[A-ZÀ-Ÿ]+-)?|20\d{2}-[A-ZÀ-Ÿ]+-(?:0[1-9]|1[0-2])-)/i, "").trim();
  return stripped || taskName;
}

export function supplierKeyForTask(task: PlannerTask) {
  return task.metrics.supplierCode.trim().toUpperCase() || normalized(supplierLabelFromTask(task.taskName));
}

function timestamp(value: string | undefined) {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Keep the latest integration per supplier/month; other suppliers remain distinct. */
export function latestSupplierVariations(points: SupplierVariationPoint[]) {
  const latest = new Map<string, SupplierVariationPoint>();
  for (const point of points) {
    const key = `${point.supplierKey}\u0000${point.period}`;
    const previous = latest.get(key);
    if (!previous) { latest.set(key, point); continue; }
    const comparison = timestamp(point.integratedAt) - timestamp(previous.integratedAt)
      || timestamp(point.createdAt) - timestamp(previous.createdAt)
      || timestamp(point.importedAt) - timestamp(previous.importedAt);
    // Without chronology, the last supplied record wins deterministically.
    if (comparison >= 0) latest.set(key, point);
  }
  return Array.from(latest.values()).sort((left, right) => left.period.localeCompare(right.period) || left.supplierLabel.localeCompare(right.supplierLabel, "fr"));
}

export function buildSupplierVariations(tasks: PlannerTask[]) {
  return tasks.flatMap((task): SupplierVariationPoint[] => {
    if (!task.effectiveMonth || (task.metrics.globalVariation === null && task.metrics.weightedVariation === null)) return [];
    const supplierLabel = supplierLabelFromTask(task.taskName);
    const integratedAt = task.integratedAt || (task.checklist ?? []).filter((item) => /integr/i.test(normalized(item.label)) && item.date).map((item) => item.date).sort().at(-1) || "";
    return [{
      taskId: task.externalId, taskName: task.taskName, supplierKey: supplierKeyForTask(task),
      supplierLabel, supplierCode: task.metrics.supplierCode, period: task.effectiveMonth,
      purchases12m: task.metrics.purchases12m ?? null, globalVariation: task.metrics.globalVariation,
      weightedVariation: task.metrics.weightedVariation, labels: task.labels,
      integratedAt, createdAt: task.createdAt, importedAt: task.importedAt,
    }];
  }).sort((left, right) => left.period.localeCompare(right.period) || left.supplierLabel.localeCompare(right.supplierLabel, "fr"));
}

export function supplierSeriesForTask(task: PlannerTask, tasks: PlannerTask[]) {
  const key = supplierKeyForTask(task);
  return buildSupplierVariations(tasks).filter((point) => point.supplierKey === key);
}

export function averageVariation(points: SupplierVariationPoint[], key: "globalVariation" | "weightedVariation") {
  const values = latestSupplierVariations(points).map((point) => point[key]).filter((value): value is number => value !== null);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

/** Keep a slot for each selected calendar month; an absent value is never zero. */
export function aggregateMonthlyVariations(points: SupplierVariationPoint[], from: string, to: string): SupplierVariationPoint[] {
  if (from > to) return [];
  const grouped = new Map<string, SupplierVariationPoint[]>();
  for (const point of latestSupplierVariations(points)) {
    const rows = grouped.get(point.period) ?? [];
    rows.push(point);
    grouped.set(point.period, rows);
  }
  const result: SupplierVariationPoint[] = [];
  const date = new Date(`${from.slice(0, 7)}-01T12:00:00Z`);
  const last = to.slice(0, 7);
  while (Number.isFinite(date.getTime()) && date.toISOString().slice(0, 7) <= last) {
    const period = date.toISOString().slice(0, 7);
    const rows = grouped.get(period) ?? [];
    result.push({ taskId: `average:${period}`, taskName: "Moyenne de la sélection", supplierKey: "selection-average", supplierLabel: "Moyenne de la sélection", supplierCode: "", period, globalVariation: averageVariation(rows, "globalVariation"), weightedVariation: averageVariation(rows, "weightedVariation"), labels: [] });
    date.setUTCMonth(date.getUTCMonth() + 1);
  }
  return result;
}

/** A readable scale that always includes zero, even for a single or empty series. */
export function variationColumnScale(values: number[]) {
  const finite = values.filter(Number.isFinite);
  const rawMin = Math.min(0, ...finite), rawMax = Math.max(0, ...finite);
  const rawStep = Math.max(1, rawMax - rawMin) / 4;
  const power = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const ratio = rawStep / power;
  const step = (ratio <= 1 ? 1 : ratio <= 2 ? 2 : ratio <= 2.5 ? 2.5 : ratio <= 5 ? 5 : 10) * power;
  const min = Math.floor(rawMin / step) * step;
  const max = Math.max(min + step, Math.ceil(rawMax / step) * step);
  const ticks = Array.from({ length: Math.round((max - min) / step) + 1 }, (_, index) => min + index * step);
  return { min, max, ticks };
}

export function filterSupplierOptions(suppliers: { key: string; label: string; code: string }[], query: string) {
  const options = [{ key: "all", label: "Tous les fournisseurs", code: "" }, ...suppliers];
  const terms = normalized(query).split(" ").filter(Boolean);
  return options.filter((supplier) => terms.every((term) => normalized(`${supplier.label} ${supplier.code}`).includes(term)));
}
