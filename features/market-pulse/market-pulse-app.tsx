"use client";

import { appFetch as fetch, isLocalWorkspace, markLocalFormPending, readLocalDraft, writeLocalDraft, saveLocalFile } from "@/lib/app-transport";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type DragEvent as ReactDragEvent, type FormEvent, type ReactNode } from "react";
import { AppDialog } from "@/components/app-dialog";
import { AppIcon as Icon } from "@/components/app-icon";
import { AppearanceProvider } from "@/components/appearance-provider";
import { AppearanceControl, AppearanceSettings } from "@/components/appearance-control";
import { ActionMenu } from "@/components/action-menu";
import { accentTokens } from "@/lib/color-contrast";
import { SupplierTurnover } from "@/components/supplier-turnover";
import { supplierTurnoverHtml } from "@/lib/supplier-turnover";
import { ModuleLayoutEditor, type ModuleWidth } from "@/components/module-layout-editor";
import { GLOBAL_ROLE_OPTIONS, roleLabel, roleMailMode, roleUsesAutomaticJira, type GlobalDirectoryUser, type GlobalRole } from "@/lib/global-directory";
import { isAbandonedJiraStatus, isClosedJiraStatus, JIRA_SUMMARY_STATUSES, type JiraSummaryImport } from "@/lib/jira-import";
import { plannerTaskMonthLabel, type PlannerTask } from "@/lib/planner-import";
import type { PlannerRegistrySummary } from "@/lib/planner-registry";
import { supplierSeriesForTask, type SupplierVariationPoint } from "@/lib/supplier-variations";
import { AnalystPointDashboard } from "./analyst-point-dashboard";
import { AnalystStatsDashboard } from "./analyst-stats-dashboard";
import { ImportCenter } from "./import-center";
import { PlannerImportDialog } from "./planner-import-dialog";
import { SupplierSparkline } from "./supplier-variation-dashboard";
import { WorkspaceNavigation, workspaceTitles, type WorkspaceView } from "./workspace-navigation";

type Tone = "mint" | "violet" | "aqua" | "peach" | "red";
type View = WorkspaceView;
type Section = "general" | "dossiers" | "operations" | "jira" | "saved" | "markets" | "users" | "mail" | "personalization";
type FontScale = "compact" | "standard" | "large";
type Density = "compact" | "comfortable";
type PointModule = "jira" | "dossiers" | "operations" | "alerts";
type ModuleVisibility = Record<PointModule, boolean>;
type PointPreferences = { fontScale: FontScale; density: Density; readModules: ModuleVisibility; mailModules: ModuleVisibility; htmlModules: ModuleVisibility; moduleOrder: PointModule[]; moduleWidths: Record<PointModule, ModuleWidth> };
type CarryoverFields = { sourceId?: string; carriedFromYear?: number; carriedFromWeek?: number };
type Dossier = { id: string; title: string; universe: string; reference: string; status: string; owner: string; action: string; deadline: string; progress: number; showProgress?: boolean; comment: string } & CarryoverFields;
type PlannerPointSource = { externalId: string; metrics: PlannerTask["metrics"]; supplierLabel?: string; variationHistory?: SupplierVariationPoint[] };
type CommercialOperation = { id: string; name: string; month: string; state: string; summary: string; steps: [string, string][]; plannerSource?: PlannerPointSource } & CarryoverFields;
type Tariff = { id: string; code: string; supplier: string; month: string; state: string; receptionDate: string; dueDate: string; owner: string; comment: string };
type JiraTicket = { id: string; key: string; internalId?: string; summary: string; status: string; priority: string; assignee: string; assigneeUserCode?: string; createdAt?: string; lastActivity: string; link: string; comment: string; count?: number };
type PointData = { pointName: string; themeColor: ThemeKey; customColor: string; meetingDate: string; priority: string; dossiers: Dossier[]; operations: CommercialOperation[]; tariffs: Tariff[]; jira: JiraTicket[]; preferences: PointPreferences; mail: { to: string; cc: string; subject: string; intro: string; autoTo?: string[]; autoCc?: string[] } };
type AlertItem = { title: string; detail: string; severity: "warning" | "danger"; targetId?: string; link?: string; category: "Jira" | "Dossier" };
type ThemeKey = "mint" | "violet" | "aqua" | "peach" | "red";
type Market = { id: string; name: string; short: string; tone: ThemeKey; colorHex: string; plannerTags: string[]; position: number; jiraWarningDays: number; jiraCriticalDays: number };
type PointRecord = { id: string; marketId: string; year: number; week: number; meetingDate: string; pointName: string; themeColor: ThemeKey; data: PointData; createdAt: string };
type JiraPersonGroup = { assignee: string; items: JiraTicket[]; total: number };
type JiraAttentionLevel = "fresh" | "warning" | "critical" | "undated";
type JiraDashboardScope = "all" | "attention" | "critical";
type JiraWeekPayload = { snapshot: { year: number; week: number; rawText: string; summary: JiraSummaryImport; updatedAt: string; source?: "weekly" | "central" } | null; assignments: Record<string, string[]>; error?: string };
type SessionPayload = { user: { displayName: string; username: string } | null };
type DirectoryDraft = { name: string; email: string; usercode: string; plannerAlias: string; role: GlobalRole; marketIds: string[] };
type DirectoryEditor = { id: string; draft: DirectoryDraft };
type ConfirmRequest = { title: string; detail: string; confirmLabel: string; destructive?: boolean };

const defaultMarkets: Market[] = [
  { id: "revetements-menuiserie", name: "Revêtements & Menuiserie", short: "REV–MEN", tone: "mint", colorHex: "", plannerTags: ["REV-PB", "MEN-PB"], position: 0, jiraWarningDays: 10, jiraCriticalDays: 20 },
  { id: "bois-amex", name: "Bois amin / AMEX", short: "BOIS", tone: "peach", colorHex: "", plannerTags: [], position: 1, jiraWarningDays: 10, jiraCriticalDays: 20 },
  { id: "outillage-quincaillerie", name: "Outillage & Quincaillerie", short: "OUT–QUIN", tone: "aqua", colorHex: "", plannerTags: [], position: 2, jiraWarningDays: 10, jiraCriticalDays: 20 },
  { id: "panneaux", name: "Panneaux", short: "PAN", tone: "violet", colorHex: "", plannerTags: ["PAN-GM"], position: 3, jiraWarningDays: 10, jiraCriticalDays: 20 },
];

const themes: { id: ThemeKey; label: string; accent: string; soft: string }[] = [
  { id: "mint", label: "Menthe", accent: "#72f5c5", soft: "rgba(114,245,197,.12)" },
  { id: "violet", label: "Violet", accent: "#b39aff", soft: "rgba(179,154,255,.12)" },
  { id: "aqua", label: "Azur", accent: "#70d8ff", soft: "rgba(112,216,255,.12)" },
  { id: "peach", label: "Corail", accent: "#ffb083", soft: "rgba(255,176,131,.12)" },
  { id: "red", label: "Framboise", accent: "#ff7287", soft: "rgba(255,114,135,.12)" },
];

const statusOptions = ["Dans les délais", "En cours", "En attente", "À surveiller", "Action requise", "Bloquant", "Terminé"];
const stepOptions = ["À faire", "En attente", "En cours", "Fait", "Non applicable"];
const pointModules: { id: PointModule; label: string; detail: string }[] = [
  { id: "jira", label: "Tickets Jira", detail: "Radar, évolution et tickets cliquables" },
  { id: "dossiers", label: "Dossiers", detail: "Dossiers et avancement visible" },
  { id: "operations", label: "Simulations & opérations", detail: "Source Planner et saisies manuelles" },
  { id: "alerts", label: "Vigilances", detail: "Alertes dossiers et Jira" },
];
const allModulesVisible = (): ModuleVisibility => ({ jira: true, dossiers: true, operations: true, alerts: true });
const defaultModuleOrder: PointModule[] = ["jira", "dossiers", "operations", "alerts"];
const defaultModuleWidths: Record<PointModule, ModuleWidth> = { jira: "full", dossiers: "full", operations: "full", alerts: "half" };
const defaultPreferences = (): PointPreferences => ({ fontScale: "standard", density: "comfortable", readModules: allModulesVisible(), mailModules: allModulesVisible(), htmlModules: allModulesVisible(), moduleOrder: [...defaultModuleOrder], moduleWidths: { ...defaultModuleWidths } });
const emptyPlannerRegistry = (): PlannerRegistrySummary => ({ imported: 0, archiveCandidates: 0, recovered: 0, enriched: 0, usableVariations: 0, withoutVariation: 0, withoutMonth: 0 });
const emptyDirectoryDraft = (): DirectoryDraft => ({ name: "", email: "", usercode: "", plannerAlias: "", role: "chef-produit", marketIds: [] });
const uid = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const isoToday = () => new Date().toISOString().slice(0, 10);
const isIsoDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
};
const safeIsoDate = (value: string, fallback = isoToday()) => isIsoDate(value) ? value : fallback;
const validHex = (value: string) => /^#[0-9A-F]{6}$/i.test(value.trim());
const normalizeHex = (value: unknown) => typeof value === "string" && validHex(value) ? value.trim().toUpperCase() : "";
function hexSoft(value: string) {
  const hex = normalizeHex(value);
  if (!hex) return "rgba(114,245,197,.12)";
  const number = Number.parseInt(hex.slice(1), 16);
  return `rgba(${number >> 16},${(number >> 8) & 255},${number & 255},.12)`;
}

function initialData(marketId = "revetements-menuiserie", marketOverride?: Market): PointData {
  const market = marketOverride ?? defaultMarkets.find((item) => item.id === marketId) ?? defaultMarkets[0];
  const common = {
    pointName: "Point marché",
    themeColor: market.tone,
    customColor: market.colorHex,
    meetingDate: isoToday(),
    priority: "Sécuriser les dossiers à surveiller et confirmer les prochaines échéances.",
    preferences: defaultPreferences(),
    mail: { to: "", cc: "", subject: `Point marché — ${market.name}`, intro: "Bonjour à tous, voici le point d’avancement de la semaine.", autoTo: [], autoCc: [] },
  };
  if (marketId !== "revetements-menuiserie") return { ...common, dossiers: [], operations: [], tariffs: [], jira: [] };
  return {
    ...common,
    dossiers: [
      { id: uid(), title: "EDAC", universe: "Revêtements", reference: "B9822", status: "En attente", owner: "Équipe marché", action: "Obtenir le retour de l’équipe marché.", deadline: "", progress: 35, comment: "Évolution décalée en septembre." },
      { id: uid(), title: "JELDWEN ALLEMAGNE", universe: "Menuiserie", reference: "D2381", status: "Action requise", owner: "", action: "Vérifier la trame transmise avant poursuite.", deadline: "", progress: 55, comment: "Trame à contrôler." },
      { id: uid(), title: "CIB", universe: "Dossier marché", reference: "", status: "En attente", owner: "Équipe vente", action: "Relancer l’équipe vente.", deadline: "", progress: 25, comment: "En attente du retour de l’équipe vente." },
    ],
    operations: [
      { id: uid(), name: "Incontournables de la rentrée", month: "Septembre 2026", state: "Vente à finaliser", summary: "2 étapes finalisées · 1 non applicable · 1 en attente", steps: [["Complétude de la trame", "Fait"], ["Intégration tarif achat", "Non applicable"], ["Contrôle tarif achat", "Fait"], ["Tarif vente", "En attente"]] },
      { id: uid(), name: "Champagne Flooring", month: "Octobre 2026", state: "Délai de traitement dépassé", summary: "Trame reçue · étapes achat toujours en attente", steps: [["Réception de la trame", "Fait"], ["Complétude de la trame", "En attente"], ["Intégration tarif achat", "En attente"], ["Contrôle tarif achat", "En attente"]] },
    ],
    tariffs: [],
    jira: [
      ["GLOBAL-10001", "Contrôle règle tarifaire", "En attente d’un tiers", "Moyenne", "John DOE", "", "", ""],
      ["GLOBAL-10002", "Écart de promotion", "En cours", "Haute", "Jane DOE", "", "", ""],
      ["GLOBAL-10003", "Mise à jour fournisseur", "En attente de changement", "Moyenne", "Alex MARTIN", "", "", ""],
    ].map(([key, summary, status, priority, assignee, lastActivity, link, comment]) => ({ id: uid(), key, summary, status, priority, assignee, lastActivity, link, comment })),
  };
}

function normalizePointData(value: unknown, marketId: string, marketOverride?: Market): PointData {
  const fallback = initialData(marketId, marketOverride);
  if (!value || typeof value !== "object") return fallback;
  const source = value as Partial<PointData> & { simulations?: CommercialOperation[] };
  const themeColor = themes.some((theme) => theme.id === source.themeColor) ? source.themeColor as ThemeKey : fallback.themeColor;
  const sourcePreferences = source.preferences && typeof source.preferences === "object" ? source.preferences : defaultPreferences();
  const mergeModules = (value: unknown): ModuleVisibility => {
    const sourceModules = value && typeof value === "object" ? value as Record<string, unknown> : {};
    return Object.fromEntries(pointModules.map((module) => [module.id, sourceModules[module.id] !== false])) as ModuleVisibility;
  };
  return {
    pointName: "Point marché",
    themeColor,
    customColor: normalizeHex(source.customColor) || fallback.customColor,
    meetingDate: typeof source.meetingDate === "string" ? source.meetingDate : fallback.meetingDate,
    priority: typeof source.priority === "string" ? source.priority : fallback.priority,
    preferences: {
      fontScale: sourcePreferences.fontScale === "compact" || sourcePreferences.fontScale === "large" ? sourcePreferences.fontScale : "standard",
      density: sourcePreferences.density === "compact" ? "compact" : "comfortable",
      readModules: mergeModules(sourcePreferences.readModules),
      mailModules: mergeModules(sourcePreferences.mailModules),
      htmlModules: mergeModules(sourcePreferences.htmlModules),
      moduleOrder: Array.isArray(sourcePreferences.moduleOrder) ? [...sourcePreferences.moduleOrder.filter((id) => pointModules.some((module) => module.id === id)), ...defaultModuleOrder.filter((id) => !sourcePreferences.moduleOrder.includes(id))] : [...defaultModuleOrder],
      moduleWidths: { ...defaultModuleWidths, ...(sourcePreferences.moduleWidths && typeof sourcePreferences.moduleWidths === "object" ? sourcePreferences.moduleWidths : {}) },
    },
    dossiers: Array.isArray(source.dossiers) ? source.dossiers.map((item) => ({ ...item, showProgress: Boolean(item.showProgress) })) : [],
    operations: Array.isArray(source.operations) ? source.operations : Array.isArray(source.simulations) ? source.simulations : [],
    tariffs: Array.isArray(source.tariffs) ? source.tariffs : [],
    jira: Array.isArray(source.jira) ? source.jira.filter((ticket) => !isAbandonedJiraStatus(ticket.status)) : [],
    mail: { ...fallback.mail, ...(source.mail && typeof source.mail === "object" ? source.mail : {}) },
  };
}

const pointSignature = (marketId: string, data: PointData) => JSON.stringify({ marketId, data });

async function fetchPointRecords(marketId: string, marketOverride?: Market): Promise<PointRecord[]> {
  const response = await fetch(`/api/points?marketId=${encodeURIComponent(marketId)}`, { cache: "no-store" });
  const payload = await response.json() as { points?: PointRecord[]; error?: string };
  if (!response.ok) throw new Error(payload.error || "Impossible de charger les sauvegardes.");
  return (payload.points ?? []).map((record) => ({ ...record, data: normalizePointData(record.data, record.marketId, marketOverride) }));
}

async function fetchMarkets(): Promise<Market[]> {
  const response = await fetch("/api/markets", { cache: "no-store" });
  const payload = await response.json() as { markets?: { id: string; name: string; shortCode: string; tone: ThemeKey; colorHex?: string; plannerTags?: string[]; position: number; jiraWarningDays?: number; jiraCriticalDays?: number }[]; error?: string };
  if (!response.ok) throw new Error(payload.error || "Impossible de charger les marchés.");
  return (payload.markets ?? []).map((market) => ({ id: market.id, name: market.name, short: market.shortCode, tone: market.tone, colorHex: normalizeHex(market.colorHex), plannerTags: Array.isArray(market.plannerTags) ? market.plannerTags : [], position: market.position, jiraWarningDays: Number(market.jiraWarningDays) || 10, jiraCriticalDays: Number(market.jiraCriticalDays) || 20 }));
}

async function fetchDirectoryUsers(): Promise<GlobalDirectoryUser[]> {
  const response = await fetch("/api/global-users", { cache: "no-store" });
  const payload = await response.json() as { users?: GlobalDirectoryUser[]; error?: string };
  if (!response.ok) throw new Error(payload.error || "Impossible de charger l’annuaire GLOBAL.");
  return (payload.users ?? []).map((user) => ({ ...user, plannerAlias: user.plannerAlias ?? "" }));
}

async function fetchPlannerTasks() {
  const response = await fetch("/api/planner-tasks", { cache: "no-store" });
  const payload = await response.json() as { tasks?: PlannerTask[]; registry?: PlannerRegistrySummary; updatedAt?: string; error?: string };
  if (!response.ok) throw new Error(payload.error || "Impossible de charger les simulations Planner.");
  return { tasks: payload.tasks ?? [], registry: payload.registry ?? emptyPlannerRegistry(), updatedAt: payload.updatedAt ?? "" };
}

function emailList(value: string) {
  return value.split(/[;,\n]/).map((email) => email.trim()).filter(Boolean);
}

