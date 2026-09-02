import type { ModuleWidth } from "@/components/module-layout-editor";
import type { GlobalDirectoryUser } from "./global-directory";
import type { JiraChartSettings } from "./analyst-jira-history";
export { isoWeekParts } from "./iso-week";
import { isAbandonedJiraStatus, isClosedJiraStatus, parseJiraAssigneeSummary } from "./jira-import";

export type AnalystPointModule = "overview" | "jira" | "planner" | "cycle20" | "dossiers";
export type AnalystJiraTicket = { id: string; key: string; internalId: string; summary: string; status: string; createdAt: string; updatedAt: string; link: string };
export type AnalystDossier = { id: string; title: string; status: string; action: string; deadline: string; comment: string; progress: number; showProgress: boolean; sourceId?: string; carriedFromYear?: number; carriedFromWeek?: number };
export type AnalystPointPreferences = {
  order: AnalystPointModule[];
  widths: Record<AnalystPointModule, ModuleWidth>;
  readModules: Record<AnalystPointModule, boolean>;
  mailModules: Record<AnalystPointModule, boolean>;
  htmlModules: Record<AnalystPointModule, boolean>;
  jiraWarningDays: number;
  jiraCriticalDays: number;
  jiraChart: JiraChartSettings;
};
export type AnalystPointData = {
  analystId: string;
  meetingDate: string;
  periodFrom: string;
  periodTo: string;
  includeCycle20: boolean;
  cycleFrom: string;
  cycleTo: string;
  note: string;
  dossiers: AnalystDossier[];
  jira: AnalystJiraTicket[];
  jiraResolved: AnalystJiraTicket[];
  preferences: AnalystPointPreferences;
  mail: { to: string; cc: string; subject: string; intro: string; autoTo: string[] };
};
export type AnalystPointRecord = { id: string; analystId: string; year: number; week: number; meetingDate: string; periodFrom: string; periodTo: string; data: AnalystPointData; createdAt: string; updatedAt: string };
export type AnalystJiraStatusCount = { status: string; count: number };

export const analystPointModules: { id: AnalystPointModule; label: string; detail: string }[] = [
  { id: "overview", label: "Synthèse", detail: "KPI principaux et message de la semaine" },
  { id: "jira", label: "Activité Jira", detail: "Tickets terminés et évolution hebdomadaire" },
  { id: "planner", label: "Simulations & contrôles", detail: "Activité Planner sur la période principale" },
  { id: "cycle20", label: "Repère 20 → 20", detail: "Bloc séparé sur le dernier cycle terminé" },
  { id: "dossiers", label: "Dossiers", detail: "À faire, en cours, en attente et faits" },
];

export function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function previousWeekRange(reference = new Date()) {
  const current = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate(), 12));
  const monday = new Date(current);
  monday.setUTCDate(current.getUTCDate() - ((current.getUTCDay() + 6) % 7) - 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { from: isoDate(monday), to: isoDate(sunday) };
}

export function lastCompletedCycle20(reference = new Date()) {
  const current = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate(), 12));
  const end = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 20, 12));
  if (current < end) end.setUTCMonth(end.getUTCMonth() - 1);
  const start = new Date(end);
  start.setUTCMonth(start.getUTCMonth() - 1);
  return { from: isoDate(start), to: isoDate(end) };
}

