import { plannerTaskMonthLabel, type PlannerTask, type PlannerTaskMetrics } from "./planner-import";
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
  if (!point) return payload;
  const pointOperations = Array.isArray(point.operations) ? point.operations : [];
  const tasksById = new Map(tasks.map((task) => [task.externalId, task]));
  const operations = pointOperations.map((value) => {
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

function pointOperation(task: PlannerTask, tasks: PlannerTask[]) {
  const applicable = task.checklist.filter((item) => !item.nonApplicable);
  const completed = applicable.filter((item) => item.date).length;
  const nonApplicable = task.checklist.filter((item) => item.nonApplicable).length;
  const analystNames = Array.from(new Set(task.checklist.filter((item) => item.analystName).map((item) => item.analystName)));
  const state = task.workflowState === "completed" ? "Clôturée" : task.workflowState === "stopped" ? "Arrêtée avant finalisation" : task.workflowState === "needs-closure" ? "À clôturer dans Planner" : task.category || task.plannerStatus || "En cours";
  return {
    id: `planner:${task.externalId}`,
    name: task.taskName,
    month: plannerTaskMonthLabel(task),
    state,
    summary: `${completed}/${applicable.length || task.checklistTotal || 0} étape${applicable.length > 1 ? "s" : ""} applicable${applicable.length > 1 ? "s" : ""}${nonApplicable ? ` · ${nonApplicable} non nécessaire` : ""}${analystNames.length ? ` · ${analystNames.join(" / ")}` : ""}`,
    steps: task.checklist.map((item) => [item.label, item.nonApplicable ? "Non applicable" : item.date ? "Fait" : "À faire"]),
    plannerSource: {
      externalId: task.externalId,
      metrics: task.metrics,
      supplierLabel: supplierLabelFromTask(task.taskName),
      variationHistory: supplierSeriesForTask(task, tasks),
    },
  };
}

function nextMonth(value: string) {
  const date = new Date(`${value}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 7);
}

function plannerExternalId(value: unknown) {
  const operation = record(value);
  return text(record(operation?.plannerSource)?.externalId);
}

export function enrichMarketPointFromPlanner(payload: unknown, tasks: PlannerTask[], marketTags: string[]) {
  const enriched = record(enrichPointPlannerHistory(payload, tasks));
  if (!enriched) return payload;
  const meetingDate = text(enriched.meetingDate);
  const currentMonth = /^\d{4}-\d{2}-\d{2}$/.test(meetingDate) ? meetingDate.slice(0, 7) : "";
  const tags = new Set(marketTags.map((tag) => tag.trim().toUpperCase()).filter(Boolean));
  if (!currentMonth || !tags.size) return enriched;
  const months = new Set([currentMonth, nextMonth(currentMonth)]);
  const operations = Array.isArray(enriched.operations) ? [...enriched.operations] : [];
  const existing = new Set(operations.map(plannerExternalId).filter(Boolean));
  const relevant = tasks.filter((task) => task.registrySource !== "point-recovery" && months.has(task.effectiveMonth) && task.labels.some((label) => tags.has(label.trim().toUpperCase())));
  relevant.forEach((task) => {
    if (!existing.has(task.externalId)) operations.push(pointOperation(task, tasks));
  });
  return { ...enriched, operations };
}
