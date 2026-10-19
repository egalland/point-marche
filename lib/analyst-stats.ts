import { milestoneKind, elapsedCalendarDays, simulationMilestones } from "./simulation-lifecycle";
import type { GlobalDirectoryUser } from "./global-directory";
import type { PlannerChecklistItem, PlannerSpecialty, PlannerTask } from "./planner-import";

export type AnalystStatsMarket = {
  id: string;
  name: string;
  plannerTags: string[];
};

export type AnalystStatsFilters = {
  from: string;
  to: string;
  comparisonRange?: { from: string; to: string };
  marketId: string;
  specialty: PlannerSpecialty | "all";
  analystIds: string[];
};

export type AnalystContribution = {
  taskId: string;
  taskName: string;
  purchases12m: number | null;
  effectiveMonth: string;
  category: string;
  stepLabel: string;
  specialty: PlannerSpecialty;
  date: string;
  analystLabel: string;
  analystId: string;
  analystName: string;
  marketIds: string[];
  marketTags: string[];
  workflowState: PlannerTask["workflowState"];
};

export type PlannerDelayKind = "receipt" | "templatePreparation" | "templateReturn" | "simulation" | "marketReturn" | "control";

export type PlannerDelaySample = {
  taskId: string;
  taskName: string;
  kind: PlannerDelayKind;
  startDate: string;
  endDate: string;
  days: number;
  marketIds: string[];
  marketTags: string[];
  analystIds: string[];
};

export type PlannerDelaySummary = {
  kind: PlannerDelayKind;
  label: string;
  definition: string;
  average: number | null;
  median: number | null;
  sampleCount: number;
  previousAverage: number | null;
  movement: number | null;
};

export type AnalystStats = {
  contributions: AnalystContribution[];
  previousContributions: AnalystContribution[];
  totalActivities: number;
  distinctTasks: number;
  simulations: number;
  controls: number;
  coverageRate: number;
  previousTotal: number;
  movement: number | null;
  unmatchedNames: string[];
  monthly: { period: string; label: string; simulations: number; controls: number; total: number }[];
  byAnalyst: { id: string; name: string; simulations: number; controls: number; total: number }[];
  delaySamples: PlannerDelaySample[];
  delaySummaries: PlannerDelaySummary[];
};

const delayDefinitions: { kind: PlannerDelayKind; label: string; definition: string; start: (item: PlannerChecklistItem) => boolean; end: (item: PlannerChecklistItem) => boolean }[] = [
  { kind: "templatePreparation", label: "Envoi de la trame", definition: "Avis de hausse → Trame envoyée", start: item => milestoneKind(item.label) === "notice", end: item => milestoneKind(item.label) === "templateSent" },
  { kind: "templateReturn", label: "Retour de la trame fournisseur", definition: "Trame envoyée → Retour fournisseur (Tarif fournisseur si aucune date de retour dédiée)", start: item => milestoneKind(item.label) === "templateSent", end: item => milestoneKind(item.label) === "supplierReceived" },
  { kind: "receipt", label: "Réception fournisseur", definition: "Avis de hausse → Tarif fournisseur", start: (item) => /^avis de hausse\b/.test(normalized(item.label)), end: (item) => /^tarif fournisseur\b/.test(normalized(item.label)) },
  { kind: "simulation", label: "Traitement simulation", definition: "Tarif fournisseur → Simulation", start: (item) => /^tarif fournisseur\b/.test(normalized(item.label)), end: (item) => item.kind === "simulation" },
  { kind: "marketReturn", label: "Retour marché", definition: "Simulation → Validation CDM", start: (item) => item.kind === "simulation", end: (item) => /^validation cdm\b/.test(normalized(item.label)) },
  { kind: "control", label: "Contrôle", definition: "Intégration → Contrôle", start: (item) => /^integration\b/.test(normalized(item.label)), end: (item) => item.kind === "control" },
];

function normalized(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLocaleLowerCase("fr-FR");
}

function uniqueFirstName(users: GlobalDirectoryUser[], user: GlobalDirectoryUser) {
  const first = normalized(user.name).split(" ")[0] ?? "";
  if (!first) return "";
  return users.filter((candidate) => normalized(candidate.name).split(" ")[0] === first).length === 1 ? first : "";
}