function uniqueEmails(values: string[]) {
  const seen = new Set<string>();
  return values.filter((email) => {
    const key = email.toLocaleLowerCase("fr-FR");
    if (!email || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function applyDirectoryMail(data: PointData, marketId: string, users: GlobalDirectoryUser[]): PointData {
  const previousAutoTo = new Set((data.mail.autoTo ?? []).map((email) => email.toLocaleLowerCase("fr-FR")));
  const previousAutoCc = new Set((data.mail.autoCc ?? []).map((email) => email.toLocaleLowerCase("fr-FR")));
  const manualTo = emailList(data.mail.to).filter((email) => !previousAutoTo.has(email.toLocaleLowerCase("fr-FR")));
  const manualCc = emailList(data.mail.cc).filter((email) => !previousAutoCc.has(email.toLocaleLowerCase("fr-FR")));
  const autoTo = uniqueEmails(users.filter((user) => roleMailMode(user.role) === "to" && (user.role === "manager-tarif" || user.marketIds.includes(marketId))).map((user) => user.email));
  const autoCc = uniqueEmails(users.filter((user) => roleMailMode(user.role) === "cc").map((user) => user.email));
  const mail = {
    ...data.mail,
    to: uniqueEmails([...manualTo, ...autoTo]).join("; "),
    cc: uniqueEmails([...manualCc, ...autoCc]).join("; "),
    autoTo,
    autoCc,
  };
  return JSON.stringify(mail) === JSON.stringify(data.mail) ? data : { ...data, mail };
}

function plannerTaskMatchesMarket(task: PlannerTask, market: Market) {
  const labels = new Set(task.labels.map((label) => label.toLocaleUpperCase("fr-FR")));
  return market.plannerTags.some((tag) => labels.has(tag.toLocaleUpperCase("fr-FR")));
}

function plannerTaskToOperation(task: PlannerTask, allTasks: PlannerTask[]): CommercialOperation {
  const applicable = task.checklist.filter((item) => !item.nonApplicable);
  const completed = applicable.filter((item) => item.date).length;
  const nonApplicable = task.checklist.filter((item) => item.nonApplicable).length;
  const state = task.workflowState === "completed" ? "Clôturée" : task.workflowState === "stopped" ? "Arrêtée avant finalisation" : task.workflowState === "needs-closure" ? "À clôturer dans Planner" : task.category || task.plannerStatus || "En cours";
  const analystNames = Array.from(new Set(task.checklist.filter((item) => item.analystName).map((item) => item.analystName)));
  return {
    id: `planner:${task.externalId}`,
    name: task.taskName,
    month: plannerTaskMonthLabel(task),
    state,
    summary: `${completed}/${applicable.length || task.checklistTotal || 0} étape${applicable.length > 1 ? "s" : ""} applicable${applicable.length > 1 ? "s" : ""}${nonApplicable ? ` · ${nonApplicable} non nécessaire` : ""}${analystNames.length ? ` · ${analystNames.join(" / ")}` : ""}`,
    steps: task.checklist.map((item) => [item.label, item.nonApplicable ? "Non applicable" : item.date ? "Fait" : "À faire"] as [string, string]),
    plannerSource: { externalId: task.externalId, metrics: task.metrics, supplierLabel: task.taskName.replace(/^20\d{2}-(?:0[1-9]|1[0-2])-(?:[A-ZÀ-Ÿ]+-)?/i, "").trim() || task.taskName, variationHistory: supplierSeriesForTask(task, allTasks) },
  };
}

function plannerTasksForPoint(tasks: PlannerTask[], market: Market, meetingDate: string) {
  const currentMonth = safeIsoDate(meetingDate).slice(0, 7);
  const nextMonth = shiftMonth(`${currentMonth}-01`, 1).slice(0, 7);
  return tasks.filter((task) => task.registrySource !== "point-recovery" && plannerTaskMatchesMarket(task, market) && (task.effectiveMonth === currentMonth || task.effectiveMonth === nextMonth));
}

function mergePlannerOperations(operations: CommercialOperation[], tasks: PlannerTask[], allTasks = tasks) {
  return [...operations.filter((operation) => !operation.id.startsWith("planner:")), ...tasks.map((task) => plannerTaskToOperation(task, allTasks))];
}


function isoWeek(dateString: string) {
  const date = new Date(`${safeIsoDate(dateString)}T12:00:00`); const target = new Date(date.valueOf()); const day = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - day + 3); const firstThursday = new Date(target.getFullYear(), 0, 4); const firstDay = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDay + 3); return 1 + Math.round((target.valueOf() - firstThursday.valueOf()) / 604800000);
}
function isoWeekYear(dateString: string) { const date = new Date(`${safeIsoDate(dateString)}T12:00:00`); const day = (date.getDay() + 6) % 7; date.setDate(date.getDate() - day + 3); return date.getFullYear(); }
function weekInputValue(dateString: string) { return `${isoWeekYear(dateString)}-W${String(isoWeek(dateString)).padStart(2, "0")}`; }
function dateFromWeekInput(value: string) {
  const match = /^(\d{4})-W(\d{2})$/.exec(value);
  if (!match) return isoToday();
  const year = Number(match[1]); const week = Number(match[2]);
  const januaryFourth = new Date(Date.UTC(year, 0, 4));
  const monday = new Date(januaryFourth);
  monday.setUTCDate(januaryFourth.getUTCDate() - ((januaryFourth.getUTCDay() + 6) % 7) + (week - 1) * 7);
  return monday.toISOString().slice(0, 10);
}
function monthStart(dateString: string) {
  const date = new Date(`${safeIsoDate(dateString)}T12:00:00Z`);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
}
function shiftMonth(monthString: string, amount: number) {
  const date = new Date(`${monthString}T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + amount, 1);
  return monthStart(date.toISOString().slice(0, 10));
}
function calendarMonthLabel(monthString: string) {
  const label = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${monthString}T12:00:00Z`));
  return label.charAt(0).toLocaleUpperCase("fr-FR") + label.slice(1);
}
function shortMonth(value: Date) { return new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" }).format(value).replace(".", ""); }
function weekRangeLabel(start: Date, end: Date) {
  const startDay = start.getUTCDate(); const endDay = end.getUTCDate();
  return start.getUTCMonth() === end.getUTCMonth() ? `${startDay}–${endDay} ${shortMonth(end)}` : `${startDay} ${shortMonth(start)}–${endDay} ${shortMonth(end)}`;
}
function weeksForMonth(monthString: string) {
  const first = new Date(`${monthString}T12:00:00Z`);
  const cursor = new Date(first);
  cursor.setUTCDate(cursor.getUTCDate() - ((cursor.getUTCDay() + 6) % 7));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0, 12));
  const weeks: { year: number; week: number; value: string; start: string; end: string; range: string }[] = [];
  while (cursor <= last || weeks.length < 5) {
    const start = new Date(cursor); const end = new Date(cursor); end.setUTCDate(end.getUTCDate() + 6);
    const startString = start.toISOString().slice(0, 10); const year = isoWeekYear(startString); const week = isoWeek(startString);
    weeks.push({ year, week, value: `${year}-W${String(week).padStart(2, "0")}`, start: startString, end: end.toISOString().slice(0, 10), range: weekRangeLabel(start, end) });
    cursor.setUTCDate(cursor.getUTCDate() + 7);
    if (weeks.length >= 6) break;
  }
  return weeks;
}
function dateLabel(value: string) { if (!isIsoDate(value)) return "Date à définir"; return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`)); }
function dateValue(value: string) { const date = new Date(value.includes("T") ? value : `${value}T12:00:00`); return Number.isFinite(date.valueOf()) ? date.valueOf() : Number.NaN; }
function daysBetween(from: string, to: string) { if (!from || !to) return 0; const difference = dateValue(to) - dateValue(from); return Number.isFinite(difference) ? Math.max(0, Math.floor(difference / 86400000)) : 0; }
function isClosed(status: string) { return /(termin|cl[oô]tur|r[eé]solu|annul)/i.test(status); }
function isOperationClosed(operation: CommercialOperation) {
  if (isClosed(operation.state)) return true;
  return Boolean(operation.steps.length) && operation.steps.every(([, state]) => /(fait|termin|non applicable|annul)/i.test(state));
}
function carriedFromLabel(item: CarryoverFields) {
  return item.carriedFromYear && item.carriedFromWeek ? `Reporté de ${item.carriedFromYear} · S${String(item.carriedFromWeek).padStart(2, "0")}` : "";
}
function jiraItemCount(item: JiraTicket) { const count = Number(item.count); return Number.isFinite(count) && count > 0 ? Math.round(count) : 1; }
function jiraStatusSummary(items: JiraTicket[]) {
  const totals = new Map<string, number>();
  items.forEach((item) => totals.set(item.status || "À qualifier", (totals.get(item.status || "À qualifier") ?? 0) + jiraItemCount(item)));
  return Array.from(totals, ([status, count]) => `${status} ${count}`).join(" · ");
}
function groupJiraPeople(items: JiraTicket[]): JiraPersonGroup[] {
  const groups = new Map<string, JiraTicket[]>();
  items.forEach((item) => {
    const assignee = item.assignee.trim() || "Non assigné";
    groups.set(assignee, [...(groups.get(assignee) ?? []), item]);
  });
  return Array.from(groups, ([assignee, personItems]) => ({
    assignee,
    items: personItems,
    total: personItems.reduce((sum, item) => sum + jiraItemCount(item), 0),
  })).sort((a, b) => b.total - a.total || a.assignee.localeCompare(b.assignee, "fr"));
}
function jiraAttention(item: JiraTicket, pointDate: string, market: Market): { inactivity: number | null; level: JiraAttentionLevel } {
  if (!item.lastActivity) return { inactivity: null, level: "undated" };
  const inactivity = daysBetween(item.lastActivity, pointDate);
  if (inactivity >= Math.max(market.jiraWarningDays + 1, market.jiraCriticalDays || 20)) return { inactivity, level: "critical" };
  if (inactivity >= Math.max(1, market.jiraWarningDays || 10)) return { inactivity, level: "warning" };
  return { inactivity, level: "fresh" };
}
function jiraTrend(data: PointData, archive: PointRecord[]) {
  const pointYear = isoWeekYear(data.meetingDate);
  const pointWeek = isoWeek(data.meetingDate);
  const history = archive
    .filter((record) => record.year < pointYear || (record.year === pointYear && record.week < pointWeek))
    .sort((a, b) => a.year - b.year || a.week - b.week)
    .filter((record, index, rows) => rows.findIndex((candidate) => candidate.year === record.year && candidate.week === record.week) === index)
    .slice(-3)
    .map((record) => ({ label: `S${String(record.week).padStart(2, "0")}`, value: record.data.jira.filter((item) => !isClosedJiraStatus(item.status)).reduce((sum, item) => sum + jiraItemCount(item), 0) }));
  const currentVolume = data.jira.filter((item) => !isClosedJiraStatus(item.status)).reduce((sum, item) => sum + jiraItemCount(item), 0);
  const previousVolume = history.at(-1)?.value;
  return {
    points: [...history, { label: `S${String(pointWeek).padStart(2, "0")}`, value: currentVolume }],
    delta: previousVolume === undefined ? null : currentVolume - previousVolume,
  };
}
function jiraDashboardStats(data: PointData, market: Market, archive: PointRecord[]) {
  const activeTickets = data.jira.filter((item) => !isClosedJiraStatus(item.status));
  const currentVolume = activeTickets.reduce((sum, item) => sum + jiraItemCount(item), 0);
  const rows = activeTickets.map((item) => ({ item, ...jiraAttention(item, data.meetingDate, market) }));
  const warningCount = rows.filter((row) => row.level === "warning").reduce((sum, row) => sum + jiraItemCount(row.item), 0);
  const criticalCount = rows.filter((row) => row.level === "critical").reduce((sum, row) => sum + jiraItemCount(row.item), 0);
  const statusTotals: { status: string; value: number }[] = JIRA_SUMMARY_STATUSES.map((status) => ({ status, value: activeTickets.filter((item) => item.status === status).reduce((sum, item) => sum + jiraItemCount(item), 0) })).filter((item) => item.value);
  const represented = statusTotals.reduce((sum, item) => sum + item.value, 0);
  if (currentVolume > represented) statusTotals.push({ status: "Autres", value: currentVolume - represented });
  return { activeTickets, currentVolume, rows, warningCount, criticalCount, attentionCount: warningCount + criticalCount, statusTotals, ...jiraTrend(data, archive) };
}
function safeFilePart(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "marche";
}
function interactiveAttachmentName(data: PointData, market: Market) {
  return `point-marche-${safeFilePart(market.short)}-${isoWeekYear(data.meetingDate)}-S${String(isoWeek(data.meetingDate)).padStart(2, "0")}.html`;
}
function normalizeJiraSummary(summary: JiraSummaryImport): JiraSummaryImport {
  const detailedTickets = Array.isArray(summary.detailedTickets) ? summary.detailedTickets : [];
  return { ...summary, detailedTickets, mode: summary.mode ?? (detailedTickets.length ? "detailed" : "summary") };
}
function jiraTicketsFromSummary(summaryInput: JiraSummaryImport, selectedPeople: string[], marketId: string) {
  const summary = normalizeJiraSummary(summaryInput);
  const selectedUserCodes = new Set(selectedPeople.map((person) => person.toUpperCase()));
  if (summary.detailedTickets.length) {
    return summary.detailedTickets.filter((ticket) => !isAbandonedJiraStatus(ticket.status) && ticket.marketId === marketId && (!selectedUserCodes.size || selectedUserCodes.has(ticket.assigneeUserCode.toUpperCase()))).map((ticket) => ({
      id: uid(), key: ticket.key, internalId: ticket.internalId, summary: ticket.summary, status: ticket.status, priority: "",
      assignee: ticket.assigneeName || ticket.assigneeUserCode, assigneeUserCode: ticket.assigneeUserCode, createdAt: ticket.createdAt,
      lastActivity: ticket.updatedAt, link: ticket.link, comment: "Import Jira détaillé", count: 1,
    }));
  }
  const selected = new Set(selectedPeople);
  return summary.items.filter((item) => !isAbandonedJiraStatus(item.status) && selected.has(item.assignee)).map((item) => ({
    id: uid(), key: "", summary: "Synthèse de la file Jira", status: item.status, priority: "", assignee: item.assignee,
    lastActivity: "", link: item.link, comment: "Tableau Jira hebdomadaire", count: item.count,
  }));
}
async function fetchJiraWeek(year: number, week: number, marketId: string, preferCentral = false): Promise<JiraWeekPayload> {
  const response = await fetch(`/api/jira-week?marketId=${encodeURIComponent(marketId)}&year=${year}&week=${week}${preferCentral ? "&preferCentral=1" : ""}`, { cache: "no-store" });
  const payload = await response.json() as JiraWeekPayload;
  if (!response.ok) throw new Error(payload.error || "Impossible de charger le tableau Jira hebdomadaire.");
  return payload;
}
async function applyJiraWeek(data: PointData, marketId: string, replaceCentral = false) {
  try {
    const payload = await fetchJiraWeek(isoWeekYear(data.meetingDate), isoWeek(data.meetingDate), marketId, replaceCentral);
    if (!payload.snapshot) return data;
    return { ...data, jira: jiraTicketsFromSummary(payload.snapshot.summary, payload.assignments[marketId] ?? [], marketId) };
  } catch {
    return data;
  }
}
function toneForStatus(status: string): Tone { if (/(bloqu|d[eé]pass|retard)/i.test(status)) return "red"; if (/(attente|surveill|action|pr[eé]par)/i.test(status)) return "peach"; if (/(fait|termin|re[cç]u|d[eé]lai)/i.test(status)) return "mint"; if (/cours/i.test(status)) return "aqua"; return "violet"; }
function escapeHtml(value: string) { return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character); }

function TextField({ label, value, onChange, placeholder, type = "text", wide = false }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; wide?: boolean }) {
  return <label className={`field ${wide ? "field-wide" : ""}`}><span>{label}</span><input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label>;
}
function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return <label className="field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}
function SectionTitle({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail: string; action?: ReactNode }) {
  return <div className="section-title"><div><span>{eyebrow}</span><h2>{title}</h2><p>{detail}</p></div>{action}</div>;
}
function EmptyState({ label, onAdd }: { label: string; onAdd: () => void }) { return <button className="empty-state" onClick={onAdd}><span className="empty-plus"><Icon name="plus" size={22} /></span><strong>Ajouter {label}</strong><small>La section est vide pour le moment.</small></button>; }

function buildAlerts(data: PointData, market: Market): AlertItem[] {
  const alerts: AlertItem[] = []; const pointDate = data.meetingDate || isoToday();
  data.dossiers.forEach((item) => { if (isClosed(item.status)) return; const common = { title: item.title || "Dossier", targetId: `dossier-${item.id}`, category: "Dossier" as const }; if (/bloqu/i.test(item.status)) alerts.push({ ...common, detail: item.comment || "Dossier bloquant", severity: "danger" }); else if (item.deadline && daysBetween(item.deadline, pointDate) > 0) alerts.push({ ...common, detail: `Échéance dépassée depuis ${daysBetween(item.deadline, pointDate)} jour(s)`, severity: "danger" }); else if (/(surveill|action)/i.test(item.status)) alerts.push({ ...common, detail: item.comment || item.action || item.status, severity: "warning" }); });
  const warningDays = Math.max(1, market.jiraWarningDays || 10);
  const criticalDays = Math.max(warningDays + 1, market.jiraCriticalDays || 20);
  const jiraAlerts = data.jira.filter((item) => !isClosedJiraStatus(item.status) && item.lastActivity)
    .map((item) => ({ item, inactivity: daysBetween(item.lastActivity, pointDate) }))
    .filter(({ inactivity }) => inactivity >= warningDays)
    .sort((a, b) => b.inactivity - a.inactivity)
    .map(({ item, inactivity }): AlertItem => ({
      title: item.key || item.summary || "Ticket Jira",
      detail: `Sans activité Jira depuis ${inactivity} jour${inactivity > 1 ? "s" : ""}${item.assignee ? ` · ${item.assignee}` : ""}`,
      severity: inactivity >= criticalDays ? "danger" : "warning",
      targetId: `jira-${item.id}`,
      link: item.link || undefined,
      category: "Jira",
    }));
  return [...jiraAlerts, ...alerts].sort((a, b) => Number(b.severity === "danger") - Number(a.severity === "danger")).slice(0, 12);
}

function JiraVolumePulse({ data, archive, market }: { data: PointData; archive: PointRecord[]; market: Market }) {
  const pointYear = isoWeekYear(data.meetingDate);
  const pointWeek = isoWeek(data.meetingDate);
  const activeTickets = data.jira.filter((item) => !isClosedJiraStatus(item.status));
  const currentVolume = activeTickets.reduce((sum, item) => sum + jiraItemCount(item), 0);
  const history = archive
    .filter((record) => record.year < pointYear || (record.year === pointYear && record.week < pointWeek))
    .sort((a, b) => a.year - b.year || a.week - b.week)
    .filter((record, index, rows) => rows.findIndex((candidate) => candidate.year === record.year && candidate.week === record.week) === index)
    .slice(-3)
    .map((record) => ({ label: `S${String(record.week).padStart(2, "0")}`, value: record.data.jira.filter((item) => !isClosedJiraStatus(item.status)).reduce((sum, item) => sum + jiraItemCount(item), 0) }));
  const points = [...history, { label: `S${String(pointWeek).padStart(2, "0")}`, value: currentVolume }];
  const maxVolume = Math.max(1, ...points.map((point) => point.value));
  const previousVolume = history.at(-1)?.value;
  const delta = previousVolume === undefined ? null : currentVolume - previousVolume;
  const warningDays = Math.max(1, market.jiraWarningDays || 10);
  const criticalDays = Math.max(warningDays + 1, market.jiraCriticalDays || 20);
  const inactivity = activeTickets.filter((item) => item.lastActivity).map((item) => daysBetween(item.lastActivity, data.meetingDate));
  const warningCount = inactivity.filter((days) => days >= warningDays && days < criticalDays).length;
  const criticalCount = inactivity.filter((days) => days >= criticalDays).length;
  const statusTotals: { status: string; value: number }[] = JIRA_SUMMARY_STATUSES.map((status) => ({ status, value: activeTickets.filter((item) => item.status === status).reduce((sum, item) => sum + jiraItemCount(item), 0) })).filter((item) => item.value);
  const represented = statusTotals.reduce((sum, item) => sum + item.value, 0);
  if (currentVolume > represented) statusTotals.push({ status: "Autres", value: currentVolume - represented });
  return <section className="jira-volume-pulse">
    <div className="jira-volume-heading"><div><span>Volume de tickets ouverts</span><strong>Évolution sur les quatre derniers points</strong></div><div className={`jira-volume-delta ${delta === null ? "neutral" : delta > 0 ? "up" : delta < 0 ? "down" : "neutral"}`}><small>Écart vs dernier point</small><strong>{delta === null ? "—" : `${delta > 0 ? "+" : ""}${delta}`}</strong></div></div>
    <div className="jira-volume-content"><div className="jira-volume-bars" aria-label="Évolution du volume de tickets Jira">{points.map((point, index) => <div className={`jira-volume-bar ${index === points.length - 1 ? "current" : ""}`} key={`${point.label}-${index}`}><span><i style={{ height: `${Math.max(8, (point.value / maxVolume) * 100)}%` }}/></span><b>{point.value}</b><small>{point.label}</small></div>)}</div><div className="jira-volume-stats"><article><span>Total actuel</span><strong>{currentVolume}</strong><small>{activeTickets.length} ligne{activeTickets.length > 1 ? "s" : ""} détaillée{activeTickets.length > 1 ? "s" : ""}</small></article><article className="warning"><span>À surveiller</span><strong>{warningCount}</strong><small>{warningDays} à {criticalDays - 1} j sans activité</small></article><article className="critical"><span>Critiques</span><strong>{criticalCount}</strong><small>{criticalDays} j ou plus sans activité</small></article></div></div>
    <div className="jira-status-visual"><div>{statusTotals.length ? statusTotals.map((item, index) => <i key={item.status} title={`${item.status} : ${item.value}`} className={`segment segment-${index % 6}`} style={{ width: `${(item.value / Math.max(1, currentVolume)) * 100}%` }}/>) : <i className="segment empty"/>}</div><p>{statusTotals.length ? statusTotals.map((item) => <span key={item.status}><i className={`segment-${statusTotals.indexOf(item) % 6}`}/>{item.status} <b>{item.value}</b></span>) : <span>Aucun ticket actif</span>}</p></div>
  </section>;
}

function JiraReadTicket({ item, data, market }: { item: JiraTicket; data: PointData; market: Market }) {
  const signal = jiraAttention(item, data.meetingDate, market);
  const content = <><span>{item.key || "Synthèse"}</span><div><strong>{item.summary || "Synthèse de la file Jira"}</strong><small>{item.status} · {signal.inactivity === null ? "activité non datée" : signal.inactivity === 0 ? "mise à jour aujourd’hui" : `dernière modification il y a ${signal.inactivity} j`}</small></div><b>{jiraItemCount(item) > 1 ? jiraItemCount(item) : signal.level === "critical" ? `Critique · ${signal.inactivity} j` : signal.level === "warning" ? `À surveiller · ${signal.inactivity} j` : "À jour"}</b></>;
  const className = `jira-read-ticket ${signal.level}`;
  return item.link ? <a className={className} href={item.link} target="_blank" rel="noreferrer" title={`Ouvrir ${item.key || "le ticket"} dans Jira`}>{content}</a> : <div className={className}>{content}</div>;
}

function JiraCommandCenter({ data, archive, market }: { data: PointData; archive: PointRecord[]; market: Market }) {
  const stats = useMemo(() => jiraDashboardStats(data, market, archive), [archive, data, market]);
  const [scope, setScope] = useState<JiraDashboardScope>("all");
  const [status, setStatus] = useState("all");
  const [expandedPerson, setExpandedPerson] = useState("");
  const attentionRank: Record<JiraAttentionLevel, number> = { critical: 0, warning: 1, undated: 2, fresh: 3 };
  const filteredRows = stats.rows.filter((row) => {
    const scopeMatches = scope === "all" || (scope === "attention" ? row.level === "warning" || row.level === "critical" : row.level === "critical");
    return scopeMatches && (status === "all" || row.item.status === status);
  }).sort((left, right) => attentionRank[left.level] - attentionRank[right.level] || (right.inactivity ?? -1) - (left.inactivity ?? -1) || left.item.key.localeCompare(right.item.key, "fr", { numeric: true }));
  const people = groupJiraPeople(filteredRows.map((row) => row.item)).sort((left, right) => {
    const strongest = (person: JiraPersonGroup) => Math.min(...person.items.map((item) => attentionRank[jiraAttention(item, data.meetingDate, market).level]));
    return strongest(left) - strongest(right) || right.total - left.total || left.assignee.localeCompare(right.assignee, "fr");
  });
  const filteredVolume = filteredRows.reduce((sum, row) => sum + jiraItemCount(row.item), 0);
  const maxVolume = Math.max(1, ...stats.points.map((point) => point.value));
  const activeFilter = scope !== "all" || status !== "all";
  const scopeLabel = scope === "attention" ? "sans activité" : scope === "critical" ? "critiques" : "tous les tickets";
  return <section className="jira-command-center" aria-labelledby="jira-command-title">
    <header className="jira-command-header"><div><span>Radar Jira</span><h2 id="jira-command-title">Tickets ouverts du marché</h2><p>Les tickets qui dépassent un seuil remontent automatiquement en premier. Ouvre une personne puis clique sur un ticket pour accéder à Jira.</p></div><div className="jira-command-delta"><small>Depuis le dernier point</small><strong>{stats.delta === null ? "—" : `${stats.delta > 0 ? "+" : ""}${stats.delta}`}</strong><span>{stats.delta === null ? "Première mesure" : stats.delta === 0 ? "Volume stable" : "Évolution du stock"}</span></div></header>
    <div className="jira-command-kpis" role="group" aria-label="Filtres d’attention Jira">
      <button type="button" className={scope === "all" ? "active" : ""} aria-pressed={scope === "all"} onClick={() => setScope("all")}><span>Tickets ouverts</span><strong>{stats.currentVolume}</strong><small>Stock actuel du marché</small><i className="tone-aqua"/></button>
      <button type="button" className={scope === "attention" ? "active warning" : "warning"} aria-pressed={scope === "attention"} onClick={() => setScope("attention")}><span>Sans activité</span><strong>{stats.attentionCount}</strong><small>Depuis {market.jiraWarningDays} jours</small><i className="tone-peach"/></button>
      <button type="button" className={scope === "critical" ? "active critical" : "critical"} aria-pressed={scope === "critical"} onClick={() => setScope("critical")}><span>Attention forte</span><strong>{stats.criticalCount}</strong><small>Depuis {market.jiraCriticalDays} jours</small><i className="tone-red"/></button>
    </div>
    <div className="jira-command-visuals">
      <article className="jira-trend-panel"><div><span>Évolution du volume</span><strong>Quatre derniers points</strong></div><div className="jira-trend-columns" aria-label="Historique du volume Jira">{stats.points.map((point, index) => <div key={`${point.label}-${index}`} className={index === stats.points.length - 1 ? "current" : ""}><b>{point.value}</b><span><i style={{ height: `${Math.max(7, (point.value / maxVolume) * 100)}%` }}/></span><small>{point.label}</small></div>)}</div></article>
      <article className="jira-status-panel"><div><span>Répartition</span><strong>Filtrer par statut</strong></div><div className="jira-interactive-bar">{stats.statusTotals.length ? stats.statusTotals.map((item, index) => <button key={item.status} type="button" className={`segment-${index % 6} ${status === item.status ? "active" : ""}`} style={{ width: `${(item.value / Math.max(1, stats.currentVolume)) * 100}%` }} aria-label={`${item.status} : ${item.value}`} aria-pressed={status === item.status} onClick={() => setStatus((current) => current === item.status ? "all" : item.status)}/>) : <i/>}</div><div className="jira-status-buttons"><button type="button" className={status === "all" ? "active" : ""} onClick={() => setStatus("all")}>Tous</button>{stats.statusTotals.map((item, index) => <button key={item.status} type="button" className={status === item.status ? "active" : ""} onClick={() => setStatus((current) => current === item.status ? "all" : item.status)}><i className={`segment-${index % 6}`}/>{item.status}<b>{item.value}</b></button>)}</div></article>
    </div>
    <div className="jira-command-filter"><div><Icon name="filter" size={15}/><span><strong>{filteredVolume}</strong> ticket{filteredVolume > 1 ? "s" : ""} · {scopeLabel}{status !== "all" ? ` · ${status}` : ""}</span></div>{activeFilter && <button type="button" onClick={() => { setScope("all"); setStatus("all"); }}>Réinitialiser</button>}</div>
    {people.length ? <div className="jira-command-people">{people.map((person) => {
      const open = expandedPerson === person.assignee;
      const attention = stats.rows.filter((row) => (row.item.assignee.trim() || "Non assigné") === person.assignee && (row.level === "warning" || row.level === "critical")).reduce((sum, row) => sum + jiraItemCount(row.item), 0);
      return <article key={person.assignee} className={open ? "open" : ""}><button type="button" className="jira-person-toggle" aria-expanded={open} onClick={() => setExpandedPerson((current) => current === person.assignee ? "" : person.assignee)}><span className="jira-person-avatar">{person.assignee.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span><span><strong>{person.assignee}</strong><small>{jiraStatusSummary(person.items)}</small></span>{attention > 0 && <b className="jira-person-alert">{attention} à regarder</b>}<em>{person.total}</em><Icon name="chevron" size={16}/></button>{open && <div className="jira-person-tickets">{person.items.slice().sort((left, right) => attentionRank[jiraAttention(left, data.meetingDate, market).level] - attentionRank[jiraAttention(right, data.meetingDate, market).level] || (jiraAttention(right, data.meetingDate, market).inactivity ?? -1) - (jiraAttention(left, data.meetingDate, market).inactivity ?? -1)).map((item) => <JiraReadTicket key={item.id} item={item} data={data} market={market}/>)}</div>}</article>;
    })}</div> : <div className="jira-command-empty"><Icon name="ticket" size={24}/><strong>{stats.currentVolume ? "Aucun ticket dans ce filtre" : "Aucun ticket actif"}</strong><span>{stats.currentVolume ? "Réinitialise les filtres pour retrouver l’ensemble du stock." : "Le prochain import Jira alimentera automatiquement ce tableau de bord."}</span></div>}
  </section>;
}

function PreviewDashboard({ data, market, archive }: { data: PointData; market: Market; archive: PointRecord[] }) {
  const modules = data.preferences.readModules;
  const alerts = useMemo(() => buildAlerts(data, market).filter((item) => item.category !== "Jira"), [data, market]);
  const [alertFilter, setAlertFilter] = useState<"all" | "danger">("all");
  const visibleAlerts = alerts.filter((item) => alertFilter === "all" || item.severity === "danger");
  const content: Record<PointModule, ReactNode> = {
    jira: <JiraCommandCenter key={`${market.id}-${data.meetingDate}`} data={data} archive={archive} market={market}/>,
    dossiers: <article className="report-focus report-standalone"><div className="report-heading"><div><small>Dossiers</small><h2>En cours</h2></div></div>{data.dossiers.length ? <div className="report-dossiers">{data.dossiers.map((item) => <div id={`dossier-${item.id}`} className="report-dossier" key={item.id}><span className={`status-dot tone-${toneForStatus(item.status)}`}/><div><strong>{item.title || "Dossier sans titre"}</strong><small>{[item.universe, item.reference, item.owner].filter(Boolean).join(" · ") || "Contexte à compléter"}</small>{item.showProgress && <div className="report-dossier-progress"><span><i style={{ width: `${Math.max(0, Math.min(100, Number(item.progress) || 0))}%` }}/></span><b>{Math.max(0, Math.min(100, Number(item.progress) || 0))}%</b></div>}</div><p>{item.action || item.comment || "Prochaine action à compléter."}</p><span className={`report-pill tone-${toneForStatus(item.status)}`}>{item.status}</span></div>)}</div> : <div className="report-empty">Aucun dossier renseigné</div>}</article>,
    operations: <article className="report-focus report-standalone"><div className="report-heading"><div><small>Planner et saisies manuelles</small><h2>Simulations et opérations</h2></div></div>{data.operations.length ? <div className="report-simulations">{data.operations.map((item, index) => <section className={`report-simulation simulation-${index % 2 ? "violet" : "mint"} ${item.plannerSource ? "planner-simulation" : ""}`} key={item.id}><div><span className={`report-pill tone-${toneForStatus(item.state)}`}>{item.state}</span>{item.plannerSource && <span className="planner-source-pill">Planner</span>}</div><small>{item.month || "Mois à définir"}</small><h3>{item.name || "Opération sans titre"}</h3><p>{item.summary}</p>{item.plannerSource && <div className="simulation-metrics"><SupplierTurnover value={item.plannerSource.metrics.purchases12m}/>{item.plannerSource.variationHistory?.length ? <SupplierSparkline points={item.plannerSource.variationHistory} label={item.plannerSource.supplierLabel || item.name}/> : <div className="supplier-variation-missing"><Icon name="trend" size={15}/><span>Variation fournisseur non renseignée dans Planner</span></div>}</div>}<div className="simulation-steps">{item.steps.map(([label, state]) => <div className="report-step" key={label}><span>{label}</span><strong className={`tone-text-${toneForStatus(state)}`}><i/>{state}</strong></div>)}</div></section>)}</div> : <div className="report-empty">Aucune simulation ou opération renseignée</div>}</article>,
    alerts: <article className="report-alert-card"><div className="alert-heading"><h2>Vigilances du point</h2></div>{alerts.length > 0 && <div className="alert-filters"><button type="button" className={alertFilter === "all" ? "active" : ""} onClick={() => setAlertFilter("all")}>Toutes</button><button type="button" className={alertFilter === "danger" ? "active" : ""} onClick={() => setAlertFilter("danger")}>Critiques</button></div>}{visibleAlerts.length ? visibleAlerts.map((item, index) => <a className="alert-line alert-line-clean" key={`${item.title}-${index}`} href={item.targetId ? `#${item.targetId}` : "#top"}><div><strong>{item.title}</strong><small><b>{item.category}</b> · {item.detail}</small></div><Icon name="chevron" size={14}/></a>) : <div className="report-empty light-empty">{alerts.length ? "Aucune vigilance dans ce filtre" : "Aucune vigilance détectée"}</div>}</article>,
  };
  return <div className="report-canvas"><div className="report-ambient report-ambient-one"/><div className="report-ambient report-ambient-two"/>
    <header className="report-hero"><div><div className="market-badge"><i/> MARKET PULSE <b>/</b> {market.short}</div><h1>Point marché</h1><p><strong>{market.name}</strong><span>Dossiers · simulations tarifaires · Jira</span></p></div><div className="week-card"><strong><small>{isoWeekYear(data.meetingDate)} ·</small>S{String(isoWeek(data.meetingDate)).padStart(2, "0")}</strong><i/><div><b>{dateLabel(data.meetingDate)}</b><span>Année et semaine ISO</span></div></div></header>
    <section className="report-priority"><span>Priorité de la semaine</span><strong>{data.priority || "Aucune priorité renseignée."}</strong></section>
    <div className="report-module-grid">{data.preferences.moduleOrder.filter((module) => modules[module]).map((module) => <div key={module} className={`report-module-item width-${data.preferences.moduleWidths[module]}`}>{content[module]}</div>)}</div>
    <footer className="report-footer"><span>Market Pulse · {market.name}</span><span>Point marché · {isoWeekYear(data.meetingDate)} · S{String(isoWeek(data.meetingDate)).padStart(2, "0")}</span></footer>
  </div>;
}