export function shiftWeek(dateString: string, amount: number) {
  const date = new Date(`${dateString}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount * 7);
  const day = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - day);
  const from = isoDate(date);
  date.setUTCDate(date.getUTCDate() + 6);
  return { from, to: isoDate(date) };
}

function allVisible() {
  return analystPointModules.reduce((result, module) => ({ ...result, [module.id]: true }), {} as Record<AnalystPointModule, boolean>);
}

export function initialAnalystPoint(analyst: GlobalDirectoryUser, manager?: GlobalDirectoryUser): AnalystPointData {
  const period = previousWeekRange();
  const cycle = lastCompletedCycle20();
  const recipients = [analyst.email, manager?.email ?? ""].filter(Boolean);
  return {
    analystId: analyst.id,
    meetingDate: period.to,
    periodFrom: period.from,
    periodTo: period.to,
    includeCycle20: false,
    cycleFrom: cycle.from,
    cycleTo: cycle.to,
    note: "Sécuriser les dossiers prioritaires et partager les points nécessitant un arbitrage.",
    dossiers: [],
    jira: [],
    jiraResolved: [],
    preferences: {
      order: analystPointModules.map((module) => module.id),
      widths: { overview: "full", jira: "full", planner: "full", cycle20: "half", dossiers: "full" },
      readModules: allVisible(),
      mailModules: allVisible(),
      htmlModules: allVisible(),
      jiraWarningDays: 10,
      jiraCriticalDays: 20,
      jiraChart: { horizon: "3", from: shiftWeek(period.from, -12).from, to: period.to },
    },
    mail: { to: recipients.join("; "), cc: "", subject: `Point analyste — ${analyst.name}`, intro: `Bonjour, voici le point hebdomadaire de ${analyst.name}.`, autoTo: recipients },
  };
}

export function normalizeAnalystPoint(value: unknown, analyst: GlobalDirectoryUser, manager?: GlobalDirectoryUser): AnalystPointData {
  const fallback = initialAnalystPoint(analyst, manager);
  if (!value || typeof value !== "object") return fallback;
  const source = value as Partial<AnalystPointData>;
  const preferences = source.preferences && typeof source.preferences === "object" ? source.preferences : fallback.preferences;
  const visible = (candidate: unknown) => ({ ...allVisible(), ...(candidate && typeof candidate === "object" ? candidate : {}) });
  const order = Array.isArray(preferences.order) ? [...preferences.order.filter((id) => analystPointModules.some((module) => module.id === id)), ...analystPointModules.map((module) => module.id).filter((id) => !preferences.order.includes(id))] : fallback.preferences.order;
  return {
    ...fallback,
    ...source,
    analystId: analyst.id,
    dossiers: Array.isArray(source.dossiers) ? source.dossiers : [],
    jira: Array.isArray(source.jira) ? source.jira.filter((ticket) => !isAbandonedJiraStatus(ticket.status)) : [],
    jiraResolved: Array.isArray(source.jiraResolved) ? source.jiraResolved.filter((ticket) => !isAbandonedJiraStatus(ticket.status)) : [],
    preferences: {
      ...fallback.preferences,
      ...preferences,
      order,
      widths: { ...fallback.preferences.widths, ...(preferences.widths ?? {}) },
      readModules: visible(preferences.readModules),
      mailModules: visible(preferences.mailModules),
      htmlModules: visible(preferences.htmlModules),
      jiraWarningDays: Math.max(1, Number(preferences.jiraWarningDays) || 10),
      jiraCriticalDays: Math.max((Number(preferences.jiraWarningDays) || 10) + 1, Number(preferences.jiraCriticalDays) || 20),
      jiraChart: {
        horizon: ["1", "3", "6", "12", "custom"].includes(preferences.jiraChart?.horizon) ? preferences.jiraChart.horizon : "3",
        from: typeof preferences.jiraChart?.from === "string" ? preferences.jiraChart.from : fallback.preferences.jiraChart.from,
        to: typeof preferences.jiraChart?.to === "string" ? preferences.jiraChart.to : fallback.preferences.jiraChart.to,
      },
    },
    mail: { ...fallback.mail, ...(source.mail ?? {}) },
  };
}

export function analystJiraTickets(rawText: string, analyst: GlobalDirectoryUser): AnalystJiraTicket[] {
  const usercode = analyst.usercode.trim().toUpperCase();
  if (!/^[A-Z]\d{7}$/.test(usercode)) return [];
  return parseJiraAssigneeSummary(rawText).detailedTickets
    .filter((ticket) => ticket.assigneeUserCode.toUpperCase() === usercode && !isClosedJiraStatus(ticket.status))
    .map((ticket) => ({ id: `${ticket.key}:${ticket.updatedAt}`, key: ticket.key, internalId: ticket.internalId, summary: ticket.summary, status: ticket.status, createdAt: ticket.createdAt, updatedAt: ticket.updatedAt, link: ticket.link }));
}

export function daysBetween(from: string, to: string) {
  const start = new Date(from.includes("T") ? from : `${from}T12:00:00Z`).valueOf();
  const end = new Date(to.includes("T") ? to : `${to}T12:00:00Z`).valueOf();
  return Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, Math.floor((end - start) / 86400000)) : 0;
}

export function jiraStatusBreakdown(tickets: AnalystJiraTicket[]): AnalystJiraStatusCount[] {
  const counts = tickets.filter((ticket) => !isAbandonedJiraStatus(ticket.status)).reduce((result, ticket) => {
    const status = ticket.status.trim() || "Sans statut";
    result.set(status, (result.get(status) ?? 0) + 1);
    return result;
  }, new Map<string, number>());
  const priority = (status: string) => {
    if (/en cours/i.test(status)) return 0;
    if (/attente/i.test(status)) return 1;
    if (/[àa] faire|ouvert|r[eé]ouvert/i.test(status)) return 2;
    return 3;
  };
  return Array.from(counts, ([status, count]) => ({ status, count })).sort((left, right) => priority(left.status) - priority(right.status) || right.count - left.count || left.status.localeCompare(right.status, "fr"));
}