function matchAnalyst(label: string, users: GlobalDirectoryUser[]) {
  const key = normalized(label);
  if (!key) return null;
  const eligible = users.filter((user) => user.role === "analyste-tarif-referentiel");
  const aliasMatches = eligible.filter((user) => normalized(user.plannerAlias) === key);
  if (aliasMatches.length === 1) return aliasMatches[0];
  const fullNameMatches = eligible.filter((user) => normalized(user.name) === key);
  if (fullNameMatches.length === 1) return fullNameMatches[0];
  const firstNameMatches = eligible.filter((user) => uniqueFirstName(eligible, user) === key);
  return firstNameMatches.length === 1 ? firstNameMatches[0] : null;
}

function marketIdsForTask(task: PlannerTask, markets: AnalystStatsMarket[]) {
  const labels = new Set(task.labels.map((label) => normalized(label)));
  return markets.filter((market) => market.plannerTags.some((tag) => labels.has(normalized(tag)))).map((market) => market.id);
}

export function plannerContributions(tasks: PlannerTask[], users: GlobalDirectoryUser[], markets: AnalystStatsMarket[]) {
  return tasks.flatMap((task) => {
    const marketIds = marketIdsForTask(task, markets);
    return task.checklist.filter((item): item is PlannerChecklistItem & { kind: PlannerSpecialty } => (item.kind === "simulation" || item.kind === "control") && Boolean(item.date)).map((item) => {
      const analyst = matchAnalyst(item.analystName, users);
      return {
        taskId: task.externalId,
        taskName: task.taskName,
        purchases12m: task.metrics?.purchases12m ?? null,
        effectiveMonth: task.effectiveMonth,
        category: task.category,
        stepLabel: item.label,
        specialty: item.kind,
        date: item.date,
        analystLabel: item.analystName,
        analystId: analyst?.id ?? "",
        analystName: analyst?.name ?? (item.analystName || "Non attribué"),
        marketIds,
        marketTags: task.labels,
        workflowState: task.workflowState,
      } satisfies AnalystContribution;
    });
  });
}

function checklistDate(task: PlannerTask, matcher: (item: PlannerChecklistItem) => boolean) {
  return task.checklist.find((item) => Boolean(item.date) && matcher(item))?.date ?? "";
}

function calendarDays(startDate: string, endDate: string) {
  return elapsedCalendarDays(startDate, endDate);
}

function taskAnalystIds(task: PlannerTask, users: GlobalDirectoryUser[]) {
  return Array.from(new Set(task.checklist.filter((item) => item.kind === "simulation" || item.kind === "control").map((item) => matchAnalyst(item.analystName, users)?.id ?? "").filter(Boolean)));
}

export function plannerDelaySamples(tasks: PlannerTask[], users: GlobalDirectoryUser[], markets: AnalystStatsMarket[]) {
  return tasks.flatMap((task) => {
    const marketIds = marketIdsForTask(task, markets);
    const analystIds = taskAnalystIds(task, users);
    return delayDefinitions.flatMap((definition) => {
      const milestones = simulationMilestones(task.checklist);
      const startDate = definition.kind === "templatePreparation" ? milestones.notice : definition.kind === "templateReturn" ? milestones.templateSent : checklistDate(task, definition.start);
      const endDate = definition.kind === "templatePreparation" ? milestones.templateSent : definition.kind === "templateReturn" ? milestones.supplierReceived : checklistDate(task, definition.end);
      if (!startDate || !endDate) return [];
      const days = calendarDays(startDate, endDate);
      if (days === null) return [];
      return [{
        taskId: task.externalId,
        taskName: task.taskName,
        kind: definition.kind,
        startDate,
        endDate,
        days,
        marketIds,
        marketTags: task.labels,
        analystIds,
      } satisfies PlannerDelaySample];
    });
  });
}

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function daySpan(from: string, to: string) {
  return Math.max(1, Math.round((new Date(`${to}T12:00:00Z`).valueOf() - new Date(`${from}T12:00:00Z`).valueOf()) / 86400000) + 1);
}

function monthLabel(period: string) {
  const date = new Date(`${period}-01T12:00:00Z`);
  return new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit", timeZone: "UTC" }).format(date).replace(".", "");
}

function monthRange(from: string, to: string) {
  const start = new Date(`${from.slice(0, 7)}-01T12:00:00Z`);
  const end = new Date(`${to.slice(0, 7)}-01T12:00:00Z`);
  const periods: string[] = [];
  while (start <= end && periods.length < 60) {
    periods.push(start.toISOString().slice(0, 7));
    start.setUTCMonth(start.getUTCMonth() + 1, 1);
  }
  return periods;
}