function buildMailHtml(data: PointData, market: Market, archive: PointRecord[]) {
  const alerts = buildAlerts(data, market);
  const stats = jiraDashboardStats(data, market, archive);
  const theme = themes.find((item) => item.id === data.themeColor) ?? themes[0];
  const accent = normalizeHex(data.customColor) || theme.accent;
  const modules = data.preferences.mailModules;
  const attentionRank: Record<JiraAttentionLevel, number> = { critical: 0, warning: 1, undated: 2, fresh: 3 };
  const section = (title: string, body: string) => `<tr><td style="padding:0 30px 18px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #DCE5E2;border-radius:12px;background:#FFFFFF"><tr><td style="padding:16px 18px 9px;color:#38524B;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px">${title}</td></tr><tr><td style="padding:0 8px 10px">${body}</td></tr></table></td></tr>`;
  const dossierRows = data.dossiers.map((item) => {
    const progress = Math.max(0, Math.min(100, Number(item.progress) || 0));
    const progressHtml = item.showProgress ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:8px"><tr><td style="height:6px;border-radius:99px;background:#DDE7E3;overflow:hidden"><div style="width:${progress}%;height:6px;background:${accent}"></div></td><td width="38" style="padding-left:8px;color:#41534E;font-size:10px;font-weight:700;text-align:right">${progress}%</td></tr></table>` : "";
    return `<tr><td style="padding:12px 10px;border-bottom:1px solid #E7EDEA"><b style="color:#10201D">${escapeHtml(item.title || "Dossier")}</b><br><span style="color:#667873;font-size:11px">${escapeHtml([item.universe, item.reference, item.owner].filter(Boolean).join(" · "))}</span>${progressHtml}</td><td style="padding:12px 10px;border-bottom:1px solid #E7EDEA;color:#41534E;font-size:12px">${escapeHtml(item.action || item.comment || "—")}</td><td style="padding:12px 10px;border-bottom:1px solid #E7EDEA;text-align:right"><span style="display:inline-block;padding:6px 9px;border-radius:99px;background:#EEF3F1;color:#253E36;font-size:10px;font-weight:700">${escapeHtml(item.status)}</span></td></tr>`;
  }).join("");
  const operationRows = data.operations.map((item) => { const metrics = item.plannerSource?.metrics; const variation = metrics && (metrics.globalVariation !== null || metrics.weightedVariation !== null) ? `<br><span style="display:block;margin-top:4px;color:#126887;font-size:9px">GLOBAL ${metrics.globalVariation === null ? "—" : `${metrics.globalVariation}%`} · pondérée ${metrics.weightedVariation === null ? "—" : `${metrics.weightedVariation}%`}</span>` : ""; return `<tr><td style="padding:11px 10px;border-bottom:1px solid #E7EDEA"><b style="display:block;color:#10201D;font-size:11px">${escapeHtml(item.name || "Simulation ou opération")}</b><span style="display:block;margin-top:3px;color:#70807C;font-size:9px">${escapeHtml(item.month || "Mois à définir")}${item.plannerSource ? " · Planner" : ""}</span></td><td style="padding:11px 10px;border-bottom:1px solid #E7EDEA;color:#41534E;font-size:10px">${escapeHtml(item.summary || "—")}${metrics ? supplierTurnoverHtml(metrics.purchases12m) : ""}${variation}</td><td style="padding:11px 10px;border-bottom:1px solid #E7EDEA;color:#274C40;font-size:9px;font-weight:700;text-align:right">${escapeHtml(item.state || "—")}</td></tr>`; }).join("");
  const sortedJiraRows = stats.rows.slice().sort((left, right) => attentionRank[left.level] - attentionRank[right.level] || (right.inactivity ?? -1) - (left.inactivity ?? -1));
  const jiraRows = groupJiraPeople(sortedJiraRows.map((row) => row.item)).map((person) => `<tr><td colspan="4" style="padding:13px 10px 7px;border-bottom:1px solid #DCE5E2;color:#10201D;font-size:12px;font-weight:700">${escapeHtml(person.assignee)} <span style="color:#72827E;font-weight:400">· ${person.total} ticket${person.total > 1 ? "s" : ""}</span></td></tr>${person.items.map((item) => { const signal = jiraAttention(item, data.meetingDate, market); const key = item.link ? `<a href="${escapeHtml(item.link)}" target="_blank" style="color:#126887;font-weight:700;text-decoration:underline">${escapeHtml(item.key || "Ouvrir")}</a>` : `<span style="color:#566A64;font-weight:700">${escapeHtml(item.key || "Synthèse")}</span>`; const alertColor = signal.level === "critical" ? "#B42318" : signal.level === "warning" ? "#9A5B13" : "#47615A"; const alertBackground = signal.level === "critical" ? "#FEECEB" : signal.level === "warning" ? "#FFF3E4" : "#EEF3F1"; return `<tr><td width="105" style="padding:10px;border-bottom:1px solid #EDF1EF;font-size:10px">${key}</td><td style="padding:10px;border-bottom:1px solid #EDF1EF;color:#263C36;font-size:11px"><b>${escapeHtml(item.summary || "Synthèse de la file Jira")}</b><br><span style="color:#71817D;font-size:9px">${escapeHtml(item.status)}</span></td><td width="115" style="padding:10px;border-bottom:1px solid #EDF1EF;color:#71817D;font-size:9px">${signal.inactivity === null ? "Activité non datée" : `Modifié il y a ${signal.inactivity} j`}</td><td width="95" style="padding:10px;border-bottom:1px solid #EDF1EF;text-align:right"><span style="display:inline-block;padding:5px 7px;border-radius:7px;background:${alertBackground};color:${alertColor};font-size:9px;font-weight:700">${signal.level === "critical" ? "Critique" : signal.level === "warning" ? "À surveiller" : "À jour"}</span></td></tr>`; }).join("")}`).join("");
  const alertRows = alerts.map((item) => `<tr><td style="padding:10px;border-bottom:1px solid #F0D9D3"><b style="display:block;color:${item.severity === "danger" ? "#9B241C" : "#784615"};font-size:11px">${escapeHtml(item.title)}</b><span style="color:#6C5751;font-size:10px">${escapeHtml(item.category)} · ${escapeHtml(item.detail)}</span></td></tr>`).join("");
  const deltaLabel = stats.delta === null ? "—" : `${stats.delta > 0 ? "+" : ""}${stats.delta}`;
  const emptyRow = '<table role="presentation" width="100%"><tr><td style="padding:13px 10px;color:#71817D;font-size:11px">Aucune donnée pour cette section.</td></tr></table>';
  const kpis = [[stats.currentVolume, "Tickets ouverts"], [stats.attentionCount, `Sans activité ≥ ${market.jiraWarningDays} j`], [stats.criticalCount, `Critiques ≥ ${market.jiraCriticalDays} j`], [deltaLabel, "Écart vs dernier point"]];
  const mailSections: Record<PointModule, string> = {
    jira: section("Tickets Jira · alertes prioritaires", `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${jiraRows || '<tr><td style="padding:13px 10px;color:#71817D;font-size:11px">Aucun ticket actif.</td></tr>'}</table>`),
    dossiers: section("Dossiers en cours", dossierRows ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${dossierRows}</table>` : emptyRow),
    operations: section("Simulations et opérations", operationRows ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${operationRows}</table>` : emptyRow),
    alerts: section("Vigilances du point", alertRows ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${alertRows}</table>` : emptyRow),
  };
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(data.mail.subject)}</title></head><body style="margin:0;padding:0;background:#FFFFFF;font-family:Arial,sans-serif;color:#10201D"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#FFFFFF"><tr><td align="center" style="padding:24px 10px"><table role="presentation" width="900" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:900px;background:#FFFFFF;border:1px solid #DCE5E2;border-top:5px solid ${accent}">
  <tr><td style="padding:26px 30px 18px;background:#FFFFFF"><span style="color:#46615A;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px">Market Pulse / ${escapeHtml(market.short)}</span><table role="presentation" width="100%"><tr><td><h1 style="margin:8px 0 4px;color:#10201D;font-size:31px;line-height:36px">Point marché</h1><p style="margin:0;color:#38524B;font-size:15px;font-weight:700">${escapeHtml(market.name)}</p></td><td align="right" valign="bottom"><b style="display:block;color:#10201D;font-size:18px">${isoWeekYear(data.meetingDate)} · S${String(isoWeek(data.meetingDate)).padStart(2, "0")}</b><span style="color:#71817D;font-size:11px">${escapeHtml(dateLabel(data.meetingDate))}</span></td></tr></table><p style="margin:17px 0 0;color:#41534E;font-size:12px;line-height:18px">${escapeHtml(data.mail.intro || "Bonjour à tous, voici le point d’avancement de la semaine.")}</p></td></tr>
  <tr><td style="padding:0 30px 18px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>${kpis.map(([value, label], index) => `<td width="25%" valign="top" style="padding-right:${index < 3 ? "8px" : "0"}"><table role="presentation" width="100%" style="background:${index === 2 ? "#FEECEB" : index === 1 ? "#FFF3E4" : "#F4F7F6"};border:1px solid ${index === 2 ? "#F6C8C5" : index === 1 ? "#F2D7B6" : "#DCE5E2"}"><tr><td style="padding:13px"><b style="display:block;color:${index === 2 ? "#B42318" : index === 1 ? "#9A5B13" : "#10201D"};font-size:22px">${value}</b><span style="color:#61736E;font-size:9px;text-transform:uppercase">${label}</span></td></tr></table></td>`).join("")}</tr></table></td></tr>
  <tr><td style="padding:0 30px 18px"><table role="presentation" width="100%" style="background:#F4F7F6;border-left:4px solid ${accent}"><tr><td style="padding:13px 15px"><b style="display:block;color:#38524B;font-size:9px;text-transform:uppercase">Priorité de la semaine</b><span style="display:block;margin-top:5px;color:#10201D;font-size:13px">${escapeHtml(data.priority || "Aucune priorité renseignée.")}</span></td></tr></table></td></tr>
  ${data.preferences.moduleOrder.filter((module) => modules[module]).map((module) => mailSections[module]).join("")}
  <tr><td style="padding:18px 30px;border-top:1px solid #E7EDEA;background:#FFFFFF;color:#71817D;font-size:9px;text-transform:uppercase">Market Pulse · ${escapeHtml(market.name)} · la pièce jointe HTML conserve les filtres et les liens interactifs</td></tr></table></td></tr></table></body></html>`;
}

function buildInteractiveHtml(data: PointData, market: Market, archive: PointRecord[]) {
  const stats = jiraDashboardStats(data, market, archive);
  const modules = data.preferences.htmlModules;
  const theme = themes.find((item) => item.id === data.themeColor) ?? themes[0];
  const accent = normalizeHex(data.customColor) || theme.accent;
  const maxVolume = Math.max(1, ...stats.points.map((point) => point.value));
  const statusColors = ["#B39AFF", "#FF7287", "#70D8FF", "#FFB083", "#FFD56A", "#72F5C5"];
  const trendBars = stats.points.map((point, index) => `<div class="trend-bar ${index === stats.points.length - 1 ? "current" : ""}"><b>${point.value}</b><span><i style="height:${Math.max(7, (point.value / maxVolume) * 100)}%"></i></span><small>${escapeHtml(point.label)}</small></div>`).join("");
  const statusButtons = stats.statusTotals.map((item, index) => `<button type="button" data-status="${escapeHtml(item.status)}"><i style="background:${statusColors[index % statusColors.length]}"></i>${escapeHtml(item.status)} <b>${item.value}</b></button>`).join("");
  const statusSegments = stats.statusTotals.map((item, index) => `<button type="button" title="${escapeHtml(item.status)} : ${item.value}" data-status="${escapeHtml(item.status)}" style="width:${(item.value / Math.max(1, stats.currentVolume)) * 100}%;background:${statusColors[index % statusColors.length]}"></button>`).join("");
  const attentionRank: Record<JiraAttentionLevel, number> = { critical: 0, warning: 1, undated: 2, fresh: 3 };
  const people = groupJiraPeople(stats.rows.slice().sort((left, right) => attentionRank[left.level] - attentionRank[right.level] || (right.inactivity ?? -1) - (left.inactivity ?? -1)).map((row) => row.item));
  const peopleHtml = people.map((person) => {
    const rows = person.items.map((item) => {
      const signal = jiraAttention(item, data.meetingDate, market);
      const activity = signal.inactivity === null ? "Activité non datée" : signal.inactivity === 0 ? "Mise à jour aujourd’hui" : `Dernière modification il y a ${signal.inactivity} jours`;
      const content = `<span>${escapeHtml(item.key || "Synthèse")}</span><div><strong>${escapeHtml(item.summary || "Synthèse de la file Jira")}</strong><small>${escapeHtml(item.status)} · ${escapeHtml(activity)}</small></div><b>${signal.level === "critical" ? `Critique · ${signal.inactivity} j` : signal.level === "warning" ? `À surveiller · ${signal.inactivity} j` : jiraItemCount(item) > 1 ? jiraItemCount(item) : "À jour"}</b>`;
      const attributes = `class="ticket-row ${signal.level}" data-level="${signal.level}" data-status="${escapeHtml(item.status)}" data-count="${jiraItemCount(item)}"`;
      return item.link ? `<a ${attributes} href="${escapeHtml(item.link)}" target="_blank" rel="noreferrer" title="Ouvrir ${escapeHtml(item.key || "le ticket")} dans Jira">${content}</a>` : `<div ${attributes}>${content}</div>`;
    }).join("");
    return `<details class="person-card"><summary><span class="avatar">${escapeHtml(person.assignee.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase())}</span><span><strong>${escapeHtml(person.assignee)}</strong><small>${escapeHtml(jiraStatusSummary(person.items))}</small></span><b>${person.total}</b><i>⌄</i></summary><div class="tickets">${rows}</div></details>`;
  }).join("");
  const dossiers = data.dossiers.map((item) => {
    const progress = Math.max(0, Math.min(100, Number(item.progress) || 0));
    const progressHtml = item.showProgress ? `<div class="dossier-progress"><span><i style="width:${progress}%"></i></span><strong>${progress}%</strong></div>` : "";
    return `<article><strong>${escapeHtml(item.title || "Dossier")}</strong><span>${escapeHtml([item.universe, item.reference, item.owner].filter(Boolean).join(" · "))}</span>${progressHtml}<p>${escapeHtml(item.action || item.comment || "Prochaine action à compléter.")}</p><b>${escapeHtml(item.status)}</b></article>`;
  }).join("");
  const variationSvg = (points: SupplierVariationPoint[]) => {
    if (!points.length) return "";
    const width = 520; const height = 150; const padding = 24;
    const values = points.flatMap((point) => [point.globalVariation, point.weightedVariation]).filter((value): value is number => value !== null);
    if (!values.length) return "";
    const rawMin = Math.min(...values); const rawMax = Math.max(...values); const span = Math.max(1, rawMax - rawMin); const min = rawMin - span * .18; const max = rawMax + span * .18;
    const x = (index: number) => padding + (points.length === 1 ? (width - padding * 2) / 2 : index / (points.length - 1) * (width - padding * 2));
    const y = (value: number) => height - padding - (value - min) / Math.max(.01, max - min) * (height - padding * 2);
    const path = (key: "globalVariation" | "weightedVariation") => { let drawing = false; return points.map((point, index) => { const value = point[key]; if (value === null) { drawing = false; return ""; } const command = drawing ? "L" : "M"; drawing = true; return `${command}${x(index).toFixed(1)},${y(value).toFixed(1)}`; }).join(" "); };
    const dots = (key: "globalVariation" | "weightedVariation", color: string) => points.map((point, index) => point[key] === null ? "" : `<circle cx="${x(index)}" cy="${y(point[key] as number)}" r="3" fill="${color}"><title>${escapeHtml(point.period)} · ${key === "globalVariation" ? "GLOBAL" : "Pondérée"} ${point[key]}%</title></circle>`).join("");
    return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Évolution des variations"><line x1="${padding}" y1="${height / 2}" x2="${width - padding}" y2="${height / 2}" stroke="#274147" stroke-width="1"/><path d="${path("globalVariation")}" fill="none" stroke="#70d8ff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="${path("weightedVariation")}" fill="none" stroke="#b39aff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${dots("globalVariation", "#70d8ff")}${dots("weightedVariation", "#b39aff")}</svg>`;
  };
  const operations = data.operations.map((item, index) => {
    const history = item.plannerSource?.variationHistory ?? [];
    const chart = variationSvg(history);
    const latest = history.at(-1);
    const dialogId = `variation-modal-${index}`;
    const values = history.map((point) => `<span>${escapeHtml(point.period)} · GLOBAL <b>${point.globalVariation === null ? "—" : `${point.globalVariation}%`}</b> · pondérée <b>${point.weightedVariation === null ? "—" : `${point.weightedVariation}%`}</b></span>`).join("");
    const variation = chart ? `<button type="button" class="variation-trigger" data-open-variation="${dialogId}"><span><small>Évolution fournisseur</small><strong>GLOBAL ${latest?.globalVariation === null ? "—" : `${latest?.globalVariation}%`} · pondérée ${latest?.weightedVariation === null ? "—" : `${latest?.weightedVariation}%`}</strong></span>${chart}<b>Ouvrir</b></button><dialog class="variation-modal" id="${dialogId}"><div class="variation-modal-head"><div><small>Évolution fournisseur</small><strong>${escapeHtml(item.plannerSource?.supplierLabel || item.name || "Fournisseur")}</strong></div><button type="button" data-close-variation aria-label="Fermer">×</button></div>${chart}<div class="variation-legend"><span><i class="global"></i>Variation GLOBAL</span><span><i class="weighted"></i>Variation pondérée</span></div><div class="variation-values">${values}</div></dialog>` : item.plannerSource ? `<span class="variation-missing">Variation fournisseur non renseignée dans Planner</span>` : "";
    return `<article><strong>${escapeHtml(item.name || "Opération")}</strong><span>${escapeHtml(item.month || "Mois à définir")}</span><p>${escapeHtml(item.summary || "")}</p>${item.plannerSource ? supplierTurnoverHtml(item.plannerSource.metrics.purchases12m) : ""}<b>${escapeHtml(item.state)}</b>${variation}</article>`;
  }).join("");
  const otherAlerts = buildAlerts(data, market).filter((item) => item.category !== "Jira").map((item) => `<article class="${item.severity}"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.category)} · ${escapeHtml(item.detail)}</span></article>`).join("");
  const deltaLabel = stats.delta === null ? "—" : `${stats.delta > 0 ? "+" : ""}${stats.delta}`;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(data.mail.subject)} · interactif</title><style>
  :root{--accent:${accent};--bg:#061012;--surface:#0d1a1d;--line:#23383c;--text:#f3f8f6;--muted:#89a0a3;--aqua:#70d8ff;--peach:#ffb083;--red:#ff7287}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 80% 0,color-mix(in srgb,var(--accent) 13%,transparent),transparent 32%),var(--bg);color:var(--text);font-family:Arial,sans-serif}.shell{width:min(1180px,calc(100% - 30px));margin:auto;padding:30px 0 50px}.hero{display:flex;justify-content:space-between;gap:20px;align-items:end;margin-bottom:20px}.eyebrow{color:var(--accent);font:700 11px/1 monospace;text-transform:uppercase}.hero h1{margin:10px 0 5px;font-size:42px}.hero p{margin:0;color:var(--muted)}.week{padding:14px 18px;border:1px solid var(--line);border-radius:16px;background:var(--surface);text-align:right}.week strong{display:block;color:var(--accent);font:800 24px/1 monospace}.priority{margin-bottom:16px;padding:15px 17px;border-left:4px solid var(--accent);border-radius:12px;background:color-mix(in srgb,var(--accent) 9%,var(--surface))}.priority span{display:block;margin-bottom:5px;color:var(--accent);font-size:10px;font-weight:700;text-transform:uppercase}.jira{padding:20px;border:1px solid #29454b;border-radius:22px;background:linear-gradient(145deg,#0d1b1f,#081315);box-shadow:0 25px 70px #0005}.jira-head{display:flex;justify-content:space-between;gap:20px}.jira-head h2{margin:5px 0 0;font-size:25px}.jira-head p{max-width:650px;margin:7px 0 0;color:var(--muted);font-size:12px}.delta{text-align:right}.delta strong{display:block;color:var(--aqua);font:800 26px/1 monospace}.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:18px 0}.kpis button{padding:15px;border:1px solid var(--line);border-radius:14px;color:var(--text);background:#ffffff05;text-align:left;cursor:pointer}.kpis button:hover,.kpis button.active{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 9%,transparent)}.kpis span,.kpis small{display:block;color:var(--muted);font-size:10px}.kpis strong{display:block;margin:5px 0;font:800 26px/1 monospace}.kpis .warning strong{color:var(--peach)}.kpis .critical strong{color:var(--red)}.visuals{display:grid;grid-template-columns:.7fr 1.3fr;gap:12px}.panel{padding:15px;border:1px solid var(--line);border-radius:15px;background:#ffffff04}.panel>strong{font-size:13px}.trend{display:flex;align-items:end;justify-content:center;gap:12px;height:130px;margin-top:10px}.trend-bar{display:grid;grid-template-rows:auto 78px auto;gap:5px;text-align:center}.trend-bar>b,.trend-bar>small{font:700 10px/1 monospace}.trend-bar>span{display:flex;align-items:end;width:22px;margin:auto;border-radius:6px;background:#ffffff07;overflow:hidden}.trend-bar i{display:block;width:100%;background:#35545b}.trend-bar.current i{background:var(--aqua)}.status-bar{display:flex;height:10px;margin:15px 0 12px;border-radius:99px;overflow:hidden;background:#ffffff09}.status-bar button{min-width:3px;padding:0;border:0;cursor:pointer}.status-buttons{display:flex;flex-wrap:wrap;gap:7px}.status-buttons button{display:flex;gap:6px;align-items:center;padding:7px 9px;border:1px solid var(--line);border-radius:9px;color:var(--muted);background:transparent;font-size:10px;cursor:pointer}.status-buttons button i{width:7px;height:7px;border-radius:50%}.status-buttons button.active{border-color:var(--accent);color:var(--text);background:#ffffff08}.filter-line{display:flex;justify-content:space-between;align-items:center;margin:14px 0;padding:10px 12px;border-radius:10px;background:#ffffff05;color:var(--muted);font-size:11px}.filter-line strong{color:var(--aqua)}.filter-line button{border:0;color:var(--accent);background:transparent;cursor:pointer}.people{display:grid;gap:8px}.person-card{border:1px solid var(--line);border-radius:14px;background:#ffffff03;overflow:hidden}.person-card[open]{border-color:#3b5c63}.person-card summary{display:grid;grid-template-columns:38px 1fr auto 18px;align-items:center;gap:10px;padding:12px;cursor:pointer;list-style:none}.person-card summary::-webkit-details-marker{display:none}.avatar{display:grid;place-items:center;width:38px;height:38px;border-radius:11px;color:var(--aqua);background:#70d8ff13;font:700 11px monospace}.person-card summary>span:nth-child(2){display:grid;gap:4px}.person-card summary small{color:var(--muted);font-size:10px}.person-card summary>b{font:800 16px monospace}.tickets{border-top:1px solid var(--line)}.ticket-row{display:grid;grid-template-columns:110px 1fr auto;align-items:center;gap:12px;padding:11px 13px;border-bottom:1px solid #ffffff0b;color:inherit;text-decoration:none}.ticket-row:hover{background:#ffffff08}.ticket-row:last-child{border-bottom:0}.ticket-row>span{color:var(--aqua);font:700 10px monospace}.ticket-row>div{display:grid;gap:3px}.ticket-row small{color:var(--muted);font-size:10px}.ticket-row>b{padding:6px 8px;border-radius:8px;color:#8fa4a7;background:#ffffff08;font-size:9px}.ticket-row.warning{background:#ffb08308}.ticket-row.warning>b{color:var(--peach);background:#ffb08313}.ticket-row.critical{border-left:4px solid var(--red);background:#ff72870b}.ticket-row.critical>b{color:var(--red);background:#ff728717}.empty{padding:25px;color:var(--muted);text-align:center}.point-grid{display:grid;grid-template-columns:1.35fr .65fr;gap:14px;margin-top:16px}.section{padding:18px;border:1px solid var(--line);border-radius:18px;background:var(--surface)}.section h2{margin:0 0 13px;font-size:18px}.cards{display:grid;gap:8px}.cards article{position:relative;display:grid;gap:4px;padding:12px;border:1px solid #ffffff0d;border-radius:11px;background:#ffffff03}.cards article span,.cards article small{color:var(--muted);font-size:10px}.cards article p{margin:4px 0;color:#c6d2d1;font-size:11px;line-height:1.45}.cards article>b{justify-self:start;margin-top:3px;padding:5px 7px;border-radius:7px;color:var(--accent);background:color-mix(in srgb,var(--accent) 10%,transparent);font-size:9px}.dossier-progress{display:grid;grid-template-columns:1fr auto;align-items:center;gap:8px;margin-top:5px}.dossier-progress>span{height:6px;border-radius:99px;background:#ffffff0c;overflow:hidden}.dossier-progress>span>i{display:block;height:100%;border-radius:99px;background:var(--accent)}.dossier-progress>strong{color:var(--accent);font:700 9px/1 monospace}.alerts article.warning{border-color:#ffb0832b}.alerts article.danger{border-color:#ff72873a}.variation-trigger{display:grid;grid-template-columns:1fr 150px auto;align-items:center;gap:10px;width:100%;margin-top:9px;padding:9px 10px;border:1px solid #70d8ff35;border-radius:10px;color:var(--text);background:#70d8ff08;text-align:left;cursor:pointer}.variation-trigger>span{display:grid;gap:4px}.variation-trigger svg{display:block;width:150px;height:42px}.variation-trigger>b{color:var(--aqua);font-size:9px}.variation-missing{margin-top:8px;padding:8px 9px;border:1px dashed var(--line);border-radius:9px}.variation-modal{width:min(720px,calc(100% - 24px));padding:18px;border:1px solid #35565d;border-radius:18px;color:var(--text);background:#0b171a;box-shadow:0 30px 100px #000b}.variation-modal::backdrop{background:#020708cc}.variation-modal-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.variation-modal-head>div{display:grid;gap:4px}.variation-modal-head small{color:var(--aqua);font-size:9px;text-transform:uppercase}.variation-modal-head strong{font-size:18px}.variation-modal-head button{width:34px;height:34px;border:1px solid var(--line);border-radius:10px;color:var(--text);background:transparent;font-size:22px;cursor:pointer}.variation-modal>svg{display:block;width:100%}.variation-legend{display:flex;gap:14px;margin:8px 0 12px;color:var(--muted);font-size:9px}.variation-legend span{display:flex;align-items:center;gap:6px}.variation-legend i{width:18px;height:3px;border-radius:3px}.variation-legend .global{background:var(--aqua)}.variation-legend .weighted{background:#b39aff}.variation-values{display:grid;gap:4px}.variation-values span{font:700 9px/1.4 monospace}.variation-values b{color:var(--text)}.footer{padding:18px 0;color:#60777b;font:700 10px monospace;text-transform:uppercase}[hidden]{display:none!important}@media(max-width:760px){.hero,.jira-head{align-items:flex-start;flex-direction:column}.week,.delta{text-align:left}.kpis,.visuals,.point-grid{grid-template-columns:1fr}.ticket-row{grid-template-columns:1fr}.variation-trigger{grid-template-columns:1fr}.variation-trigger svg{width:100%}.shell{width:min(100% - 18px,1180px)}}
  </style></head><body><main class="shell"><header class="hero"><div><span class="eyebrow">Market Pulse / ${escapeHtml(market.short)}</span><h1>Point marché</h1><p>${escapeHtml(market.name)} · ${escapeHtml(dateLabel(data.meetingDate))}</p></div><div class="week"><strong>${isoWeekYear(data.meetingDate)} · S${String(isoWeek(data.meetingDate)).padStart(2, "0")}</strong><span>Semaine ISO</span></div></header><section class="priority"><span>Priorité de la semaine</span><strong>${escapeHtml(data.priority || "Aucune priorité renseignée.")}</strong></section>
  ${modules.jira ? `<section class="jira"><header class="jira-head"><div><span class="eyebrow">Radar Jira interactif</span><h2>Tickets ouverts du marché</h2><p>Les tickets en alerte sont placés en premier. Utilisez les filtres, ouvrez une personne puis cliquez sur un ticket pour accéder à Jira.</p></div><div class="delta"><small>Depuis le dernier point</small><strong>${deltaLabel}</strong></div></header><div class="kpis"><button type="button" class="active" data-scope="all"><span>Tickets ouverts</span><strong>${stats.currentVolume}</strong><small>Stock actuel</small></button><button type="button" class="warning" data-scope="attention"><span>Sans activité</span><strong>${stats.attentionCount}</strong><small>Depuis ${market.jiraWarningDays} jours</small></button><button type="button" class="critical" data-scope="critical"><span>Attention forte</span><strong>${stats.criticalCount}</strong><small>Depuis ${market.jiraCriticalDays} jours</small></button></div><div class="visuals"><article class="panel"><strong>Évolution du volume</strong><div class="trend">${trendBars}</div></article><article class="panel"><strong>Répartition par statut</strong><div class="status-bar">${statusSegments || "<i></i>"}</div><div class="status-buttons"><button type="button" class="active" data-status="all">Tous</button>${statusButtons}</div></article></div><div class="filter-line"><span><strong id="visible-total">${stats.currentVolume}</strong> tickets affichés</span><button type="button" id="reset-filter">Réinitialiser</button></div><div class="people">${peopleHtml || '<div class="empty">Aucun ticket Jira actif.</div>'}</div></section>` : ""}
  ${(modules.dossiers || modules.operations || modules.alerts) ? `<div class="point-grid"><div>${modules.dossiers ? `<section class="section"><h2>Dossiers en cours</h2><div class="cards">${dossiers || '<div class="empty">Aucun dossier renseigné.</div>'}</div></section>` : ""}${modules.operations ? `<section class="section"${modules.dossiers ? ' style="margin-top:14px"' : ""}><h2>Simulations et opérations</h2><div class="cards">${operations || '<div class="empty">Aucune simulation ou opération renseignée.</div>'}</div></section>` : ""}</div><aside>${modules.alerts ? `<section class="section"><h2>Vigilances du point</h2><div class="cards alerts">${otherAlerts || '<div class="empty">Aucune vigilance détectée.</div>'}</div></section>` : ""}</aside></div>` : ""}<footer class="footer">Market Pulse · ${escapeHtml(market.name)} · fichier interactif autonome</footer></main>
  ${modules.jira ? "<script>(function(){var scope='all',status='all';var scopeButtons=[].slice.call(document.querySelectorAll('[data-scope]'));var statusButtons=[].slice.call(document.querySelectorAll('[data-status]'));function refresh(){var total=0;[].slice.call(document.querySelectorAll('.person-card')).forEach(function(card){var visible=0;[].slice.call(card.querySelectorAll('.ticket-row')).forEach(function(row){var level=row.getAttribute('data-level');var rowStatus=row.getAttribute('data-status');var scopeOk=scope==='all'||(scope==='attention'&&(level==='warning'||level==='critical'))||(scope==='critical'&&level==='critical');var statusOk=status==='all'||status===rowStatus;row.hidden=!(scopeOk&&statusOk);if(!row.hidden){visible++;total+=Number(row.getAttribute('data-count')||1);}});card.hidden=visible===0;});document.getElementById('visible-total').textContent=String(total);scopeButtons.forEach(function(button){button.classList.toggle('active',button.getAttribute('data-scope')===scope);});statusButtons.forEach(function(button){button.classList.toggle('active',button.getAttribute('data-status')===status);});}scopeButtons.forEach(function(button){button.addEventListener('click',function(){scope=button.getAttribute('data-scope')||'all';refresh();});});statusButtons.forEach(function(button){button.addEventListener('click',function(){var next=button.getAttribute('data-status')||'all';status=status===next&&next!=='all'?'all':next;refresh();});});document.getElementById('reset-filter').addEventListener('click',function(){scope='all';status='all';refresh();});refresh();})();</script>" : ""}
  ${modules.operations ? "<script>(function(){var openers=[].slice.call(document.querySelectorAll('[data-open-variation]'));openers.forEach(function(button){button.addEventListener('click',function(){var modal=document.getElementById(button.getAttribute('data-open-variation'));if(modal&&modal.showModal)modal.showModal();});});[].slice.call(document.querySelectorAll('.variation-modal')).forEach(function(modal){[].slice.call(modal.querySelectorAll('[data-close-variation]')).forEach(function(button){button.addEventListener('click',function(){modal.close();});});modal.addEventListener('click',function(event){if(event.target===modal)modal.close();});});})();</script>" : ""}</body></html>`;
}

export function MarketPulseApp() {
  return <AppearanceProvider><MarketPulseWorkspace/></AppearanceProvider>;
}

function MarketPulseWorkspace() {
  const [marketOptions, setMarketOptions] = useState<Market[]>(defaultMarkets);
  const [marketId, setMarketId] = useState("revetements-menuiserie");
  const [data, setData] = useState<PointData>(() => initialData());
  const [view, setView] = useState<View>("read");
  const [section, setSection] = useState<Section>("general");
  const [ready, setReady] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null);
  const [archive, setArchive] = useState<PointRecord[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(true);
  const [archiveError, setArchiveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [marketSavingId, setMarketSavingId] = useState("");
  const [creatingMarket, setCreatingMarket] = useState(false);
  const [directoryUsers, setDirectoryUsers] = useState<GlobalDirectoryUser[]>([]);
  const [directoryReady, setDirectoryReady] = useState(false);
  const [plannerTasks, setPlannerTasks] = useState<PlannerTask[]>([]);
  const [plannerReady, setPlannerReady] = useState(false);
  const [plannerUpdatedAt, setPlannerUpdatedAt] = useState("");
  const [plannerRegistry, setPlannerRegistry] = useState<PlannerRegistrySummary>(() => emptyPlannerRegistry());
  const [directorySavingId, setDirectorySavingId] = useState("");
  const [directoryEditor, setDirectoryEditor] = useState<DirectoryEditor | null>(null);
  const [lastSavedSignature, setLastSavedSignature] = useState("");
  const [toast, setToast] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(() => monthStart(isoToday()));
  const [session, setSession] = useState<SessionPayload>({ user: null });
  const [sessionReady, setSessionReady] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginDestination, setLoginDestination] = useState<View>("edit");
  const [loginUsername, setLoginUsername] = useState("GLOBAL");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [carryoverOpen, setCarryoverOpen] = useState(false);
  const [carryoverSelection, setCarryoverSelection] = useState<Record<string, boolean>>({});
  const [calendarExpanded, setCalendarExpanded] = useState(false);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const [directorySort, setDirectorySort] = useState<{ key: "name" | "role" | "market"; direction: "asc" | "desc" }>({ key: "name", direction: "asc" });
  const fileInput = useRef<HTMLInputElement>(null);
  const archiveRequest = useRef(0);
  const confirmResolver = useRef<((confirmed: boolean) => void) | null>(null);
  const market = marketOptions.find((item) => item.id === marketId) ?? marketOptions[0] ?? defaultMarkets[0];
  const marketPlannerTagsKey = market.plannerTags.join("|");
  const theme = themes.find((item) => item.id === data.themeColor) ?? themes[0];
  const accent = normalizeHex(data.customColor) || theme.accent;
  const themeStyle = useMemo(() => accentTokens(accent) as CSSProperties, [accent]);
  const alerts = useMemo(() => buildAlerts(data, market), [data, market]);
  const mailHtml = useMemo(() => view === "mail" ? buildMailHtml(data, market, archive) : "", [archive, data, market, view]);
  const interactiveHtml = useMemo(() => view === "mail" ? buildInteractiveHtml(data, market, archive) : "", [archive, data, market, view]);
  const htmlAttachmentName = interactiveAttachmentName(data, market);
  const isDirty = pointSignature(marketId, data) !== lastSavedSignature;
  const currentWeek = isoWeek(data.meetingDate);
  const currentWeekYear = isoWeekYear(data.meetingDate);
  const currentWeekPoint = archive.find((item) => item.week === currentWeek && item.year === currentWeekYear);
  const previousPoint = archive.find((item) => item.year < currentWeekYear || (item.year === currentWeekYear && item.week < currentWeek));
  const calendarWeeks = useMemo(() => weeksForMonth(calendarMonth), [calendarMonth]);
  const jiraPeople = useMemo(() => groupJiraPeople(data.jira), [data.jira]);
  const jiraActivityRows = useMemo(() => data.jira.filter((item) => item.key).map((item) => ({ item, inactivity: item.lastActivity ? daysBetween(item.lastActivity, data.meetingDate) : null })).sort((a, b) => (b.inactivity ?? -1) - (a.inactivity ?? -1)), [data.jira, data.meetingDate]);
  const automaticMailToUsers = directoryUsers.filter((user) => roleMailMode(user.role) === "to" && (user.role === "manager-tarif" || user.marketIds.includes(marketId)));
  const automaticMarketMailUsers = automaticMailToUsers.filter((user) => user.role !== "manager-tarif");
  const automaticTariffManager = automaticMailToUsers.find((user) => user.role === "manager-tarif");
  const directoryDraft = directoryEditor?.draft;
  const directoryDraftNeedsMarket = Boolean(directoryDraft && directoryDraft.role !== "manager-tarif" && roleMailMode(directoryDraft.role) === "to");
  const directoryDraftValid = Boolean(directoryDraft?.name && directoryDraft.email && (!directoryDraft.usercode || /^[A-Z]\d{7}$/.test(directoryDraft.usercode)) && (!directoryDraft || !roleUsesAutomaticJira(directoryDraft.role) || /^[A-Z]\d{7}$/.test(directoryDraft.usercode)) && (!directoryDraftNeedsMarket || directoryDraft?.marketIds[0]));
  const carryoverSelectedCount = Object.values(carryoverSelection).filter(Boolean).length;
  const sortedDirectoryUsers = useMemo(() => directoryUsers.slice().sort((left, right) => {
    const marketName = (user: GlobalDirectoryUser) => user.marketIds[0] ? marketOptions.find((item) => item.id === user.marketIds[0])?.name ?? "" : user.role === "manager-tarif" ? "Tous les marchés" : "";
    const leftValue = directorySort.key === "name" ? left.name : directorySort.key === "role" ? roleLabel(left.role) : marketName(left);
    const rightValue = directorySort.key === "name" ? right.name : directorySort.key === "role" ? roleLabel(right.role) : marketName(right);
    const compared = leftValue.localeCompare(rightValue, "fr", { numeric: true, sensitivity: "base" });
    return directorySort.direction === "asc" ? compared : -compared;
  }), [directorySort, directoryUsers, marketOptions]);
  const toggleDirectorySort = (key: typeof directorySort.key) => setDirectorySort((current) => ({ key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc" }));

  const loadMarket = useCallback(async (nextMarket: string, loadLatest = true, marketOverride?: Market) => {
    const requestId = ++archiveRequest.current;
    setMarketId(nextMarket);
    setArchiveLoading(true);
    setArchiveError("");
    try {
      const points = await fetchPointRecords(nextMarket, marketOverride);
      if (requestId !== archiveRequest.current) return;
      setArchive(points);
      if (loadLatest) {
        const draft = readLocalDraft("market", nextMarket);
        const latest = points[0];
        if (draft) {
          const nextData = await applyJiraWeek(normalizePointData(draft.data, nextMarket, marketOverride), nextMarket);
          setData(nextData);
          setCalendarMonth(monthStart(nextData.meetingDate));
          const saved = points.find((point) => point.year === isoWeekYear(nextData.meetingDate) && point.week === isoWeek(nextData.meetingDate));
          setActiveRecordId(saved?.id ?? null);
          setSavedAt(saved ? new Date(saved.createdAt) : null);
          setLastSavedSignature(saved ? pointSignature(nextMarket, saved.data) : "");
        } else if (latest) {
          const nextData = await applyJiraWeek(normalizePointData(latest.data, nextMarket, marketOverride), nextMarket);
          setData(nextData);
          setCalendarMonth(monthStart(nextData.meetingDate));
          setActiveRecordId(latest.id);
          setSavedAt(new Date(latest.createdAt.replace(" ", "T") + (latest.createdAt.includes("Z") ? "" : "Z")));
          setLastSavedSignature(pointSignature(nextMarket, nextData));
        } else {
          const nextData = await applyJiraWeek(initialData(nextMarket, marketOverride), nextMarket);
          setData(nextData);
          setCalendarMonth(monthStart(nextData.meetingDate));
          setActiveRecordId(null);
          setSavedAt(null);
          setLastSavedSignature("");
        }
      }
    } catch (error) {
      if (requestId !== archiveRequest.current) return;
      setArchive([]);
      setArchiveError(error instanceof Error ? error.message : "Impossible de charger les sauvegardes.");
      if (loadLatest) {
        const nextData = await applyJiraWeek(initialData(nextMarket, marketOverride), nextMarket);
        setData(nextData);
        setCalendarMonth(monthStart(nextData.meetingDate));
        setActiveRecordId(null);
        setSavedAt(null);
        setLastSavedSignature("");
      }
    } finally {
      if (requestId === archiveRequest.current) {
        setArchiveLoading(false);
        setReady(true);
      }
    }
  }, []);

  const bootstrap = useCallback(async () => {
    try {
      const loadedMarkets = await fetchMarkets();
      const options = loadedMarkets.length ? loadedMarkets : defaultMarkets;
      setMarketOptions(options);
      const firstMarket = options.find((item) => item.id === "revetements-menuiserie") ?? options[0];
      await loadMarket(firstMarket.id, true, firstMarket);
    } catch (error) {
      setMarketOptions(defaultMarkets);
      await loadMarket(defaultMarkets[0].id, true, defaultMarkets[0]);
      setToast(error instanceof Error ? error.message : "Impossible de charger les marchés.");
    }
  }, [loadMarket]);

  const loadDirectory = useCallback(async () => {
    setDirectoryReady(false);
    try {
      setDirectoryUsers(await fetchDirectoryUsers());
    } catch (error) {
      setDirectoryUsers([]);
      setToast(error instanceof Error ? error.message : "Impossible de charger l’annuaire GLOBAL.");
    } finally {
      setDirectoryReady(true);
    }
  }, []);

  const loadPlanner = useCallback(async () => {
    setPlannerReady(false);
    try {
      const payload = await fetchPlannerTasks();
      setPlannerTasks(payload.tasks);
      setPlannerRegistry(payload.registry);
      setPlannerUpdatedAt(payload.updatedAt);
    } catch (error) {
      setPlannerTasks([]);
      setPlannerRegistry(emptyPlannerRegistry());
      setToast(error instanceof Error ? error.message : "Impossible de charger les simulations Planner.");
    } finally {
      setPlannerReady(true);
    }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => { void bootstrap(); }, 0); return () => window.clearTimeout(timer); }, [bootstrap]);
  useEffect(() => {
    let active = true;
    void fetch("/api/session", { cache: "no-store" }).then((response) => response.json()).then((payload: SessionPayload) => {
      if (!active) return;
      setSession(payload);
      if (payload.user) {
        void Promise.all([loadDirectory(), loadPlanner()]);
        const requestedMode = new URLSearchParams(window.location.search).get("mode");
        if (requestedMode === "edit" || requestedMode === "analyst" || requestedMode === "stats" || requestedMode === "imports" || requestedMode === "settings") setView(requestedMode);
      }
    }).catch(() => { /* La lecture publique reste disponible. */ }).finally(() => { if (active) setSessionReady(true); });
    return () => { active = false; };
  }, [loadDirectory, loadPlanner]);
  useEffect(() => {
    if (!session.user || !directoryReady) return;
    const timer = window.setTimeout(() => setData((current) => applyDirectoryMail(current, marketId, directoryUsers)), 0);
    return () => window.clearTimeout(timer);
  }, [data, directoryReady, directoryUsers, marketId, session.user]);
  useEffect(() => {
    if (!session.user || !ready || !plannerReady || !plannerTasks.length) return;
    const timer = window.setTimeout(() => setData((current) => ({ ...current, operations: mergePlannerOperations(current.operations, plannerTasksForPoint(plannerTasks, market, current.meetingDate), plannerTasks) })), 0);
    return () => window.clearTimeout(timer);
  }, [data.meetingDate, market, marketPlannerTagsKey, plannerReady, plannerTasks, ready, session.user]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(""), 2600); return () => window.clearTimeout(timer); }, [toast]);
  useEffect(() => {
    if (!isLocalWorkspace() || !ready || archiveLoading || (view !== "edit" && view !== "settings")) return;
    writeLocalDraft({ scope: "market", ownerId: marketId, data });
  }, [archiveLoading, data, marketId, ready, view]);
  useEffect(() => {
    markLocalFormPending("directory-editor", directoryEditor !== null);
    return () => markLocalFormPending("directory-editor", false);
  }, [directoryEditor]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [view]);
  useEffect(() => {
    if (isLocalWorkspace() || !isDirty || (view !== "edit" && view !== "settings")) return;
    const protectDraft = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", protectDraft);
    return () => window.removeEventListener("beforeunload", protectDraft);
  }, [isDirty, view]);

  const requestConfirmation = (request: ConfirmRequest) => new Promise<boolean>((resolve) => {
    confirmResolver.current?.(false);
    confirmResolver.current = resolve;
    setConfirmRequest(request);
  });
  const settleConfirmation = (confirmed: boolean) => {
    const resolver = confirmResolver.current;
    confirmResolver.current = null;
    setConfirmRequest(null);
    resolver?.(confirmed);
  };

  const openLogin = () => {
    setLoginError("");
    setLoginOpen(true);
  };
  const submitLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loginLoading) return;
    setLoginLoading(true);
    setLoginError("");
    try {
      const response = await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: loginUsername, password: loginPassword }) });
      const payload = await response.json() as { user?: SessionPayload["user"]; error?: string };
      if (!response.ok || !payload.user) throw new Error(payload.error || "Connexion impossible.");
      setSession({ user: payload.user });
      setLoginPassword("");
      setLoginOpen(false);
      setView(loginDestination);
      await Promise.all([loadDirectory(), loadPlanner()]);
      setToast(loginDestination === "stats" ? "Connexion réussie. Statistiques ouvertes." : loginDestination === "analyst" ? "Connexion réussie. Point analyste ouvert." : loginDestination === "imports" ? "Connexion réussie. Centre d’import ouvert." : loginDestination === "settings" ? "Connexion réussie. Paramètres ouverts." : "Connexion réussie. Mode édition ouvert.");
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Connexion impossible.");
    } finally {
      setLoginLoading(false);
    }
  };
  const logout = async () => {
    await fetch("/api/logout", { method: "POST" }).catch(() => undefined);
    setSession({ user: null });
    setDirectoryUsers([]);
    setDirectoryReady(false);
    setPlannerTasks([]);
    setPlannerReady(false);
    setPlannerUpdatedAt("");
    setPlannerRegistry(emptyPlannerRegistry());
    setView("read");
    setLoginPassword("");
    setToast("Déconnexion effectuée.");
  };

  const chooseView = (nextView: View) => {
    if ((nextView === "edit" || nextView === "analyst" || nextView === "stats" || nextView === "imports" || nextView === "settings") && !session.user) {
      setLoginDestination(nextView);
      openLogin();
      return;
    }
    if (nextView === "settings") setSection("personalization");
    if (nextView === "edit" && (section === "markets" || section === "users" || section === "personalization")) setSection("general");
    setView(nextView);
  };

  const chooseMarket = async (nextMarket: string) => {
    if (!isLocalWorkspace() && nextMarket !== marketId && (view === "edit" || view === "settings") && isDirty && !await requestConfirmation({ title: "Changer de marché ?", detail: "Les modifications du brouillon actuel ne seront pas enregistrées.", confirmLabel: "Changer de marché", destructive: true })) return;
    if (view === "edit" || view === "settings") writeLocalDraft({ scope: "market", ownerId: marketId, data });
    setSection("general");
    await loadMarket(nextMarket, true, marketOptions.find((item) => item.id === nextMarket));
    setCalendarExpanded(true);
  };
  const updateDossier = (id: string, patch: Partial<Dossier>) => setData((current) => ({ ...current, dossiers: current.dossiers.map((item) => item.id === id ? { ...item, ...patch } : item) }));
  const updateOperation = (id: string, patch: Partial<CommercialOperation>) => setData((current) => ({ ...current, operations: current.operations.map((item) => item.id === id ? { ...item, ...patch } : item) }));
  const updateModuleVisibility = (destination: "readModules" | "mailModules" | "htmlModules", module: PointModule, visible: boolean) => setData((current) => ({ ...current, preferences: { ...current.preferences, [destination]: { ...current.preferences[destination], [module]: visible } } }));
  const updateModuleOrder = (moduleOrder: PointModule[]) => setData((current) => ({ ...current, preferences: { ...current.preferences, moduleOrder } }));
  const updateModuleWidth = (module: PointModule, width: ModuleWidth) => setData((current) => ({ ...current, preferences: { ...current.preferences, moduleWidths: { ...current.preferences.moduleWidths, [module]: width } } }));
  const addDossier = () => setData((current) => ({ ...current, dossiers: [...current.dossiers, { id: uid(), title: "", universe: "", reference: "", status: "En cours", owner: "", action: "", deadline: "", progress: 0, comment: "" }] }));
  const addOperation = () => setData((current) => ({ ...current, operations: [...current.operations, { id: uid(), name: "", month: "", state: "En cours", summary: "", steps: [["Réception de la trame", "À faire"], ["Complétude de la trame", "À faire"], ["Intégration tarif achat", "À faire"], ["Contrôle tarif achat", "À faire"], ["Tarif vente", "À faire"]] }] }));
  const addJira = () => setData((current) => {
    const existing = new Set(current.jira.map((item) => item.assignee));
    let suffix = 1;
    let assignee = "Nouvelle personne";
    while (existing.has(assignee)) assignee = `Nouvelle personne ${++suffix}`;
    return { ...current, jira: [...current.jira, { id: uid(), key: "", summary: "Synthèse manuelle", status: "À faire", priority: "", assignee, lastActivity: "", link: "", comment: "Saisie manuelle", count: 1 }] };
  });
  const renameJiraPerson = (assignee: string, nextName: string) => setData((current) => ({ ...current, jira: current.jira.map((item) => (item.assignee.trim() || "Non assigné") === assignee ? { ...item, assignee: nextName } : item) }));
  const removeJiraPerson = (assignee: string) => setData((current) => ({ ...current, jira: current.jira.filter((item) => (item.assignee.trim() || "Non assigné") !== assignee) }));
  const setJiraPersonCount = (assignee: string, status: string, value: number) => setData((current) => {
    const count = Math.max(0, Math.round(value || 0));
    const isPerson = (item: JiraTicket) => (item.assignee.trim() || "Non assigné") === assignee;
    const matches = current.jira.filter((item) => isPerson(item) && item.status === status);
    if (!count) return { ...current, jira: current.jira.filter((item) => !(isPerson(item) && item.status === status)) };
    if (matches.length) {
      const keptId = matches[0].id;
      return { ...current, jira: current.jira.filter((item) => !(isPerson(item) && item.status === status) || item.id === keptId).map((item) => item.id === keptId ? { ...item, count } : item) };
    }
    return { ...current, jira: [...current.jira, { id: uid(), key: "", summary: "Synthèse manuelle", status, priority: "", assignee, lastActivity: "", link: "", comment: "Saisie manuelle", count }] };
  });

  const synchronizePlannerPoint = (tasks = plannerTasks) => {
    const relevant = plannerTasksForPoint(tasks, market, data.meetingDate);
    setData((current) => ({ ...current, operations: mergePlannerOperations(current.operations, relevant, tasks) }));
    setToast(relevant.length ? `${relevant.length} simulation${relevant.length > 1 ? "s" : ""} Planner synchronisée${relevant.length > 1 ? "s" : ""}.` : "Aucune simulation Planner pour ce marché et cette période.");
    return relevant.length;
  };
  const importPlannerData = async (rawText: string) => {
    const response = await fetch("/api/planner-tasks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rawText }) });
    const payload = await response.json() as { imported?: number; ignoredRows?: number; error?: string };
    if (!response.ok) throw new Error(payload.error || "Import Planner impossible.");
    const refreshed = await fetchPlannerTasks();
    setPlannerTasks(refreshed.tasks);
    setPlannerRegistry(refreshed.registry);
    setPlannerUpdatedAt(refreshed.updatedAt);
    setPlannerReady(true);
    const relevant = plannerTasksForPoint(refreshed.tasks, market, data.meetingDate);
    setData((current) => ({ ...current, operations: mergePlannerOperations(current.operations, relevant, refreshed.tasks) }));
    return {
      imported: payload.imported ?? 0,
      message: `${payload.imported ?? 0} tâche${(payload.imported ?? 0) > 1 ? "s" : ""} enregistrée${(payload.imported ?? 0) > 1 ? "s" : ""} · ${relevant.length} liée${relevant.length > 1 ? "s" : ""} au point actif.`,
    };
  };
  const refreshJiraFromRegistry = async () => {
    const refreshed = await applyJiraWeek(data, marketId, true);
    setData((current) => ({ ...current, jira: refreshed.jira }));
    setToast("Registre Jira actualisé dans le point marché actif.");
  };
  const download = (name: string, content: string, type: string) => { const url = URL.createObjectURL(new Blob([content], { type })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 500); };
  const exportJson = (record?: PointRecord) => {
    const exportMarket = record?.marketId ?? marketId; const exportData = record?.data ?? data; const week = record?.week ?? isoWeek(exportData.meetingDate); const year = record?.year ?? isoWeekYear(exportData.meetingDate); const saved = Boolean(record || activeRecordId);
    const exportMarketInfo = marketOptions.find((item) => item.id === exportMarket);
    download(`point-marche-${exportMarket}-${year}-S${String(week).padStart(2, "0")}-${saved ? "enregistre" : "brouillon"}.json`, JSON.stringify({ schemaVersion: 5, marketId: exportMarket, market: exportMarketInfo ? { name: exportMarketInfo.name, shortCode: exportMarketInfo.short, tone: exportMarketInfo.tone, colorHex: exportMarketInfo.colorHex } : undefined, year, week, data: exportData }, null, 2), "application/json");
  };
  const importJson = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const payload = JSON.parse(String(reader.result)) as { marketId?: string; data?: unknown }; if (!payload.data) throw new Error(); const importedMarketInfo = marketOptions.find((item) => item.id === payload.marketId) ?? market; const importedMarket = importedMarketInfo.id; const importedData = normalizePointData(payload.data, importedMarket, importedMarketInfo); setMarketId(importedMarket); setData(importedData); setCalendarMonth(monthStart(importedData.meetingDate)); setActiveRecordId(null); setSavedAt(null); setLastSavedSignature(""); void loadMarket(importedMarket, false, importedMarketInfo); setToast("JSON importé comme nouveau brouillon."); } catch { setToast("Fichier non reconnu."); } }; reader.readAsText(file); event.target.value = ""; };
  const resetPoint = async () => { if (!await requestConfirmation({ title: "Réinitialiser cette semaine ?", detail: "Le brouillon actuel sera remplacé. Les points déjà enregistrés resteront disponibles dans l’historique.", confirmLabel: "Créer un brouillon vide", destructive: true })) return; const fresh = initialData(marketId, market); fresh.dossiers = []; fresh.operations = []; fresh.tariffs = []; fresh.jira = []; fresh.mail = data.mail; fresh.themeColor = data.themeColor; fresh.customColor = data.customColor; setData(fresh); setCalendarMonth(monthStart(fresh.meetingDate)); setActiveRecordId(null); setSavedAt(null); setLastSavedSignature(""); setToast("Nouveau brouillon créé."); };
  const loadRecord = async (record: PointRecord, nextView: View = view, skipConfirm = false) => {
    if (!skipConfirm && (view === "edit" || view === "settings") && isDirty && !await requestConfirmation({ title: "Charger ce point ?", detail: "Le brouillon non enregistré sera remplacé par le contenu sélectionné.", confirmLabel: "Charger le point", destructive: true })) return;
    const recordMarket = marketOptions.find((item) => item.id === record.marketId) ?? market;
    const nextData = await applyJiraWeek(normalizePointData(record.data, record.marketId, recordMarket), record.marketId);
    setMarketId(record.marketId); setData(nextData); setCalendarMonth(monthStart(nextData.meetingDate)); setActiveRecordId(record.id); setSavedAt(new Date(record.createdAt.replace(" ", "T") + (record.createdAt.includes("Z") ? "" : "Z"))); setLastSavedSignature(pointSignature(record.marketId, nextData)); setSection("general"); setView(nextView); setToast(`${record.year} · S${String(record.week).padStart(2, "0")} chargée.`);
  };
  const chooseWeek = async (value: string) => {
    if (!/^\d{4}-W\d{2}$/.test(value)) return;
    const meetingDate = dateFromWeekInput(value);
    const year = isoWeekYear(meetingDate); const week = isoWeek(meetingDate);
    if (year === currentWeekYear && week === currentWeek) { setCalendarMonth(monthStart(meetingDate)); setCalendarExpanded(false); return; }
    if (!isLocalWorkspace() && (view === "edit" || view === "settings") && isDirty && !await requestConfirmation({ title: "Changer de semaine ?", detail: "Les modifications du brouillon actuel ne seront pas enregistrées.", confirmLabel: "Changer de semaine", destructive: true })) return;
    if (view === "edit" || view === "settings") writeLocalDraft({ scope: "market", ownerId: marketId, data });
    setCalendarMonth(monthStart(meetingDate));
    const latest = archive.find((record) => record.year === year && record.week === week);
    const draft = readLocalDraft("market", marketId, meetingDate);
    if (draft) {
      const nextData = await applyJiraWeek(normalizePointData(draft.data, marketId, market), marketId);
      setData(nextData); setCalendarMonth(monthStart(nextData.meetingDate)); setCalendarExpanded(false);
      setActiveRecordId(latest?.id ?? null); setSavedAt(latest ? new Date(latest.createdAt) : null);
      setLastSavedSignature(latest ? pointSignature(marketId, latest.data) : "");
      setToast(`${year} · S${String(week).padStart(2, "0")} · brouillon du classeur repris.`);
      return;
    }
    if (latest) { await loadRecord(latest, view, true); setCalendarExpanded(false); return; }
    const fresh = initialData(marketId, market);
    fresh.dossiers = []; fresh.operations = []; fresh.tariffs = []; fresh.jira = []; fresh.mail = data.mail;
    fresh.themeColor = data.themeColor; fresh.customColor = data.customColor; fresh.meetingDate = meetingDate;
    const nextData = await applyJiraWeek(fresh, marketId);
    setData(nextData); setCalendarMonth(monthStart(nextData.meetingDate)); setCalendarExpanded(false); setActiveRecordId(null); setSavedAt(null); setLastSavedSignature(""); setToast(`${year} · S${String(week).padStart(2, "0")} ouverte comme nouveau brouillon.`);
  };
  const chooseCurrentWeek = async () => {
    const today = isoToday();
    setCalendarMonth(monthStart(today));
    await chooseWeek(weekInputValue(today));
  };
  const chooseLatestPublished = async () => {
    const latest = archive[0];
    if (latest) { await loadRecord(latest, view); setCalendarExpanded(false); }
  };
  const savePoint = async () => {
    if (saving || !ready) return;
    if (!session.user) { openLogin(); return; }
    if (data.customColor && !validHex(data.customColor)) { setToast("La couleur personnalisée doit suivre le format #RRGGBB."); return; }
    setSaving(true);
    try {
      const response = await fetch("/api/points", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ marketId, marketName: market.name, data }) });
      const payload = await response.json() as { point?: PointRecord; error?: string };
      if (!response.ok || !payload.point) throw new Error(payload.error || "Échec de la sauvegarde.");
      const savedData = normalizePointData(payload.point.data, marketId, market); const saved = { ...payload.point, data: savedData };
      setData(savedData); setArchive((current) => [saved, ...current.filter((item) => !(item.year === saved.year && item.week === saved.week))].sort((a, b) => b.year - a.year || b.week - a.week)); setActiveRecordId(saved.id); setSavedAt(new Date()); setLastSavedSignature(pointSignature(marketId, savedData)); setArchiveError("");
      if (isLocalWorkspace()) {
        writeLocalDraft({ scope: "market", ownerId: marketId, data: savedData });
        const onDisk = await saveLocalFile();
        setToast(`${saved.year} · S${String(saved.week).padStart(2, "0")} ${onDisk ? "enregistrée dans le fichier." : "conservée dans la session. Le fichier reste à enregistrer."}`);
      } else setToast(`${saved.year} · S${String(saved.week).padStart(2, "0")} enregistrée en ligne.`);
    } catch (error) { setToast(error instanceof Error ? error.message : "Échec de la sauvegarde."); }
    finally { setSaving(false); }
  };
  useEffect(() => {
    const handleSaveShortcut = (event: KeyboardEvent) => {
      if (!isLocalWorkspace() && (event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase("fr-FR") === "s" && (view === "edit" || view === "settings") && session.user) {
        event.preventDefault();
        void savePoint();
      }
    };
    window.addEventListener("keydown", handleSaveShortcut);
    return () => window.removeEventListener("keydown", handleSaveShortcut);
  });
  const updateMarketDraft = (id: string, patch: Partial<Market>) => { markLocalFormPending(`market:${id}`, true); setMarketOptions((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item)); };
  const createMarket = async () => {
    if (creatingMarket) return;
    setCreatingMarket(true);
    try {
      const index = marketOptions.length + 1;
      const response = await fetch("/api/markets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: `Nouveau marché ${index}`, shortCode: `MARCHÉ-${index}`, tone: themes[index % themes.length].id, colorHex: "", plannerTags: [] }) });
      const payload = await response.json() as { market?: { id: string; name: string; shortCode: string; tone: ThemeKey; colorHex?: string; plannerTags?: string[]; position: number; jiraWarningDays: number; jiraCriticalDays: number }; error?: string };
      if (!response.ok || !payload.market) throw new Error(payload.error || "Création impossible.");
      const created: Market = { id: payload.market.id, name: payload.market.name, short: payload.market.shortCode, tone: payload.market.tone, colorHex: normalizeHex(payload.market.colorHex), plannerTags: payload.market.plannerTags ?? [], position: payload.market.position, jiraWarningDays: payload.market.jiraWarningDays, jiraCriticalDays: payload.market.jiraCriticalDays };
      setMarketOptions((current) => [...current, created].sort((a, b) => a.position - b.position));
      setToast("Marché ajouté. Tu peux maintenant modifier son nom.");
    } catch (error) { setToast(error instanceof Error ? error.message : "Création du marché impossible."); }
    finally { setCreatingMarket(false); }
  };
  const saveMarket = async (id: string) => {
    const draft = marketOptions.find((item) => item.id === id);
    if (!draft || marketSavingId) return;
    if (draft.colorHex && !validHex(draft.colorHex)) { setToast("La couleur du marché doit suivre le format #RRGGBB."); return; }
    setMarketSavingId(id);
    try {
      const response = await fetch("/api/markets", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, name: draft.name, shortCode: draft.short, tone: draft.tone, colorHex: draft.colorHex, plannerTags: draft.plannerTags, jiraWarningDays: draft.jiraWarningDays, jiraCriticalDays: draft.jiraCriticalDays }) });
      const payload = await response.json() as { market?: { id: string; name: string; shortCode: string; tone: ThemeKey; colorHex?: string; plannerTags?: string[]; position: number; jiraWarningDays: number; jiraCriticalDays: number }; error?: string };
      if (!response.ok || !payload.market) throw new Error(payload.error || "Modification impossible.");
      const saved: Market = { id: payload.market.id, name: payload.market.name, short: payload.market.shortCode, tone: payload.market.tone, colorHex: normalizeHex(payload.market.colorHex), plannerTags: payload.market.plannerTags ?? [], position: payload.market.position, jiraWarningDays: payload.market.jiraWarningDays, jiraCriticalDays: payload.market.jiraCriticalDays };
      setMarketOptions((current) => current.map((item) => item.id === id ? saved : item));
      markLocalFormPending(`market:${id}`, false);
      if (id === marketId) setData((current) => ({ ...current, themeColor: saved.tone, customColor: saved.colorHex, mail: { ...current.mail, subject: /^Point marché —/.test(current.mail.subject) ? `Point marché — ${saved.name}` : current.mail.subject } }));
      setToast(`Marché « ${saved.name} » enregistré.`);
    } catch (error) { setToast(error instanceof Error ? error.message : "Modification du marché impossible."); }
    finally { setMarketSavingId(""); }
  };
  const deleteMarket = async (id: string) => {
    const removed = marketOptions.find((item) => item.id === id);
    if (!removed || marketSavingId) return;
    if (!await requestConfirmation({ title: `Supprimer « ${removed.name} » ?`, detail: "Le marché disparaîtra de la liste active, mais ses points déjà enregistrés seront conservés.", confirmLabel: "Supprimer le marché", destructive: true })) return;
    setMarketSavingId(id);
    try {
      const response = await fetch(`/api/markets?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const payload = await response.json() as { removedId?: string; error?: string };
      if (!response.ok || !payload.removedId) throw new Error(payload.error || "Suppression impossible.");
      const remaining = marketOptions.filter((item) => item.id !== id);
      setMarketOptions(remaining);
      markLocalFormPending(`market:${id}`, false);
      if (id === marketId) {
        const replacement = remaining[0];
        await loadMarket(replacement.id, true, replacement);
      }
      setToast(`Marché « ${removed.name} » supprimé de la liste active.`);
    } catch (error) { setToast(error instanceof Error ? error.message : "Suppression du marché impossible."); }
    finally { setMarketSavingId(""); }
  };
  const acceptDirectoryPayload = (users: GlobalDirectoryUser[]) => {
    setDirectoryUsers(users);
    setData((current) => applyDirectoryMail(current, marketId, users));
  };
  const openDirectoryEditor = (user?: GlobalDirectoryUser) => setDirectoryEditor(user
    ? { id: user.id, draft: { name: user.name, email: user.email, usercode: user.usercode, plannerAlias: user.plannerAlias ?? "", role: user.role, marketIds: [...user.marketIds] } }
    : { id: "new", draft: emptyDirectoryDraft() });
  const updateDirectoryDraft = (patch: Partial<DirectoryDraft>) => setDirectoryEditor((current) => current ? { ...current, draft: { ...current.draft, ...patch } } : current);
  const createDirectoryUser = async () => {
    const draft = directoryEditor?.id === "new" ? directoryEditor.draft : null;
    if (!draft || directorySavingId) return;
    setDirectorySavingId("new");
    try {
      const response = await fetch("/api/global-users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) });
      const payload = await response.json() as { users?: GlobalDirectoryUser[]; error?: string };
      if (!response.ok || !payload.users) throw new Error(payload.error || "Création impossible.");
      acceptDirectoryPayload(payload.users);
      setDirectoryEditor(null);
      setToast("Utilisateur ajouté à l’annuaire GLOBAL.");
    } catch (error) { setToast(error instanceof Error ? error.message : "Création de l’utilisateur impossible."); }
    finally { setDirectorySavingId(""); }
  };
  const saveDirectoryUser = async (id: string) => {
    const draft = directoryEditor?.id === id ? directoryEditor.draft : null;
    if (!draft || directorySavingId) return;
    setDirectorySavingId(id);
    try {
      const response = await fetch("/api/global-users", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, ...draft }) });
      const payload = await response.json() as { users?: GlobalDirectoryUser[]; error?: string };
      if (!response.ok || !payload.users) throw new Error(payload.error || "Modification impossible.");
      acceptDirectoryPayload(payload.users);
      setDirectoryEditor(null);
      setToast(`Utilisateur « ${draft.name} » enregistré.`);
    } catch (error) { setToast(error instanceof Error ? error.message : "Modification de l’utilisateur impossible."); }
    finally { setDirectorySavingId(""); }
  };
  const deleteDirectoryUser = async (id: string) => {
    const user = directoryUsers.find((item) => item.id === id);
    if (!user || directorySavingId) return;
    const previousEditor = directoryEditor?.id === id ? directoryEditor : null;
    if (previousEditor) setDirectoryEditor(null);
    if (!await requestConfirmation({ title: `Retirer « ${user.name} » ?`, detail: "Cette personne ne sera plus utilisée dans les destinataires ni dans les imports Jira.", confirmLabel: "Retirer de l’annuaire", destructive: true })) { if (previousEditor) setDirectoryEditor(previousEditor); return; }
    setDirectorySavingId(id);
    try {
      const response = await fetch(`/api/global-users?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const payload = await response.json() as { users?: GlobalDirectoryUser[]; error?: string };
      if (!response.ok || !payload.users) throw new Error(payload.error || "Suppression impossible.");
      acceptDirectoryPayload(payload.users);
      setDirectoryEditor(null);
      setToast(`Utilisateur « ${user.name} » retiré.`);
    } catch (error) { setToast(error instanceof Error ? error.message : "Suppression de l’utilisateur impossible."); }
    finally { setDirectorySavingId(""); }
  };
  const setCarryoverPreset = (preset: "unfinished" | "all" | "none") => {
    if (!previousPoint) return;
    const dossierSources = new Set(data.dossiers.map((item) => item.sourceId ?? item.id));
    const operationSources = new Set(data.operations.map((item) => item.sourceId ?? item.id));
    const selection: Record<string, boolean> = {};
    previousPoint.data.dossiers.forEach((item) => {
      const available = !dossierSources.has(item.sourceId ?? item.id);
      selection[`dossier:${item.id}`] = available && preset !== "none" && (preset === "all" || !isClosed(item.status));
    });
    previousPoint.data.operations.forEach((item) => {
      const available = !operationSources.has(item.sourceId ?? item.id);
      selection[`operation:${item.id}`] = available && preset !== "none" && (preset === "all" || !isOperationClosed(item));
    });
    setCarryoverSelection(selection);
  };
  const openCarryover = () => {
    if (!previousPoint) { setToast("Aucun point antérieur disponible pour ce marché."); return; }
    setCarryoverPreset("unfinished");
    setCarryoverOpen(true);
  };
  const applyCarryover = () => {
    if (!previousPoint) return;
    const dossierSources = new Set(data.dossiers.map((item) => item.sourceId ?? item.id));
    const operationSources = new Set(data.operations.map((item) => item.sourceId ?? item.id));
    const dossiers = previousPoint.data.dossiers.filter((item) => carryoverSelection[`dossier:${item.id}`] && !dossierSources.has(item.sourceId ?? item.id)).map((item) => ({ ...item, id: uid(), sourceId: item.sourceId ?? item.id, carriedFromYear: previousPoint.year, carriedFromWeek: previousPoint.week }));
    const operations = previousPoint.data.operations.filter((item) => carryoverSelection[`operation:${item.id}`] && !operationSources.has(item.sourceId ?? item.id)).map((item) => ({ ...item, id: uid(), sourceId: item.sourceId ?? item.id, carriedFromYear: previousPoint.year, carriedFromWeek: previousPoint.week, steps: item.steps.map(([label, state]) => [label, state] as [string, string]) }));
    setData((current) => ({ ...current, dossiers: [...current.dossiers, ...dossiers], operations: [...current.operations, ...operations] }));
    setCarryoverOpen(false);
    const count = dossiers.length + operations.length;
    setToast(count ? `${count} élément${count > 1 ? "s" : ""} repris du point ${previousPoint.year} · S${String(previousPoint.week).padStart(2, "0")}.` : "Aucun nouvel élément à reprendre.");
  };
  const copyMail = async () => {
    try {
      if (navigator.clipboard && typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([mailHtml], { type: "text/html" }), "text/plain": new Blob([`${data.mail.intro}\n\n${data.priority}`], { type: "text/plain" }) })]);
      } else {
        const holder = document.createElement("div"); holder.innerHTML = mailHtml; holder.contentEditable = "true"; holder.style.position = "fixed"; holder.style.left = "-9999px"; document.body.appendChild(holder);
        const selection = window.getSelection(); const range = document.createRange(); range.selectNodeContents(holder); selection?.removeAllRanges(); selection?.addRange(range);
        if (!document.execCommand("copy")) throw new Error("copy"); holder.remove(); selection?.removeAllRanges();
      }
      setToast("Corps du mail copié.");
    } catch { setToast("Copie bloquée : utilise l’aperçu ou le téléchargement HTML."); }
  };
  const downloadInteractiveHtml = () => {
    download(htmlAttachmentName, interactiveHtml, "text/html;charset=utf-8");
    setToast("Pièce jointe interactive téléchargée.");
  };
  const dragInteractiveHtml = (event: ReactDragEvent<HTMLElement>) => {
    const url = URL.createObjectURL(new Blob([interactiveHtml], { type: "text/html;charset=utf-8" }));
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("DownloadURL", `text/html:${htmlAttachmentName}:${url}`);
    event.dataTransfer.setData("text/uri-list", url);
    event.dataTransfer.setData("text/plain", htmlAttachmentName);
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const navGroups: { label: string; items: { id: Section; label: string; icon: string; count?: number }[] }[] = view === "settings" ? [
    { label: "Application", items: [{ id: "personalization", label: "Personnalisation", icon: "settings" }, { id: "markets", label: "Marchés & seuils", icon: "edit" }, { id: "users", label: "Annuaire GLOBAL", icon: "user" }] },
  ] : [
    { label: "Préparer le point", items: [{ id: "general", label: "Cadre du point", icon: "spark" }, { id: "dossiers", label: "Dossiers en cours", icon: "folder" }, { id: "operations", label: "Simulations & opérations", icon: "trend" }, { id: "jira", label: "Tickets Jira", icon: "ticket" }] },
    { label: "Vérifier et diffuser", items: [{ id: "mail", label: "Paramètres du mail", icon: "mail" }, { id: "saved", label: "Historique des points", icon: "download" }] },
  ];

  const periodNavigator = <section className={`period-navigator ${view === "edit" ? "edit-period" : "read-period"}`} aria-label={view === "edit" ? "Période d’édition" : "Navigation de lecture"}>
    <div className="period-head">
      <div className="period-title"><span><Icon name={view === "edit" ? "edit" : "eye"} size={15}/> {view === "edit" ? "Point en préparation" : "Point en lecture"}</span><strong>Marché et semaine</strong></div>
      <label className="period-market"><span>Marché</span><select value={marketId} onChange={(event) => { void chooseMarket(event.target.value); }}>{marketOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <div className="period-state"><span>{currentWeekYear} · S{String(currentWeek).padStart(2, "0")}</span><strong>{isDirty ? "Brouillon modifié" : activeRecordId ? "Point enregistré" : "Nouvelle semaine"}</strong><small>{currentWeekPoint ? `Point du ${dateLabel(currentWeekPoint.meetingDate)}` : "Aucun point enregistré"}</small></div>
      <button type="button" className={`period-calendar-toggle ${calendarExpanded ? "is-open" : ""}`} aria-expanded={calendarExpanded} onClick={() => setCalendarExpanded((current) => !current)}><Icon name="calendar" size={16}/><span>{calendarExpanded ? "Masquer le calendrier" : "Choisir une semaine"}</span><Icon name="chevron" size={15}/></button>
    </div>
    {calendarExpanded && <div className="visual-week-picker">
      <div className="week-picker-toolbar">
        <div className="month-navigation"><button type="button" aria-label="Mois précédent" onClick={() => setCalendarMonth((current) => shiftMonth(current, -1))}><Icon name="chevron" size={16}/></button><label className="sr-only" htmlFor="market-calendar-month">Mois du calendrier</label><select id="market-calendar-month" value={calendarMonth.slice(5, 7)} onChange={(event) => setCalendarMonth(`${calendarMonth.slice(0, 4)}-${event.target.value}-01`)}>{Array.from({ length: 12 }, (_, index) => <option key={index} value={String(index + 1).padStart(2, "0")}>{new Intl.DateTimeFormat("fr-FR", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, index, 1)))}</option>)}</select><label className="sr-only" htmlFor="market-calendar-year">Année du calendrier</label><select id="market-calendar-year" value={calendarMonth.slice(0, 4)} onChange={(event) => setCalendarMonth(`${event.target.value}-${calendarMonth.slice(5, 7)}-01`)}>{Array.from({ length: 181 }, (_, index) => <option key={2020 + index} value={2020 + index}>{2020 + index}</option>)}</select><button type="button" aria-label="Mois suivant" onClick={() => setCalendarMonth((current) => shiftMonth(current, 1))}><Icon name="chevron" size={16}/></button></div>
        <div className="week-quick-actions"><button type="button" onClick={() => { void chooseCurrentWeek(); }}><Icon name="calendar" size={14}/> Cette semaine</button><button type="button" disabled={!archive.length} onClick={() => { void chooseLatestPublished(); }}><Icon name="check" size={14}/> Dernière publiée</button>{view === "edit" && <button type="button" disabled={!previousPoint} onClick={openCarryover}><Icon name="copy" size={14}/> Reprendre le précédent</button>}</div>
      </div>
      <div className="week-card-strip">{calendarWeeks.map((weekChoice) => { const savedPoint = archive.find((record) => record.year === weekChoice.year && record.week === weekChoice.week); const selected = weekChoice.year === currentWeekYear && weekChoice.week === currentWeek; const today = weekChoice.value === weekInputValue(isoToday()); return <button type="button" className={`week-choice ${selected ? "selected" : ""} ${savedPoint ? "published" : "empty"} ${selected && isDirty ? "draft" : ""}`} aria-pressed={selected} key={weekChoice.value} onClick={() => { void chooseWeek(weekChoice.value); }}><span><i/>{today ? "Cette semaine" : `${weekChoice.year}`}</span><strong>S{String(weekChoice.week).padStart(2, "0")}</strong><small>{weekChoice.range}</small><b>{savedPoint ? "Point enregistré" : "À renseigner"}</b></button>; })}</div>
    </div>}
  </section>;

  const renderEditor = () => <div className={`editor-layout ${view === "settings" ? "settings-layout" : ""}`}><aside className="editor-nav"><div className="editor-nav-title"><span>{view === "settings" ? "Paramètres" : "Préparation"}</span><small>{view === "settings" ? "Réglages durables et affichage du point" : "Complète puis vérifie ton point"}</small></div>{navGroups.map((group) => <div className="editor-nav-group" key={group.label}><span>{group.label}</span>{group.items.map((item) => <button key={item.id} className={section === item.id ? "active" : ""} onClick={() => setSection(item.id)}><Icon name={item.icon}/><span>{item.label}</span>{item.count !== undefined && <b>{item.count}</b>}<Icon name="chevron" size={15}/></button>)}</div>)}<div className={`autosave-card ${isDirty ? "is-dirty" : ""}`}><span><Icon name={isDirty ? "edit" : "check"} size={14}/> {isDirty ? "Modifications non enregistrées" : activeRecordId ? "Point enregistré" : "Brouillon prêt"}</span><small>{archiveLoading ? "Chargement de l’historique…" : activeRecordId ? `Dernière sauvegarde${savedAt ? ` · ${savedAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : ""}` : "La première sauvegarde créera ce point"}</small></div></aside><main className="editor-content">
    {section === "general" && <section className="editor-section">
      <SectionTitle eyebrow="Cadre" title="Préparer le point" detail="Le marché et la semaine se choisissent dans le calendrier général ci-dessus."/>
      <div className="surface form-grid general-grid">
        <div className="point-context-summary field-wide"><span><Icon name="calendar" size={16}/> Point sélectionné</span><strong>{market.name}</strong><b>{currentWeekYear} · S{String(currentWeek).padStart(2, "0")} · {dateLabel(data.meetingDate)}</b></div>
        <div className="field field-wide theme-field"><span>Couleur de ce point</span><div className="theme-picker">{themes.map((option) => <button key={option.id} type="button" className={!data.customColor && data.themeColor === option.id ? "active" : ""} style={{ "--swatch": option.accent } as CSSProperties} onClick={() => setData((current) => ({ ...current, themeColor: option.id, customColor: "" }))}><i/><b>{option.label}</b></button>)}</div><div className="hex-color-control"><input type="color" value={accent} aria-label="Sélecteur de couleur personnalisée" onChange={(event) => setData((current) => ({ ...current, customColor: event.target.value.toUpperCase() }))}/><label><span>Hexadécimal personnalisé</span><input value={data.customColor} maxLength={7} placeholder={theme.accent.toUpperCase()} onChange={(event) => setData((current) => ({ ...current, customColor: event.target.value.toUpperCase() }))}/></label><small className={data.customColor && !validHex(data.customColor) ? "invalid" : ""}>{data.customColor && !validHex(data.customColor) ? "Format attendu : #RRGGBB" : `Couleur active : ${accent.toUpperCase()}`}</small></div></div>
        <label className="field field-wide"><span>Priorité de la semaine</span><textarea value={data.priority} onChange={(event) => setData((current) => ({ ...current, priority: event.target.value }))} placeholder="L’action principale ou le message clé à retenir…"/></label>
      </div>
      <div className="guidance-grid"><article><span>01</span><strong>Choisis le bon marché</strong><p>Les noms et codes sont administrables dans « Gérer les marchés ».</p></article><article><span>02</span><strong>Reprends les suivis utiles</strong><p>Les dossiers et opérations non terminés du dernier point peuvent être reconduits sans doublon.</p></article><article><span>03</span><strong>Sauvegarde et diffuse</strong><p>Les destinataires et tickets Jira sont préparés depuis l’annuaire GLOBAL.</p></article></div>
    </section>}

    {section === "personalization" && <section className="editor-section">
      <AppearanceSettings/>
      <SectionTitle eyebrow="Paramètres du point actif" title="Personnaliser l’affichage" detail="Ces choix sont enregistrés avec le point : lecture, mail et pièce jointe HTML peuvent conserver des contenus différents."/>
      <div className="surface personalization-card">
        <div className="personalization-choice"><div><strong>Taille du texte</strong><span>Ajuste toute l’interface de lecture sans changer le contenu.</span></div><div className="segmented-control">{(["compact", "standard", "large"] as FontScale[]).map((value) => <button type="button" key={value} className={data.preferences.fontScale === value ? "active" : ""} onClick={() => setData((current) => ({ ...current, preferences: { ...current.preferences, fontScale: value } }))}>{value === "compact" ? "Petite" : value === "large" ? "Grande" : "Standard"}</button>)}</div></div>
        <div className="personalization-choice"><div><strong>Densité</strong><span>Le mode compact réduit les espaces pour les points très chargés.</span></div><div className="segmented-control">{(["comfortable", "compact"] as Density[]).map((value) => <button type="button" key={value} className={data.preferences.density === value ? "active" : ""} onClick={() => setData((current) => ({ ...current, preferences: { ...current.preferences, density: value } }))}>{value === "compact" ? "Compacte" : "Confortable"}</button>)}</div></div>
      </div>
      <div className="surface market-layout-settings"><ModuleLayoutEditor modules={pointModules} order={data.preferences.moduleOrder} widths={data.preferences.moduleWidths} onChangeOrder={updateModuleOrder} onChangeWidth={updateModuleWidth}/></div>
      <div className="module-settings-grid">
        {(["readModules", "mailModules", "htmlModules"] as const).map((destination) => <article className="surface module-settings-card" key={destination}><header><span>{destination === "readModules" ? "Lecture" : destination === "mailModules" ? "Mail blanc" : "HTML interactif"}</span><strong>Modules visibles</strong></header><div>{pointModules.map((module) => <label key={module.id}><input type="checkbox" checked={data.preferences[destination][module.id]} onChange={(event) => updateModuleVisibility(destination, module.id, event.target.checked)}/><span><strong>{module.label}</strong><small>{module.detail}</small></span></label>)}</div></article>)}
      </div>
      <div className="settings-point-note"><Icon name="spark" size={17}/><div><strong>Les informations propres à la semaine restent dans « Cadre du point »</strong><span>Priorité, couleur et contenu métier restent séparés des réglages durables de l’application.</span></div><button type="button" className="secondary-button" onClick={() => { setSection("general"); setView("edit"); }}>Ouvrir le cadre du point</button></div>
    </section>}

    {section === "markets" && <section className="editor-section">
      <SectionTitle eyebrow="Administration" title="Gérer les marchés" detail="Le nom, la couleur et les tags Planner restent liés à l’identifiant interne du marché." action={<button className="primary-button" disabled={creatingMarket} onClick={createMarket}><Icon name="plus"/> {creatingMarket ? "Ajout…" : "Ajouter un marché"}</button>}/>
      <div className="market-admin-note"><Icon name="alert"/><div><strong>Tags Planner par marché</strong><span>Un marché peut reconnaître plusieurs étiquettes, par exemple REV-PB et MEN-PB. Un changement de nom ne casse pas ce lien.</span></div></div>
      <div className="market-admin-list">{marketOptions.map((item, index) => {
        const marketAccent = normalizeHex(item.colorHex) || themes.find((option) => option.id === item.tone)?.accent || themes[0].accent;
        return <article className={`surface market-admin-card ${item.id === marketId ? "active" : ""}`} key={item.id}>
          <div className="market-admin-index" style={{ "--swatch": marketAccent } as CSSProperties}><i/><span>{String(index + 1).padStart(2, "0")}</span></div>
          <div className="market-admin-fields">
            <TextField label="Nom du marché" value={item.name} onChange={(name) => updateMarketDraft(item.id, { name })}/>
            <TextField label="Code court" value={item.short} onChange={(short) => updateMarketDraft(item.id, { short })} placeholder="EX. BOIS"/>
            <label className="field"><span>Palette par défaut</span><select value={item.tone} onChange={(event) => updateMarketDraft(item.id, { tone: event.target.value as ThemeKey, colorHex: "" })}>{themes.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
            <label className="field market-hex-field"><span>Hex personnalisé</span><div><input type="color" value={marketAccent} aria-label={`Couleur de ${item.name}`} onChange={(event) => updateMarketDraft(item.id, { colorHex: event.target.value.toUpperCase() })}/><input value={item.colorHex} maxLength={7} placeholder="#RRGGBB" onChange={(event) => updateMarketDraft(item.id, { colorHex: event.target.value.toUpperCase() })}/></div></label>
            <TextField label="Tags Planner" value={item.plannerTags.join("; ")} onChange={(value) => updateMarketDraft(item.id, { plannerTags: value.split(/[;,]/).map((tag) => tag.trim().toUpperCase()).filter(Boolean) })} placeholder="REV-PB; MEN-PB" wide/>
            <label className="field"><span>Alerte Jira · à surveiller</span><div className="number-suffix"><input type="number" min="1" max="364" value={item.jiraWarningDays} onChange={(event) => { const warning = Math.max(1, Math.min(364, Number(event.target.value) || 1)); updateMarketDraft(item.id, { jiraWarningDays: warning, jiraCriticalDays: Math.max(warning + 1, item.jiraCriticalDays) }); }}/><b>jours</b></div></label>
            <label className="field"><span>Alerte Jira · critique</span><div className="number-suffix"><input type="number" min={item.jiraWarningDays + 1} max="365" value={item.jiraCriticalDays} onChange={(event) => updateMarketDraft(item.id, { jiraCriticalDays: Math.max(item.jiraWarningDays + 1, Math.min(365, Number(event.target.value) || item.jiraWarningDays + 1)) })}/><b>jours</b></div></label>
          </div>
          <div className="market-admin-actions">{item.id === marketId && <span>Marché actif</span>}<button className="secondary-button" disabled={Boolean(marketSavingId)} onClick={() => saveMarket(item.id)}><Icon name="check"/> {marketSavingId === item.id ? "Enregistrement…" : "Enregistrer"}</button><button className="icon-button danger" disabled={Boolean(marketSavingId)} aria-label={`Supprimer ${item.name}`} title="Supprimer de la liste active" onClick={() => deleteMarket(item.id)}><Icon name="trash"/></button></div>
        </article>;
      })}</div>
    </section>}

    {section === "users" && <section className="editor-section">
      <SectionTitle eyebrow="Paramètres · Annuaire interne" title="Utilisateurs GLOBAL" detail="Une ligne résume chaque personne ; ouvre-la uniquement lorsque tu veux la modifier." action={<button className="primary-button" type="button" onClick={() => openDirectoryEditor()}><Icon name="plus"/> Ajouter une personne</button>}/>
      <div className="directory-rule-grid"><article><Icon name="ticket"/><div><strong>Jira réservé aux chefs</strong><span>Seuls les chefs de produit et chefs de marché sont inclus dans la requête et l’import Jira.</span></div></article><article><Icon name="mail"/><div><strong>Destinataires du mail</strong><span>Chefs, analystes du marché et manager Tarif sont ajoutés dans les destinataires principaux.</span></div></article><article><Icon name="lock"/><div><strong>Connexion simple</strong><span>L’édition reste protégée par le compte interne GLOBAL partagé, sans comptes individuels.</span></div></article></div>
      {!directoryReady ? <div className="archive-message"><span>Chargement de l’annuaire GLOBAL…</span></div> : directoryUsers.length ? <div className="surface directory-table"><div className="directory-table-head"><button type="button" onClick={() => toggleDirectorySort("name")}>Personne{directorySort.key === "name" ? directorySort.direction === "asc" ? " ↑" : " ↓" : ""}</button><button type="button" onClick={() => toggleDirectorySort("role")}>Rôle{directorySort.key === "role" ? directorySort.direction === "asc" ? " ↑" : " ↓" : ""}</button><button type="button" onClick={() => toggleDirectorySort("market")}>Marché{directorySort.key === "market" ? directorySort.direction === "asc" ? " ↑" : " ↓" : ""}</button><span>Automatisations</span><span/></div>{sortedDirectoryUsers.map((user) => <button type="button" className="directory-row" key={user.id} onClick={() => openDirectoryEditor(user)}><span className="directory-person"><i className="directory-avatar">{user.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</i><span><strong>{user.name || "Utilisateur GLOBAL"}</strong><small>{user.email}{user.plannerAlias ? ` · Planner : ${user.plannerAlias}` : ""}</small></span></span><span className="directory-role">{roleLabel(user.role)}</span><span className="directory-market">{user.marketIds[0] ? marketOptions.find((item) => item.id === user.marketIds[0])?.name ?? "Marché lié" : user.role === "manager-tarif" ? "Tous les marchés" : "Non associé"}</span><span className="directory-automation-badges">{roleUsesAutomaticJira(user.role) && <span className="jira">Jira</span>}{user.role === "analyste-tarif-referentiel" && <span className="stats">Stats</span>}{roleMailMode(user.role) === "to" && <span className="mail">Mail À</span>}{roleMailMode(user.role) === "none" && <span>En réserve</span>}</span><Icon name="chevron" size={16}/></button>)}</div> : <div className="surface archive-empty"><Icon name="user" size={28}/><strong>Annuaire GLOBAL vide</strong><span>Ajoute une première personne. Les exemples John DOE ne sont jamais enregistrés automatiquement.</span><button className="primary-button" type="button" onClick={() => openDirectoryEditor()}><Icon name="plus"/> Ajouter une personne</button></div>}
    </section>}

    {section === "dossiers" && <section className="editor-section">
      <SectionTitle eyebrow="Suivi détaillé" title="Dossiers en cours" detail="L’avancement peut rester interne à la préparation ou être affiché dans le point diffusé." action={<div className="title-actions">{previousPoint && <button className="secondary-button" onClick={openCarryover}><Icon name="copy"/> Reprendre le précédent</button>}<button className="primary-button" onClick={addDossier}><Icon name="plus"/> Ajouter un dossier</button></div>}/>
      {data.dossiers.length ? <div className="record-stack">{data.dossiers.map((item) => <article className="surface record-card" key={item.id}>
        <div className="record-header"><div><strong>{item.title || "Nouveau dossier"}</strong><small>{item.status}{carriedFromLabel(item) ? ` · ${carriedFromLabel(item)}` : ""}</small></div><button className="icon-button danger" aria-label="Supprimer le dossier" onClick={() => setData((current) => ({ ...current, dossiers: current.dossiers.filter((row) => row.id !== item.id) }))}><Icon name="trash"/></button></div>
        <div className="form-grid">
          <TextField label="Dossier" value={item.title} onChange={(title) => updateDossier(item.id, { title })} placeholder="Nom du dossier"/><TextField label="Univers" value={item.universe} onChange={(universe) => updateDossier(item.id, { universe })}/><TextField label="Référence" value={item.reference} onChange={(reference) => updateDossier(item.id, { reference })}/><SelectField label="Statut" value={item.status} onChange={(status) => updateDossier(item.id, { status })} options={statusOptions}/><TextField label="Responsable" value={item.owner} onChange={(owner) => updateDossier(item.id, { owner })}/><TextField label="Échéance" type="date" value={item.deadline} onChange={(deadline) => updateDossier(item.id, { deadline })}/>
          <label className="field field-wide"><span>Prochaine action</span><textarea value={item.action} onChange={(event) => updateDossier(item.id, { action: event.target.value })}/></label><label className="field field-wide"><span>Commentaire / risque</span><textarea value={item.comment} onChange={(event) => updateDossier(item.id, { comment: event.target.value })}/></label>
          <label className="field progress-field field-wide"><span><b>Avancement</b><strong>{item.progress}%</strong></span><input type="range" min="0" max="100" step="5" value={item.progress} onChange={(event) => updateDossier(item.id, { progress: Number(event.target.value) })}/></label>
          <label className="progress-visibility-toggle field-wide"><input type="checkbox" checked={Boolean(item.showProgress)} onChange={(event) => updateDossier(item.id, { showProgress: event.target.checked })}/><span><strong>Afficher cet avancement dans le point</strong><small>Le pourcentage et la barre seront visibles en lecture, dans le mail et dans la pièce jointe HTML.</small></span></label>
        </div>
      </article>)}</div> : <EmptyState label="un dossier" onAdd={addDossier}/>}</section>}

    {section === "operations" && <section className="editor-section">
      <SectionTitle eyebrow="Planner et suivi manuel" title="Simulations et opérations" detail={`L’import reconnaît les tags de ${market.name}, puis synchronise les simulations du mois courant et du mois suivant dans le point.`} action={<div className="title-actions"><PlannerImportDialog markets={marketOptions} onImport={importPlannerData}/><button className="secondary-button" type="button" disabled={!plannerReady} onClick={() => synchronizePlannerPoint()}><Icon name="spark"/> {plannerReady ? "Synchroniser le point" : "Chargement Planner…"}</button>{previousPoint && <button className="secondary-button" onClick={openCarryover}><Icon name="copy"/> Reprendre le précédent</button>}<button className="primary-button" onClick={addOperation}><Icon name="plus"/> Ajouter manuellement</button></div>}/>
      <div className={`planner-market-note ${market.plannerTags.length ? "" : "warning"}`}><Icon name={market.plannerTags.length ? "check" : "alert"}/><div><strong>{market.plannerTags.length ? `Tags reconnus : ${market.plannerTags.join(" · ")}` : "Aucun tag Planner paramétré"}</strong><span>{market.plannerTags.length ? `Période du point : ${calendarMonthLabel(monthStart(data.meetingDate))} et mois suivant.` : "Ajoute les étiquettes de ce marché dans Paramètres → Marchés avant la synchronisation."}</span></div></div>
      {data.operations.length ? <div className="record-stack">{data.operations.map((item) => <article className={`surface record-card ${item.plannerSource ? "planner-record-card" : ""}`} key={item.id}>
        <div className="record-header"><div><strong>{item.name || "Nouvelle simulation ou opération"}</strong><small>{item.month || "Mois à définir"}{item.plannerSource ? " · Source Planner" : carriedFromLabel(item) ? ` · ${carriedFromLabel(item)}` : ""}</small></div><button className="icon-button danger" aria-label="Retirer du point" onClick={() => setData((current) => ({ ...current, operations: current.operations.filter((row) => row.id !== item.id) }))}><Icon name="trash"/></button></div>
        {item.plannerSource ? <div className="planner-record-content"><div className="planner-record-summary"><span className={`report-pill tone-${toneForStatus(item.state)}`}>{item.state}</span><p>{item.summary}</p></div><div className="planner-record-steps">{item.steps.map(([label, state]) => <span key={label}><i className={`tone-${toneForStatus(state)}`}/><strong>{label}</strong><small>{state}</small></span>)}</div><div className="planner-record-metrics"><span><small>Code fournisseur</small><strong>{item.plannerSource.metrics.supplierCode || "—"}</strong></span><SupplierTurnover value={item.plannerSource.metrics.purchases12m}/><span><small>Variation GLOBAL</small><strong>{item.plannerSource.metrics.globalVariation === null ? "—" : `${item.plannerSource.metrics.globalVariation}%`}</strong></span><span><small>Structure</small><strong>{item.plannerSource.metrics.tariffStructure || "—"}</strong></span></div>{item.plannerSource.variationHistory?.length ? <SupplierSparkline points={item.plannerSource.variationHistory} label={item.plannerSource.supplierLabel || item.name}/> : <div className="supplier-variation-missing"><Icon name="alert" size={14}/><span>Variation fournisseur non renseignée dans Planner</span></div>}</div> : <div className="form-grid"><TextField label="Nom" value={item.name} onChange={(name) => updateOperation(item.id, { name })}/><TextField label="Mois affiché" value={item.month} onChange={(month) => updateOperation(item.id, { month })} placeholder="Septembre 2026"/><TextField label="État global" value={item.state} onChange={(state) => updateOperation(item.id, { state })} wide/><TextField label="Résumé" value={item.summary} onChange={(summary) => updateOperation(item.id, { summary })} wide/><div className="steps-editor field-wide"><span>Étapes de traitement</span>{item.steps.map(([label, state], stepIndex) => <div className="step-editor" key={`${item.id}-${stepIndex}`}><input value={label} onChange={(event) => updateOperation(item.id, { steps: item.steps.map((step, i) => i === stepIndex ? [event.target.value, step[1]] as [string,string] : step) })}/><select value={state} onChange={(event) => updateOperation(item.id, { steps: item.steps.map((step, i) => i === stepIndex ? [step[0], event.target.value] as [string,string] : step) })}>{stepOptions.map((option) => <option key={option}>{option}</option>)}</select><button className="icon-button subtle" aria-label="Supprimer l’étape" onClick={() => updateOperation(item.id, { steps: item.steps.filter((_, i) => i !== stepIndex) })}><Icon name="trash" size={15}/></button></div>)}<button className="inline-add" onClick={() => updateOperation(item.id, { steps: [...item.steps, ["Nouvelle étape", "À faire"]] })}><Icon name="plus" size={15}/> Ajouter une étape</button></div></div>}
      </article>)}</div> : <EmptyState label="une simulation ou opération" onAdd={addOperation}/>}</section>}

    {section === "jira" && <section className="editor-section">
      <SectionTitle eyebrow="Activité Jira" title="Tickets ouverts du marché" detail={`Les tickets sont récupérés automatiquement depuis le centre d’import global pour les chefs de produit et chefs de marché de ${market.name}. Seules les personnes ayant des tickets apparaissent.`} action={<button className="primary-button" onClick={addJira}><Icon name="plus"/> Ajouter une synthèse</button>}/>
      <div className="jira-import-note"><Icon name="check"/><div><strong>Alimenté par le centre d’import global</strong><span>Un seul import Jira met à jour tous les points marché. Le rattachement utilise le USERCODE, le marché et le rôle enregistrés dans l’annuaire.</span></div></div>
      <JiraVolumePulse data={data} archive={archive} market={market}/>
      <div className="surface jira-alert-settings"><div><span><Icon name="alert" size={16}/> Alertes sur la dernière modification</span><strong>Seuils propres à {market.name}</strong><small>Ces repères signalent une absence d’activité ; ils ne mesurent pas le temps de résolution.</small></div><label><span>À surveiller après</span><div><input type="number" min="1" max="364" value={market.jiraWarningDays} onChange={(event) => { const warning = Math.max(1, Math.min(364, Number(event.target.value) || 1)); updateMarketDraft(marketId, { jiraWarningDays: warning, jiraCriticalDays: Math.max(warning + 1, market.jiraCriticalDays) }); }}/><b>jours</b></div></label><label><span>Critique après</span><div><input type="number" min={market.jiraWarningDays + 1} max="365" value={market.jiraCriticalDays} onChange={(event) => updateMarketDraft(marketId, { jiraCriticalDays: Math.max(market.jiraWarningDays + 1, Math.min(365, Number(event.target.value) || market.jiraWarningDays + 1)) })}/><b>jours</b></div></label><button className="secondary-button" disabled={Boolean(marketSavingId)} onClick={() => saveMarket(marketId)}><Icon name="check" size={15}/> {marketSavingId === marketId ? "Enregistrement…" : "Enregistrer les seuils"}</button></div>
      <div className="surface data-table-wrap jira-summary-wrap"><table className="data-table jira-person-table"><thead><tr><th>Personne</th>{JIRA_SUMMARY_STATUSES.map((status) => <th key={status}>{status}</th>)}<th>Total</th><th/></tr></thead><tbody>{jiraPeople.map((person) => <tr key={person.assignee}><th scope="row"><input value={person.assignee} aria-label={`Personne ${person.assignee}`} onChange={(event) => renameJiraPerson(person.assignee, event.target.value)}/></th>{JIRA_SUMMARY_STATUSES.map((status) => { const statusItems = person.items.filter((item) => item.status === status); const count = statusItems.reduce((sum, item) => sum + jiraItemCount(item), 0); const link = statusItems.find((item) => item.link)?.link; return <td key={status}><div className="jira-count-cell"><input type="number" min="0" value={count} aria-label={`${status} pour ${person.assignee}`} onChange={(event) => setJiraPersonCount(person.assignee, status, Number(event.target.value))}/>{link && <a href={link} target="_blank" rel="noreferrer" title={`Ouvrir le filtre « ${status} »`} aria-label={`Ouvrir le filtre ${status} de ${person.assignee}`}>↗</a>}</div></td>; })}<td className="jira-person-total"><strong>{person.total}</strong><small>{jiraStatusSummary(person.items)}</small></td><td><button className="icon-button subtle" aria-label={`Supprimer ${person.assignee}`} onClick={() => removeJiraPerson(person.assignee)}><Icon name="trash" size={15}/></button></td></tr>)}</tbody></table>{!jiraPeople.length && <div className="table-empty">Aucun ticket Jira dans le registre global pour ce marché. Tu peux ajouter une synthèse manuelle si nécessaire.</div>}</div>
      {jiraActivityRows.length > 0 && <div className="surface data-table-wrap jira-ticket-detail-wrap"><div className="jira-detail-heading"><div><span>Détail des tickets</span><strong>Priorité visuelle par dernière modification</strong></div><small>Création affichée à titre de contexte uniquement.</small></div><table className="data-table jira-ticket-table"><thead><tr><th>Ticket</th><th>État</th><th>Résumé</th><th>Personne</th><th>Création</th><th>Dernière modification</th><th>Signal</th></tr></thead><tbody>{jiraActivityRows.map(({ item, inactivity }) => { const signal = inactivity === null ? "neutral" : inactivity >= market.jiraCriticalDays ? "critical" : inactivity >= market.jiraWarningDays ? "warning" : "fresh"; return <tr id={`jira-${item.id}`} className={`jira-ticket-${signal}`} key={item.id}><td>{item.link ? <a href={item.link} target="_blank" rel="noreferrer">{item.key} ↗</a> : <strong>{item.key}</strong>}{item.internalId && <small>ID {item.internalId}</small>}</td><td><span className={`report-pill tone-${toneForStatus(item.status)}`}>{item.status}</span></td><td><strong>{item.summary || "Sans résumé"}</strong></td><td><strong>{item.assignee || "Non assigné"}</strong>{item.assigneeUserCode && <small>{item.assigneeUserCode}</small>}</td><td>{item.createdAt ? dateLabel(item.createdAt.slice(0, 10)) : "—"}</td><td>{item.lastActivity ? dateLabel(item.lastActivity.slice(0, 10)) : "—"}</td><td><span className={`jira-activity-signal ${signal}`}>{inactivity === null ? "Non daté" : inactivity === 0 ? "Aujourd’hui" : `${inactivity} j sans activité`}</span></td></tr>; })}</tbody></table></div>}
    </section>}

    {section === "saved" && <section className="editor-section"><SectionTitle eyebrow="Historique" title="Points enregistrés" detail="Un seul point est conservé par marché et par semaine. Le bouton permanent de l’en-tête enregistre la semaine active."/><div className="surface version-summary"><div className="version-week"><span>Semaine active</span><strong>{currentWeekYear} · S{String(currentWeek).padStart(2, "0")}</strong><small>{currentWeekPoint ? `Point enregistré le ${new Date(currentWeekPoint.createdAt.replace(" ", "T") + (currentWeekPoint.createdAt.includes("Z") ? "" : "Z")).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}` : "Aucun point enregistré pour cette semaine"}</small></div><div className="version-next"><span>Sauvegarde</span><strong>{currentWeekPoint ? "Mise à jour" : "Création"}</strong><small>{currentWeekPoint ? "La sauvegarde remplace le contenu enregistré pour cette semaine." : "La première sauvegarde créera le point de cette semaine."} · Raccourci Ctrl/Cmd + S.</small></div><div className="version-actions"><button className="secondary-button" onClick={() => fileInput.current?.click()}><Icon name="upload"/> Importer JSON</button><button className="secondary-button" onClick={() => exportJson()}><Icon name="download"/> Exporter le brouillon</button></div></div>{archiveError && <div className="archive-message error"><Icon name="alert"/><span>{archiveError}</span></div>}{archiveLoading ? <div className="archive-message"><span>Chargement des points enregistrés…</span></div> : archive.length ? <div className="archive-list">{archive.map((record) => <article className={`surface archive-row ${activeRecordId === record.id && !isDirty ? "active" : ""}`} key={record.id}><div className="archive-version"><span>{record.year}</span><strong>S{String(record.week).padStart(2, "0")}</strong><small>ISO</small></div><div className="archive-copy"><span>{market.name}</span><strong>{dateLabel(record.meetingDate)}</strong><small>Enregistré le {new Date(record.createdAt.replace(" ", "T") + (record.createdAt.includes("Z") ? "" : "Z")).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</small></div><div className="archive-actions"><button className="secondary-button" onClick={() => exportJson(record)}><Icon name="download"/> JSON</button><button className="primary-button" onClick={() => loadRecord(record)}><Icon name="upload"/> Charger</button></div></article>)}</div> : !archiveError && <div className="surface archive-empty"><Icon name="download" size={28}/><strong>Aucun point enregistré</strong><span>Sauvegarde le premier point hebdomadaire de ce marché.</span></div>}</section>}

    {section === "mail" && <section className="editor-section">
      <SectionTitle eyebrow="Diffusion" title="Paramètres du mail" detail="L’annuaire prépare les destinataires ; tu peux conserver des adresses manuelles en complément." action={<button className="secondary-button" onClick={() => setData((current) => applyDirectoryMail(current, marketId, directoryUsers))}><Icon name="user"/> Actualiser depuis l’annuaire</button>}/>
      <div className="mail-automation-grid">
        <article><span><Icon name="mail" size={15}/> Équipe du marché</span><strong>{automaticMarketMailUsers.length ? automaticMarketMailUsers.map((user) => user.name).join(" · ") : "Aucun destinataire configuré"}</strong><small>Chefs et analystes rattachés à {market.name}.</small></article>
        <article><span><Icon name="user" size={15}/> Manager Tarif</span><strong>{automaticTariffManager?.name ?? "Manager Tarif non renseigné"}</strong><small>Ajouté comme destinataire principal pour tous les marchés, et non imposé en copie.</small></article>
      </div>
      <div className="surface form-grid mail-settings"><TextField label="Destinataires" value={data.mail.to} onChange={(to) => setData((current) => ({ ...current, mail: { ...current.mail, to } }))} wide/><TextField label="Copie" value={data.mail.cc} onChange={(cc) => setData((current) => ({ ...current, mail: { ...current.mail, cc } }))} wide/><TextField label="Objet" value={data.mail.subject} onChange={(subject) => setData((current) => ({ ...current, mail: { ...current.mail, subject } }))} wide/><label className="field field-wide"><span>Introduction</span><textarea value={data.mail.intro} onChange={(event) => setData((current) => ({ ...current, mail: { ...current.mail, intro: event.target.value } }))}/></label></div><button className="primary-button mail-next" onClick={() => setView("mail")}><Icon name="mail"/> Vérifier le mail</button>
    </section>}
  </main></div>;

  return <div className={`app-shell font-${data.preferences.fontScale} density-${data.preferences.density}`} style={themeStyle}>
    <a className="skip-link" href="#workspace-content">Aller au contenu</a>
    <WorkspaceNavigation view={view} userName={session.user?.displayName ?? null} onSelect={chooseView} onLogin={() => { setLoginDestination("edit"); openLogin(); }} onLogout={logout}/>
    <header className="app-header">
      <div className="workspace-location"><span>Espace de travail</span><strong>{workspaceTitles[view]}</strong></div>
      <div className="header-actions">
        <AppearanceControl/>
        <input ref={fileInput} className="sr-only" type="file" accept="application/json" onChange={importJson}/>
        {session.user && (view === "edit" || view === "settings") && <>
          <ActionMenu><button type="button" onClick={() => fileInput.current?.click()}><Icon name="upload"/> Importer un JSON</button><button type="button" onClick={() => exportJson()}><Icon name="download"/> Exporter le brouillon</button><button type="button" className="danger" onClick={() => { void resetPoint(); }}><Icon name="plus"/> Réinitialiser la semaine</button></ActionMenu>
          <button className={`primary-button save-point ${isDirty ? "has-changes" : ""}`} disabled={saving || !ready || (!isDirty && Boolean(activeRecordId))} onClick={savePoint}><Icon name="check"/><span>{saving ? "Enregistrement…" : isDirty ? "Sauvegarder" : activeRecordId ? "Enregistré" : "Créer le point"}</span></button>
        </>}
        {!session.user && <button className="login-button" disabled={!sessionReady} onClick={() => { setLoginDestination("edit"); openLogin(); }}><Icon name="lock"/><span>{sessionReady ? "Connexion GLOBAL" : "Vérification…"}</span></button>}
      </div>
    </header>
    <div id="workspace-content" className="workspace-content" tabIndex={-1}>
    <div id="top" className="workspace-context">
      <span>{view === "read" || view === "edit" || view === "mail" ? market.name : view === "analyst" ? "Jira · Simulations · Dossiers" : view === "stats" ? "Activité analystes et variations fournisseurs" : view === "imports" ? "Registres Jira et Planner" : "Application et points"}</span>
      {(view === "read" || view === "edit" || view === "mail") && <span className="workspace-week">S{String(currentWeek).padStart(2, "0")} · {currentWeekYear}</span>}
      {(view === "edit" || view === "mail") && <span className={`workspace-draft ${isDirty ? "is-dirty" : ""}`}>{isDirty ? "Modifications non enregistrées" : activeRecordId ? "Point enregistré" : "Nouveau point"}</span>}
    </div>
    {(view === "read" || view === "edit") && periodNavigator}
    {(view === "edit" || view === "settings") && session.user && renderEditor()}
    {view === "read" && <main className="preview-page"><div className="preview-toolbar"><div><span>Lecture générale</span><strong>Choisis le marché et la semaine dans le calendrier ci-dessus.</strong></div><button className="secondary-button" onClick={() => chooseView("edit")}><Icon name={session.user ? "edit" : "lock"}/> {session.user ? "Modifier ce point" : "Connexion GLOBAL pour modifier"}</button></div>{!activeRecordId && <div className="reader-empty-banner"><Icon name="calendar"/><div><strong>Aucun point enregistré pour cette sélection</strong><span>{session.user ? "Tu peux préparer puis sauvegarder le point de cette semaine." : "Aucun brouillon n’est affiché publiquement. Connecte-toi pour préparer cette semaine."}</span></div></div>}{(activeRecordId || session.user) ? <PreviewDashboard data={data} market={market} archive={archive}/> : <div className="surface reader-empty-state"><span className="login-emblem"><Icon name="calendar" size={24}/></span><strong>Cette semaine n’a pas encore de point publié</strong><p>Sélectionne une autre semaine enregistrée ou connecte-toi pour la préparer.</p></div>}</main>}
    {view === "stats" && session.user && (plannerReady && directoryReady ? <AnalystStatsDashboard tasks={plannerTasks} users={directoryUsers} markets={marketOptions.map((item) => ({ id: item.id, name: item.name, plannerTags: item.plannerTags }))} registry={plannerRegistry} updatedAt={plannerUpdatedAt} onImport={importPlannerData}/> : <main className="analyst-stats-page"><div className="surface stats-loading"><span>Chargement de la source Planner et de l’annuaire GLOBAL…</span></div></main>)}
    {view === "analyst" && session.user && (plannerReady && directoryReady ? <AnalystPointDashboard tasks={plannerTasks} users={directoryUsers} markets={marketOptions.map((item) => ({ id: item.id, name: item.name, plannerTags: item.plannerTags }))} plannerUpdatedAt={plannerUpdatedAt} onPlannerImport={importPlannerData}/> : <main className="analyst-point-page"><div className="surface stats-loading"><span>Chargement du point analyste, de Planner et de l’annuaire GLOBAL…</span></div></main>)}
    {view === "imports" && session.user && (plannerReady && directoryReady ? <ImportCenter users={directoryUsers} markets={marketOptions.map((item) => ({ id: item.id, name: item.name, plannerTags: item.plannerTags }))} plannerTasks={plannerTasks} plannerRegistry={plannerRegistry} plannerUpdatedAt={plannerUpdatedAt} onPlannerImport={importPlannerData} onJiraImported={refreshJiraFromRegistry}/> : <main className="import-center-page"><div className="surface stats-loading"><span>Chargement des registres et de l’annuaire GLOBAL…</span></div></main>)}
    {view === "mail" && <main className="mail-page">
      <div className="mail-toolbar"><div><span>Kit Outlook</span><strong>Le mail reste lisible seul, la pièce jointe conserve les interactions.</strong><small>{data.mail.to ? `À : ${data.mail.to}` : "Destinataires à compléter dans Paramètres du mail"}</small></div><div><button className="secondary-button" onClick={() => { setSection("mail"); chooseView("edit"); }}><Icon name={session.user ? "edit" : "lock"}/> Paramètres</button><button className="primary-button" onClick={copyMail}><Icon name="copy"/> Copier le corps du mail</button></div></div>
      <section className="mail-kit-panel" aria-label="Préparation de l’envoi Outlook"><div className="mail-kit-intro"><span>Envoi en deux éléments</span><strong>Corps du mail + tableau de bord interactif</strong><p>Copie d’abord la version statique dans Outlook, puis fais glisser la carte HTML dans le message. Si Outlook refuse le glisser-déposer, utilise le bouton de téléchargement.</p></div><div className="mail-kit-steps"><article><span>1</span><div><strong>Version mail</strong><small>Synthèse compatible Outlook, sans script.</small></div><button type="button" className="secondary-button" onClick={copyMail}><Icon name="copy" size={15}/> Copier</button></article><article className="html-attachment-card" draggable onDragStart={dragInteractiveHtml} title="Faire glisser cette pièce jointe vers Outlook"><span>2</span><div className="html-file-icon">HTML</div><div><strong>{htmlAttachmentName}</strong><small>Graphiques, filtres Jira et personnes dépliables · aucune modification possible</small></div><div className="attachment-actions"><span><Icon name="upload" size={14}/> Glisser dans Outlook</span><button type="button" className="secondary-button" onClick={downloadInteractiveHtml}><Icon name="download" size={15}/> Télécharger</button></div></article></div><div className="mail-security-note"><Icon name="alert" size={15}/><span>La version statique reste complète si la sécurité de l’entreprise bloque l’ouverture d’une pièce jointe HTML.</span></div></section>
      <div className="mail-frame-label"><span>Aperçu de la version intégrée au mail</span><strong>La pièce jointe interactive reprend le même point avec les filtres Jira.</strong></div><div className="mail-frame-wrap"><iframe title="Aperçu du mail Outlook" srcDoc={mailHtml}/></div>
    </main>}
    {directoryDraft && <AppDialog open={Boolean(directoryEditor)} onClose={() => { if (!directorySavingId) setDirectoryEditor(null); }} busy={Boolean(directorySavingId)} labelledBy="directory-dialog-title" className="directory-dialog">
      <div className="dialog-heading"><span className="login-emblem"><Icon name="user" size={22}/></span><div><span>Annuaire GLOBAL</span><h2 id="directory-dialog-title">{directoryEditor?.id === "new" ? "Ajouter une personne" : `Modifier ${directoryDraft.name}`}</h2><p>Le rôle détermine automatiquement Jira et les destinataires du mail.</p></div></div>
      <form className="directory-dialog-form" onSubmit={(event) => { event.preventDefault(); if (directoryEditor?.id === "new") void createDirectoryUser(); else if (directoryEditor) void saveDirectoryUser(directoryEditor.id); }}>
        <div className="directory-fields"><TextField label="Nom complet" value={directoryDraft.name} onChange={(name) => updateDirectoryDraft({ name })} placeholder="John DOE"/><TextField label="Adresse e-mail" type="email" value={directoryDraft.email} onChange={(email) => updateDirectoryDraft({ email })} placeholder="person@example.test"/><label className="field"><span>Rôle</span><select value={directoryDraft.role} onChange={(event) => { const role = event.target.value as GlobalRole; updateDirectoryDraft({ role, marketIds: role === "manager-tarif" ? [] : directoryDraft.marketIds }); }}>{GLOBAL_ROLE_OPTIONS.map((role) => <option key={role.id} value={role.id}>{role.label}</option>)}</select></label><TextField label={`USERCODE Jira${roleUsesAutomaticJira(directoryDraft.role) ? " · requis" : " · facultatif"}`} value={directoryDraft.usercode} onChange={(usercode) => updateDirectoryDraft({ usercode: usercode.toUpperCase() })} placeholder="J1234567"/><TextField label="Nom reconnu dans Planner · facultatif" value={directoryDraft.plannerAlias} onChange={(plannerAlias) => updateDirectoryDraft({ plannerAlias })} placeholder="Prénom ou libellé exact" wide/></div>
        {directoryDraft.role !== "manager-tarif" ? <label className="directory-market-select"><span>Marché de la personne{directoryDraftNeedsMarket ? " · requis" : ""}</span><select value={directoryDraft.marketIds[0] ?? ""} onChange={(event) => updateDirectoryDraft({ marketIds: event.target.value ? [event.target.value] : [] })}><option value="">Sélectionner un marché…</option>{marketOptions.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select><small>Le lien utilise l’identifiant du marché : un changement de nom ne le casse pas.</small></label> : <div className="directory-manager-note"><Icon name="mail" size={15}/> Manager Tarif unique · destinataire principal de tous les mails</div>}
        <div className="directory-dialog-automation"><span className={roleUsesAutomaticJira(directoryDraft.role) ? "is-on" : ""}><Icon name="ticket" size={15}/> {roleUsesAutomaticJira(directoryDraft.role) ? "Inclus dans Jira" : "Exclu de Jira"}</span><span className={directoryDraft.role === "analyste-tarif-referentiel" ? "is-on stats" : ""}><Icon name="trend" size={15}/> {directoryDraft.role === "analyste-tarif-referentiel" ? "Activité Planner rapprochée" : "Sans statistique analyste"}</span><span className={roleMailMode(directoryDraft.role) === "to" ? "is-on" : ""}><Icon name="mail" size={15}/> {roleMailMode(directoryDraft.role) === "to" ? "Destinataire du mail" : "Sans mail automatique"}</span></div>
        <div className="directory-dialog-footer">{directoryEditor?.id !== "new" ? <button className="secondary-button danger-button" type="button" disabled={Boolean(directorySavingId)} onClick={() => { if (directoryEditor) void deleteDirectoryUser(directoryEditor.id); }}><Icon name="trash"/> Retirer</button> : <span>Exemple neutre : John DOE · J1234567</span>}<div><button className="secondary-button" type="button" disabled={Boolean(directorySavingId)} onClick={() => setDirectoryEditor(null)}>Annuler</button><button className="primary-button" type="submit" disabled={Boolean(directorySavingId) || !directoryDraftValid}><Icon name="check"/> {directorySavingId ? "Enregistrement…" : directoryEditor?.id === "new" ? "Ajouter" : "Enregistrer"}</button></div></div>
      </form>
    </AppDialog>}
    {previousPoint && <AppDialog open={carryoverOpen} onClose={() => setCarryoverOpen(false)} labelledBy="carryover-title" className="carryover-dialog">
      <div className="carryover-heading"><span className="login-emblem"><Icon name="copy" size={22}/></span><div><span>Reprise sélective</span><h2 id="carryover-title">Reporter le point précédent</h2><p>{market.name} · {previousPoint.year} · S{String(previousPoint.week).padStart(2, "0")} vers {currentWeekYear} · S{String(currentWeek).padStart(2, "0")}</p></div></div>
      <div className="carryover-presets"><button type="button" onClick={() => setCarryoverPreset("unfinished")}><Icon name="alert" size={14}/> Non terminés</button><button type="button" onClick={() => setCarryoverPreset("all")}>Tout sélectionner</button><button type="button" onClick={() => setCarryoverPreset("none")}>Tout retirer</button></div>
      <div className="carryover-content">
        <div className="carryover-group"><div className="carryover-group-title"><span>Dossiers</span><b>{previousPoint.data.dossiers.length}</b></div>{previousPoint.data.dossiers.length ? previousPoint.data.dossiers.map((item) => { const alreadyCarried = data.dossiers.some((current) => (current.sourceId ?? current.id) === (item.sourceId ?? item.id)); return <label className={`carryover-row ${alreadyCarried ? "is-disabled" : ""}`} key={`dossier:${item.id}`}><input type="checkbox" disabled={alreadyCarried} checked={!alreadyCarried && Boolean(carryoverSelection[`dossier:${item.id}`])} onChange={(event) => setCarryoverSelection((current) => ({ ...current, [`dossier:${item.id}`]: event.target.checked }))}/><span><strong>{item.title || "Dossier sans titre"}</strong><small>{[item.universe, item.reference, item.owner].filter(Boolean).join(" · ") || "Contexte à compléter"}</small></span><b className={`tone-text-${toneForStatus(item.status)}`}>{alreadyCarried ? "Déjà reporté" : item.status}</b></label>; }) : <div className="carryover-empty">Aucun dossier dans ce point.</div>}</div>
        <div className="carryover-group"><div className="carryover-group-title"><span>Opérations commerciales</span><b>{previousPoint.data.operations.length}</b></div>{previousPoint.data.operations.length ? previousPoint.data.operations.map((item) => { const alreadyCarried = data.operations.some((current) => (current.sourceId ?? current.id) === (item.sourceId ?? item.id)); return <label className={`carryover-row ${alreadyCarried ? "is-disabled" : ""}`} key={`operation:${item.id}`}><input type="checkbox" disabled={alreadyCarried} checked={!alreadyCarried && Boolean(carryoverSelection[`operation:${item.id}`])} onChange={(event) => setCarryoverSelection((current) => ({ ...current, [`operation:${item.id}`]: event.target.checked }))}/><span><strong>{item.name || "Opération sans titre"}</strong><small>{item.month || "Mois à définir"}</small></span><b className={`tone-text-${toneForStatus(item.state)}`}>{alreadyCarried ? "Déjà reportée" : item.state}</b></label>; }) : <div className="carryover-empty">Aucune opération commerciale dans ce point.</div>}</div>
      </div>
      <div className="carryover-footer"><span>Le point précédent reste intact. Chaque élément repris garde son origine.</span><button className="primary-button" type="button" disabled={!carryoverSelectedCount} onClick={applyCarryover}><Icon name="copy"/> Reporter {carryoverSelectedCount || ""} élément{carryoverSelectedCount > 1 ? "s" : ""}</button></div>
    </AppDialog>}
    <AppDialog open={loginOpen} onClose={() => { if (!loginLoading) setLoginOpen(false); }} busy={loginLoading} labelledBy="login-title" className="login-dialog"><span className="login-emblem"><Icon name="lock" size={22}/></span><div className="login-heading"><span>Accès interne</span><h2 id="login-title">Connexion GLOBAL</h2><p>La lecture des points reste accessible. La préparation, les imports et les statistiques analystes utilisent le compte interne partagé.</p></div><form onSubmit={submitLogin}><label><span>Compte</span><input data-autofocus autoComplete="username" value={loginUsername} onChange={(event) => setLoginUsername(event.target.value)} /></label><label><span>Mot de passe</span><input type="password" autoComplete="current-password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} /></label>{loginError && <div className="login-error"><Icon name="alert" size={15}/>{loginError}</div>}<button className="primary-button login-submit" type="submit" disabled={loginLoading || !loginUsername || !loginPassword}><Icon name="lock"/> {loginLoading ? "Connexion…" : "Se connecter"}</button></form><small className="login-session-note">La session interne reste active pendant 12 heures sur cet appareil.</small></AppDialog>
    {confirmRequest && <AppDialog open onClose={() => settleConfirmation(false)} labelledBy="confirm-dialog-title" className="confirm-dialog"><span className={`confirm-emblem ${confirmRequest.destructive ? "danger" : ""}`}><Icon name={confirmRequest.destructive ? "alert" : "check"} size={22}/></span><div className="login-heading"><span>Confirmation</span><h2 id="confirm-dialog-title">{confirmRequest.title}</h2><p>{confirmRequest.detail}</p></div><div className="confirm-actions"><button className="secondary-button" type="button" onClick={() => settleConfirmation(false)}>Annuler</button><button className={`primary-button ${confirmRequest.destructive ? "danger-button-solid" : ""}`} type="button" onClick={() => settleConfirmation(true)}>{confirmRequest.confirmLabel}</button></div></AppDialog>}
    {toast && <div className="toast"><Icon name="check"/>{toast}</div>}
  </div></div>;
}
