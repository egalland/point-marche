import type { PlannerTask, PlannerTaskMetrics } from "./planner-import";

export type PlannerArchivePoint = {
  marketId: string;
  payload: unknown;
};

export type PlannerRegistrySummary = {
  imported: number;
  archiveCandidates: number;
  recovered: number;
  enriched: number;
  usableVariations: number;
  withoutVariation: number;
  withoutMonth: number;
};

type UnknownRecord = Record<string, unknown>;

const frenchMonths: Record<string, string> = {
  janvier: "01",
  fevrier: "02",
  mars: "03",
  avril: "04",
  mai: "05",
  juin: "06",
  juillet: "07",
  aout: "08",
  septembre: "09",
  octobre: "10",
  novembre: "11",
  decembre: "12",
};

function record(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : null;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("fr-FR");
}

function uniqueLabels(values: unknown) {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map(text).filter(Boolean).map((value) => value.toLocaleUpperCase("fr-FR"))));
}

function emptyMetrics(): PlannerTaskMetrics {
  return {
    purchases12m: null,
    supplierCode: "",
    announcedVariation: null,
    globalVariation: null,
    weightedVariation: null,
    tariffStructure: "",
  };
}

function metrics(value: unknown): PlannerTaskMetrics {
  const source = record(value);
  if (!source) return emptyMetrics();
  return {
    purchases12m: numberOrNull(source.purchases12m),
    supplierCode: text(source.supplierCode).toLocaleUpperCase("fr-FR"),
    announcedVariation: numberOrNull(source.announcedVariation),
    globalVariation: numberOrNull(source.globalVariation),
    weightedVariation: numberOrNull(source.weightedVariation),
    tariffStructure: text(source.tariffStructure),
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

function effectiveMonth(taskName: string, monthLabel: string, preferred = "") {
  if (/^20\d{2}-(?:0[1-9]|1[0-2])$/.test(preferred)) return preferred;
  const taskMatch = taskName.match(/^(20\d{2})-(0[1-9]|1[0-2])(?:-|\b)/);
  if (taskMatch) return `${taskMatch[1]}-${taskMatch[2]}`;
  const reversed = normalized(taskName).match(/^(20\d{2})[-\s]+([a-z]+)[-\s]+(0?[1-9]|1[0-2])(?:[-\s]|$)/);
  if (reversed && frenchMonths[reversed[2]] === reversed[3].padStart(2, "0")) return `${reversed[1]}-${reversed[3].padStart(2, "0")}`;
  const labelMatch = normalized(monthLabel).match(/\b(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)\s+(20\d{2})\b/);
  return labelMatch ? `${labelMatch[2]}-${frenchMonths[labelMatch[1]]}` : "";
}

function recoveredTask(input: {
  externalId: string;
  taskName: string;
  effectiveMonth: string;
  labels: string[];
  metrics: PlannerTaskMetrics;
  state?: string;
  createdAt?: string;
  importedAt?: string;
  integratedAt?: string;
}): PlannerTask {
  const completed = /(?:clotur|termin|finalis)/.test(normalized(input.state ?? ""));
  return {
    externalId: input.externalId,
    taskName: input.taskName || `Simulation ${input.externalId}`,
    effectiveMonth: input.effectiveMonth,
    category: input.state ?? "",
    goal: "",
    plannerStatus: input.state ?? "",
    priority: "",
    assignedTo: "",
    createdBy: "",
    createdAt: input.createdAt ?? "",
    importedAt: input.importedAt,
    integratedAt: input.integratedAt,
    dueDate: "",
    startDate: "",
    recurring: false,
    overdue: false,
    completedAt: "",
    completedBy: "",
    checklistCompleted: 0,
    checklistTotal: 0,
    checklist: [],
    labels: input.labels,
    comments: "",
    metrics: input.metrics,
    workflowState: completed ? "completed" : "active",
    registrySource: "point-recovery",
  };
}

function mergeTask(primary: PlannerTask, fallback: PlannerTask): PlannerTask {
  return {
    ...fallback,
    ...primary,
    createdAt: primary.createdAt || fallback.createdAt,
    importedAt: primary.importedAt || fallback.importedAt,
    integratedAt: primary.integratedAt || fallback.integratedAt,
    taskName: primary.taskName || fallback.taskName,
    effectiveMonth: primary.effectiveMonth || fallback.effectiveMonth,
    category: primary.category || fallback.category,
    plannerStatus: primary.plannerStatus || fallback.plannerStatus,
    labels: Array.from(new Set([...primary.labels, ...fallback.labels])),
    metrics: mergeMetrics(primary.metrics, fallback.metrics),
    registrySource: primary.registrySource === "point-recovery" ? "point-recovery" : "planner-import",
  };
}

function parsePayload(value: unknown) {
  if (typeof value !== "string") return record(value);
  try {
    return record(JSON.parse(value));
  } catch {
    return null;
  }
}

export function recoverPlannerTasksFromPoints(points: PlannerArchivePoint[], marketTags: Record<string, string[]>) {
  const recovered = new Map<string, PlannerTask>();
  const register = (task: PlannerTask) => {
    const current = recovered.get(task.externalId);
    recovered.set(task.externalId, current ? mergeTask(current, task) : task);
  };

  points.forEach((point) => {
    const payload = parsePayload(point.payload);
    if (!payload || payload.plannerMode === "manual") return;
    const operations = Array.isArray(payload.operations) ? payload.operations : Array.isArray(payload.simulations) ? payload.simulations : [];
    operations.forEach((value) => {
      const operation = record(value);
      const source = record(operation?.plannerSource);
      if (!operation || !source) return;
      const operationName = text(operation.name);
      const operationMonth = text(operation.month);
      const operationState = text(operation.state);
      const directId = text(source.externalId);
      const directMetrics = metrics(source.metrics);
      const labels = uniqueLabels(marketTags[point.marketId] ?? []);

      if (directId) {
        register(recoveredTask({
          externalId: directId,
          taskName: operationName,
          effectiveMonth: effectiveMonth(operationName, operationMonth),
          labels,
          metrics: directMetrics,
          state: operationState,
        }));
      }

      const history = Array.isArray(source.variationHistory) ? source.variationHistory : [];
      history.forEach((historyValue) => {
        const item = record(historyValue);
        if (!item) return;
        const externalId = text(item.taskId);
        if (!externalId) return;
        register(recoveredTask({
          externalId,
          createdAt: text(item.createdAt),
          importedAt: text(item.importedAt),
          integratedAt: text(item.integratedAt),
          taskName: text(item.taskName) || operationName,
          effectiveMonth: effectiveMonth(text(item.taskName) || operationName, operationMonth, text(item.period)),
          labels: uniqueLabels(item.labels).length ? uniqueLabels(item.labels) : labels,
          metrics: mergeMetrics({
            ...emptyMetrics(),
            purchases12m: numberOrNull(item.purchases12m),
            supplierCode: text(item.supplierCode).toLocaleUpperCase("fr-FR"),
            globalVariation: numberOrNull(item.globalVariation),
            weightedVariation: numberOrNull(item.weightedVariation),
          }, directId === externalId ? directMetrics : emptyMetrics()),
          state: operationState,
        }));
      });
    });
  });

  return Array.from(recovered.values());
}

export function mergePlannerTaskRegistry(importedTasks: PlannerTask[], recoveredTasks: PlannerTask[]) {
  const imported = new Map<string, PlannerTask>(importedTasks.map((task) => [task.externalId, { ...task, effectiveMonth: task.effectiveMonth || effectiveMonth(task.taskName, ""), registrySource: task.registrySource === "point-recovery" ? "point-recovery" : "planner-import" }]));
  let enriched = 0;
  let recovered = 0;

  recoveredTasks.forEach((task) => {
    const current = imported.get(task.externalId);
    if (!current) {
      imported.set(task.externalId, task);
      recovered += 1;
      return;
    }
    const merged = mergeTask(current, task);
    if (JSON.stringify(merged) !== JSON.stringify(current)) enriched += 1;
    imported.set(task.externalId, merged);
  });

  const tasks = Array.from(imported.values()).sort((left, right) => right.effectiveMonth.localeCompare(left.effectiveMonth) || left.taskName.localeCompare(right.taskName, "fr"));
  const summary: PlannerRegistrySummary = {
    imported: importedTasks.length,
    archiveCandidates: recoveredTasks.length,
    recovered,
    enriched,
    usableVariations: tasks.filter((task) => task.effectiveMonth && (task.metrics.globalVariation !== null || task.metrics.weightedVariation !== null)).length,
    withoutVariation: tasks.filter((task) => task.effectiveMonth && task.metrics.globalVariation === null && task.metrics.weightedVariation === null).length,
    withoutMonth: tasks.filter((task) => !task.effectiveMonth).length,
  };
  return { tasks, summary };
}