function applyFilters(contributions: AnalystContribution[], filters: AnalystStatsFilters, from = filters.from, to = filters.to) {
  const selected = new Set(filters.analystIds);
  return contributions.filter((item) => {
    if (!item.date || item.date < from || item.date > to) return false;
    if (filters.marketId !== "all" && !item.marketIds.includes(filters.marketId)) return false;
    if (filters.specialty !== "all" && item.specialty !== filters.specialty) return false;
    if (selected.size && (!item.analystId || !selected.has(item.analystId))) return false;
    return true;
  });
}

function applyDelayFilters(samples: PlannerDelaySample[], filters: AnalystStatsFilters, from = filters.from, to = filters.to) {
  const selected = new Set(filters.analystIds);
  return samples.filter((sample) => {
    if (sample.endDate < from || sample.endDate > to) return false;
    if (filters.marketId !== "all" && !sample.marketIds.includes(filters.marketId)) return false;
    if (selected.size && !sample.analystIds.some((id) => selected.has(id))) return false;
    return true;
  });
}

function rounded(value: number) {
  return Math.round(value * 10) / 10;
}

function average(values: number[]) {
  return values.length ? rounded(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return rounded(sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2);
}

export function buildAnalystStats(tasks: PlannerTask[], users: GlobalDirectoryUser[], markets: AnalystStatsMarket[], filters: AnalystStatsFilters): AnalystStats {
  const source = plannerContributions(tasks, users, markets);
  const delaySource = plannerDelaySamples(tasks, users, markets);
  const contributions = applyFilters(source, filters);
  const span = daySpan(filters.from, filters.to);
  const previousTo = filters.comparisonRange?.to ?? addDays(filters.from, -1);
  const previousFrom = filters.comparisonRange?.from ?? addDays(previousTo, -(span - 1));
  const previousContributions = applyFilters(source, filters, previousFrom, previousTo);
  const delaySamples = applyDelayFilters(delaySource, filters);
  const previousDelaySamples = applyDelayFilters(delaySource, filters, previousFrom, previousTo);
  const simulations = contributions.filter((item) => item.specialty === "simulation").length;
  const controls = contributions.filter((item) => item.specialty === "control").length;
  const attributed = contributions.filter((item) => item.analystId).length;
  const previousTotal = previousContributions.length;
  const movement = previousTotal ? (contributions.length - previousTotal) / previousTotal : contributions.length ? null : 0;
  const unmatchedNames = Array.from(new Set(contributions.filter((item) => item.analystLabel && !item.analystId).map((item) => item.analystLabel))).sort((left, right) => left.localeCompare(right, "fr"));
  const monthly = monthRange(filters.from, filters.to).map((period) => {
    const items = contributions.filter((item) => item.date.startsWith(period));
    const periodSimulations = items.filter((item) => item.specialty === "simulation").length;
    const periodControls = items.filter((item) => item.specialty === "control").length;
    return { period, label: monthLabel(period), simulations: periodSimulations, controls: periodControls, total: items.length };
  });
  const analystMap = new Map<string, { id: string; name: string; simulations: number; controls: number; total: number }>();
  contributions.forEach((item) => {
    const id = item.analystId || `unmatched:${normalized(item.analystName) || "unknown"}`;
    const current = analystMap.get(id) ?? { id, name: item.analystName, simulations: 0, controls: 0, total: 0 };
    current[item.specialty === "simulation" ? "simulations" : "controls"] += 1;
    current.total += 1;
    analystMap.set(id, current);
  });
  const delaySummaries = delayDefinitions.map((definition) => {
    const values = delaySamples.filter((sample) => sample.kind === definition.kind).map((sample) => sample.days);
    const previousValues = previousDelaySamples.filter((sample) => sample.kind === definition.kind).map((sample) => sample.days);
    const currentAverage = average(values);
    const previousAverage = average(previousValues);
    return {
      kind: definition.kind,
      label: definition.label,
      definition: definition.definition,
      average: currentAverage,
      median: median(values),
      sampleCount: values.length,
      previousAverage,
      movement: currentAverage !== null && previousAverage !== null ? rounded(currentAverage - previousAverage) : null,
    } satisfies PlannerDelaySummary;
  });
  return {
    contributions,
    previousContributions,
    totalActivities: contributions.length,
    distinctTasks: new Set(contributions.map((item) => item.taskId)).size,
    simulations,
    controls,
    coverageRate: contributions.length ? attributed / contributions.length : 1,
    previousTotal,
    movement,
    unmatchedNames,
    monthly,
    byAnalyst: Array.from(analystMap.values()).sort((left, right) => left.name.localeCompare(right.name, "fr")),
    delaySamples,
    delaySummaries,
  };
}
