import { normalizeResolutionMetrics, type JiraResolutionMetrics } from "@/lib/jira-market-kpis";
import type { PURCHASESConfig } from "@/lib/purchaseData";
import { normalizeFreeLayout, type FreeLayout } from "@/lib/free-point-layout";

import { normalizeModuleWidth } from "@/lib/point-grid";
import { appFetch as fetch } from "@/lib/app-transport";
import { type RichDossier } from "./dossier-board";
import { normalizeJiraRules, jiraRuleFor, type JiraAlertRule } from "@/lib/jira-alert-rules";
import { normalizeAttachments, sanitizePointHtml } from "@/lib/point-rich-content";
import { normalizeComparison, normalizeComparisonSnapshot, type ComparisonConfig, type ComparisonSnapshot } from "@/lib/simulation-comparison";
import { type PointSourceFreshness } from "./point-source-status";
import { safeExternalUrl } from "@/lib/safe-link";
import type { ModuleWidth } from "@/components/module-layout-editor";
import { roleMailMode, type GlobalDirectoryUser, type GlobalRole } from "@/lib/global-directory";
import { isAbandonedJiraStatus, isClosedJiraStatus, JIRA_SUMMARY_STATUSES, type JiraSummaryImport } from "@/lib/jira-import";
import { type PlannerTask } from "@/lib/planner-import";
import type { PlannerRegistrySummary } from "@/lib/planner-registry";
import { supplierSeriesForTask, type SupplierVariationPoint } from "@/lib/supplier-variations";
import { type WorkspaceView } from "./workspace-navigation";
import { normalizeSourceMode, type PointSourceMode } from "@/lib/point-source-mode";
import { normalizeMarketComparison, type MarketComparison } from "@/lib/market-comparison";
import { hasMarketSimulationOverride, marketSimulationFields, normalizeMarketSimulationOverride, normalizeMarketSimulationState, resolveMarketSimulationFields, type MarketSimulationFields, type MarketSimulationOverride } from "@/lib/market-simulation";


export type Tone = "mint" | "violet" | "aqua" | "peach" | "red";
export type View = WorkspaceView;
export type Section = "general" | "dossiers" | "operations" | "promotions" | "jira" | "saved" | "markets" | "users" | "mail" | "personalization" | "feedback";
export type FontScale = "compact" | "standard" | "large";
export type Density = "compact" | "comfortable" | "airy";
export type PointModule = "jira" | "dossiers" | "operations" | "promotions" | "alerts" | "comparison" | "simulationComparison" | "purchaseData";
export type ModuleVisibility = Record<PointModule, boolean>;
export type PointPreferences = { freeLayout?: FreeLayout; fontScale: FontScale; fontScalePercent: number; density: Density; readModules: ModuleVisibility; mailModules: ModuleVisibility; htmlModules: ModuleVisibility; moduleOrder: PointModule[]; moduleWidths: Record<PointModule, ModuleWidth> };
export type CarryoverFields = { sourceId?: string; carriedFromYear?: number; carriedFromWeek?: number };
export type Dossier = RichDossier & CarryoverFields;
export type PlannerPointSource = { labels?: string[]; checklist?: PlannerTask["checklist"]; externalId: string; metrics: PlannerTask["metrics"]; supplierLabel?: string; variationHistory?: SupplierVariationPoint[] };
export type CommercialOperation = { id: string; kind?: "simulation"; name: string; month: string; state: string; summary: string; steps: [string, string][]; plannerSource?: PlannerPointSource; plannerBase?: MarketSimulationFields; plannerOverride?: MarketSimulationOverride } & CarryoverFields;
export type Promotion = { id: string; name: string; period: string; purchaseNote: string; salesState: string; action: string; comment: string } & CarryoverFields;
export type Tariff = { id: string; code: string; supplier: string; month: string; state: string; receptionDate: string; dueDate: string; owner: string; comment: string };
export type JiraPointFields = { summary: string; status: string; priority: string; assignee: string; lastActivity: string; comment: string; count?: number };
export type JiraPointOverride = Partial<JiraPointFields> & { updatedAt?: string };
export type JiraTicket = { category?: string; subcategory?: string; id: string; key: string; internalId?: string; summary: string; status: string; priority: string; assignee: string; assigneeUserCode?: string; createdAt?: string; resolutionAt?: string; lastActivity: string; link: string; comment: string; count?: number; importedBase?: JiraPointFields; pointOverride?: JiraPointOverride };
export type PointData = { jiraResolution?: JiraResolutionMetrics; purchaseDataConfigs?: PURCHASESConfig[]; jiraAlertRules?: JiraAlertRule[]; simulationComparisonConfig?: ComparisonConfig; simulationComparisonSnapshot?: ComparisonSnapshot; sourceFreshness?: PointSourceFreshness; pointName: string; themeColor: ThemeKey; customColor: string; meetingDate: string; priority: string; dossiers: Dossier[]; operations: CommercialOperation[]; promotions: Promotion[]; tariffs: Tariff[]; jira: JiraTicket[]; jiraMode: PointSourceMode; plannerMode: PointSourceMode; marketComparison: MarketComparison | null; preferences: PointPreferences; mail: { to: string; cc: string; subject: string; intro: string; autoTo?: string[]; autoCc?: string[] } };
export type AlertItem = { title: string; detail: string; severity: "warning" | "danger"; targetId?: string; link?: string; category: "Jira" | "Dossier" };
export type ThemeKey = "mint" | "violet" | "aqua" | "peach" | "red";
export type Market = { id: string; name: string; short: string; tone: ThemeKey; colorHex: string; plannerTags: string[]; position: number; jiraWarningDays: number; jiraCriticalDays: number };
export type PointRecord = { revision: string; id: string; marketId: string; year: number; week: number; meetingDate: string; pointName: string; themeColor: ThemeKey; data: PointData; createdAt: string };
export type JiraPersonGroup = { assignee: string; items: JiraTicket[]; total: number };
export type JiraAttentionLevel = "fresh" | "warning" | "critical" | "undated";
export type JiraDashboardScope = "all" | "attention" | "critical";
export type JiraWeekPayload = { snapshot: { year: number; week: number; rawText: string; summary: JiraSummaryImport; updatedAt: string; source?: "weekly" | "central" } | null; assignments: Record<string, string[]>; error?: string };
export type SessionPayload = { user: { displayName: string; username: string } | null };
export type DirectoryDraft = { name: string; email: string; usercode: string; plannerAlias: string; role: GlobalRole; marketIds: string[] };
export type DirectoryEditor = { id: string; draft: DirectoryDraft };
export type ConfirmRequest = { title: string; detail: string; confirmLabel: string; destructive?: boolean };

export const defaultMarkets: Market[] = [
  { id: "revetements-menuiserie", name: "Revêtements & Menuiserie", short: "REV–MEN", tone: "mint", colorHex: "", plannerTags: ["TEST-A", "TEST-B"], position: 0, jiraWarningDays: 10, jiraCriticalDays: 20 },
  { id: "bois-amex", name: "Bois amin / AMEX", short: "BOIS", tone: "peach", colorHex: "", plannerTags: [], position: 1, jiraWarningDays: 10, jiraCriticalDays: 20 },
  { id: "outillage-quincaillerie", name: "Outillage & Quincaillerie", short: "OUT–QUIN", tone: "aqua", colorHex: "", plannerTags: [], position: 2, jiraWarningDays: 10, jiraCriticalDays: 20 },
  { id: "panneaux", name: "Panneaux", short: "PAN", tone: "violet", colorHex: "", plannerTags: ["TEST-C"], position: 3, jiraWarningDays: 10, jiraCriticalDays: 20 },
];

export const themes: { id: ThemeKey; label: string; accent: string; soft: string }[] = [
  { id: "mint", label: "Menthe", accent: "#72f5c5", soft: "rgba(114,245,197,.12)" },
  { id: "violet", label: "Violet", accent: "#b39aff", soft: "rgba(179,154,255,.12)" },
  { id: "aqua", label: "Azur", accent: "#70d8ff", soft: "rgba(112,216,255,.12)" },
  { id: "peach", label: "Corail", accent: "#ffb083", soft: "rgba(255,176,131,.12)" },
  { id: "red", label: "Framboise", accent: "#ff7287", soft: "rgba(255,114,135,.12)" },
];

export const statusOptions = ["Dans les délais", "En cours", "En attente", "À surveiller", "Action requise", "Bloquant", "Terminé"];
export const pointModules: { id: PointModule; label: string; detail: string }[] = [
  { id: "jira", label: "Tickets Jira", detail: "Radar, évolution et tickets cliquables" },
  { id: "dossiers", label: "Dossiers", detail: "Dossiers et avancement visible" },
  { id: "operations", label: "Simulations", detail: "État métier final, importé ou corrigé pendant le point" },
  { id: "promotions", label: "Promotions", detail: "Promotions achat et actions commerciales" },
  { id: "alerts", label: "Vigilances", detail: "Alertes dossiers et Jira" },
  { id: "purchaseData", label: "Suivi PURCHASES", detail: "Période et nombre de PURCHASES par spécialité" },
  { id: "simulationComparison", label: "Comparatif des simulations", detail: "Deux périodes, marché ou fournisseur, volume et variations" },
  { id: "comparison", label: "Comparaison des marchés", detail: "Camembert des tickets Jira ouverts par marché" },
];
export const allModulesVisible = (): ModuleVisibility => ({ jira: true, dossiers: true, operations: true, promotions: true, alerts: true, comparison: false, purchaseData: false, simulationComparison: false });
export const defaultModuleOrder: PointModule[] = ["jira", "dossiers", "operations", "promotions", "alerts", "comparison", "simulationComparison", "purchaseData"];
export const defaultModuleWidths: Record<PointModule, ModuleWidth> = { jira: "full", dossiers: "full", operations: "full", promotions: "full", alerts: "half", comparison: "full", purchaseData: "full", simulationComparison: "full" };
export const defaultPreferences = (): PointPreferences => ({ fontScale: "standard", fontScalePercent: 100, density: "comfortable", readModules: allModulesVisible(), mailModules: allModulesVisible(), htmlModules: allModulesVisible(), moduleOrder: [...defaultModuleOrder], moduleWidths: { ...defaultModuleWidths } });
export const copyPreferences = (preferences: PointPreferences): PointPreferences => ({ ...preferences, freeLayout: preferences.freeLayout ? structuredClone(preferences.freeLayout) : undefined, readModules: { ...preferences.readModules }, mailModules: { ...preferences.mailModules }, htmlModules: { ...preferences.htmlModules }, moduleOrder: [...preferences.moduleOrder], moduleWidths: { ...preferences.moduleWidths } });
export const emptyPlannerRegistry = (): PlannerRegistrySummary => ({ imported: 0, archiveCandidates: 0, recovered: 0, enriched: 0, usableVariations: 0, withoutVariation: 0, withoutMonth: 0 });
export const emptyDirectoryDraft = (): DirectoryDraft => ({ name: "", email: "", usercode: "", plannerAlias: "", role: "chef-produit", marketIds: [] });
export const uid = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
export const isoToday = () => new Date().toISOString().slice(0, 10);
export const isIsoDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
};
export const safeIsoDate = (value: string, fallback = isoToday()) => isIsoDate(value) ? value : fallback;
export const validHex = (value: string) => /^#[0-9A-F]{6}$/i.test(value.trim());
export const normalizeHex = (value: unknown) => typeof value === "string" && validHex(value) ? value.trim().toUpperCase() : "";
export const textValue = (value: unknown, fallback = "") => typeof value === "string" ? value : fallback;
export const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
export const objectRows = <T,>(value: unknown): T[] => Array.isArray(value) ? value.filter(isRecord) as T[] : [];
export const stringFields = <T extends object, K extends keyof T>(item: T, keys: K[]): Pick<T, K> => Object.fromEntries(keys.map((key) => [key, textValue(item[key])])) as Pick<T, K>;

export function initialData(marketId = "revetements-menuiserie", marketOverride?: Market): PointData {
  const market = marketOverride ?? defaultMarkets.find((item) => item.id === marketId) ?? defaultMarkets[0];
  const common = {
    purchaseDataConfigs: [],
    pointName: "Point marché",
    themeColor: market.tone,
    customColor: market.colorHex,
    meetingDate: isoToday(),
    priority: "",
    jiraMode: "automatic" as PointSourceMode, plannerMode: "automatic" as PointSourceMode, marketComparison: null,
    preferences: defaultPreferences(),
    mail: { to: "", cc: "", subject: `Point marché — ${market.name}`, intro: "Bonjour à tous, voici le point d’avancement de la semaine.", autoTo: [], autoCc: [] },
  };
  return { ...common, dossiers: [], operations: [], promotions: [], tariffs: [], jira: [] };
}

export function normalizeCommercialOperation(item: CommercialOperation): CommercialOperation {
  const current: CommercialOperation = {
    ...item,
    id: textValue(item.id) || uid(),
    kind: "simulation",
    name: typeof item.name === "string" ? item.name : "",
    month: typeof item.month === "string" ? item.month : "",
    state: typeof item.state === "string" ? item.state : "À faire",
    summary: typeof item.summary === "string" ? item.summary : "",
    steps: Array.isArray(item.steps) ? item.steps.filter((step) => Array.isArray(step) && step.length === 2 && step.every((value) => typeof value === "string")) : [],
  };
  if (!current.plannerSource) return current;
  const plannerBase = isRecord(current.plannerBase) ? { ...stringFields(current.plannerBase, ["name", "month", "state", "summary"]), state: normalizeMarketSimulationState(textValue(current.plannerBase.state)) } : { name: current.name, month: current.month, state: normalizeMarketSimulationState(current.state), summary: "" };
  const plannerOverride = normalizeMarketSimulationOverride(current.plannerOverride);
  return { ...current, plannerBase, ...resolveMarketSimulationFields(plannerBase, plannerOverride), ...(hasMarketSimulationOverride(plannerOverride) ? { plannerOverride } : { plannerOverride: undefined }) };
}

export function normalizePromotion(item: Partial<Promotion> & Partial<CommercialOperation>): Promotion {
  return {
    id: typeof item.id === "string" && item.id ? item.id : uid(),
    name: typeof item.name === "string" ? item.name : "",
    period: typeof item.period === "string" ? item.period : typeof item.month === "string" ? item.month : "",
    purchaseNote: typeof item.purchaseNote === "string" ? item.purchaseNote : typeof item.summary === "string" ? item.summary : "",
    salesState: typeof item.salesState === "string" ? item.salesState : typeof item.state === "string" ? item.state : "À préparer",
    action: typeof item.action === "string" ? item.action : "",
    comment: typeof item.comment === "string" ? item.comment : "",
    ...(item.sourceId ? { sourceId: item.sourceId } : {}),
    ...(item.carriedFromYear ? { carriedFromYear: item.carriedFromYear } : {}),
    ...(item.carriedFromWeek ? { carriedFromWeek: item.carriedFromWeek } : {}),
  };
}

export function normalizeJiraTicket(item: JiraTicket): JiraTicket {
  const current = { ...item, ...stringFields(item, ["key", "summary", "priority", "assignee", "lastActivity", "comment"]), id: textValue(item.id) || uid(), status: textValue(item.status, "À faire"), link: safeExternalUrl(item.link) };
  const importedBase = isRecord(item.importedBase) ? jiraImportedFields({ ...current, ...stringFields(item.importedBase, ["summary", "status", "priority", "assignee", "lastActivity", "comment"]), count: typeof item.importedBase.count === "number" ? item.importedBase.count : current.count }) : /^(?:Import Jira détaillé|Tableau Jira hebdomadaire)$/.test(current.comment) ? jiraImportedFields(current) : undefined;
  if (!importedBase) return current;
  const pointOverride: JiraPointOverride | undefined = isRecord(item.pointOverride) ? Object.fromEntries(Object.entries(item.pointOverride).filter(([key, value]) => key === "count" ? typeof value === "number" && Number.isFinite(value) && value > 0 : ["summary", "status", "priority", "assignee", "lastActivity", "comment", "updatedAt"].includes(key) && typeof value === "string")) : undefined;
  return { ...current, importedBase, ...resolveJiraFields(importedBase, pointOverride), ...(hasJiraOverride(pointOverride) ? { pointOverride } : { pointOverride: undefined }) };
}

export function normalizePointData(value: unknown, marketId: string, marketOverride?: Market): PointData {
  const fallback = initialData(marketId, marketOverride);
  if (!isRecord(value)) return fallback;
  const source = value as Partial<PointData> & { simulations?: CommercialOperation[] };
  const themeColor = themes.some((theme) => theme.id === source.themeColor) ? source.themeColor as ThemeKey : fallback.themeColor;
  const sourcePreferences = source.preferences && typeof source.preferences === "object" ? source.preferences : defaultPreferences();
  const mergeModules = (value: unknown): ModuleVisibility => {
    const sourceModules = value && typeof value === "object" ? value as Record<string, unknown> : {};
    return Object.fromEntries(pointModules.map((module) => [module.id, (module.id === "purchaseData" || module.id === "comparison" || module.id === "simulationComparison") ? sourceModules[module.id] === true : sourceModules[module.id] !== false])) as ModuleVisibility;
  };
  const legacyOperations = objectRows<CommercialOperation>(Array.isArray(source.operations) ? source.operations : source.simulations);
  const hasSeparatedPromotions = Array.isArray(source.promotions);
  const usesSimulationAlias = !Array.isArray(source.operations) && Array.isArray(source.simulations);
  const legacySimulation = (item: CommercialOperation) => Boolean(item.plannerSource || item.kind === "simulation" || /^nouvelle simulation/i.test(item.name || "") || (Array.isArray(item.steps) && item.steps.length));
  const simulations = hasSeparatedPromotions || usesSimulationAlias ? legacyOperations : legacyOperations.filter(legacySimulation);
  const promotions = hasSeparatedPromotions ? source.promotions! : usesSimulationAlias ? [] : legacyOperations.filter((item) => !legacySimulation(item)).map((item) => normalizePromotion(item));
  const legacyFontPercent = sourcePreferences.fontScale === "compact" ? 90 : sourcePreferences.fontScale === "large" ? 115 : 100;
  const fontScalePercent = Math.max(85, Math.min(130, Math.round(Number(sourcePreferences.fontScalePercent) || legacyFontPercent)));
  const fontScale: FontScale = fontScalePercent < 98 ? "compact" : fontScalePercent > 107 ? "large" : "standard";
  return {
    purchaseDataConfigs: Array.isArray(source.purchaseDataConfigs) ? source.purchaseDataConfigs : [],
    pointName: "Point marché",
    jiraResolution: normalizeResolutionMetrics(source.jiraResolution),
    jiraAlertRules: normalizeJiraRules(source.jiraAlertRules),
    simulationComparisonConfig: normalizeComparison(source.simulationComparisonConfig, marketId),
    simulationComparisonSnapshot: normalizeComparisonSnapshot(source.simulationComparisonSnapshot),
    sourceFreshness: isRecord(source.sourceFreshness) ? Object.fromEntries(["jira", "planner"].filter((key) => typeof source.sourceFreshness?.[key as keyof PointSourceFreshness] === "string").map((key) => [key, source.sourceFreshness![key as keyof PointSourceFreshness]])) : {},
    themeColor,
    customColor: normalizeHex(source.customColor) || fallback.customColor,
    meetingDate: typeof source.meetingDate === "string" ? safeIsoDate(source.meetingDate) : fallback.meetingDate,
    priority: typeof source.priority === "string" ? source.priority : fallback.priority,
    jiraMode: normalizeSourceMode(source.jiraMode), plannerMode: normalizeSourceMode(source.plannerMode), marketComparison: normalizeMarketComparison(source.marketComparison),
    preferences: {
      freeLayout: (() => { const layout = normalizeFreeLayout(sourcePreferences.freeLayout); return {...layout, copies: layout.copies.map(c => ({...c, html: sanitizePointHtml(c.html)}))}; })(),
      fontScale,
      fontScalePercent,
      density: sourcePreferences.density === "compact" || sourcePreferences.density === "airy" ? sourcePreferences.density : "comfortable",
      readModules: mergeModules(sourcePreferences.readModules),
      mailModules: mergeModules(sourcePreferences.readModules),
      htmlModules: mergeModules(sourcePreferences.readModules),
      moduleOrder: Array.isArray(sourcePreferences.moduleOrder) ? [...new Set([...sourcePreferences.moduleOrder.filter((id) => pointModules.some((module) => module.id === id)), ...defaultModuleOrder])] : [...defaultModuleOrder],
      moduleWidths: Object.fromEntries(pointModules.map((module) => {
        const candidate = sourcePreferences.moduleWidths && typeof sourcePreferences.moduleWidths === "object" ? sourcePreferences.moduleWidths[module.id] : undefined;
        return [module.id, normalizeModuleWidth(candidate, defaultModuleWidths[module.id])];
      })) as Record<PointModule, ModuleWidth>,
    },
    dossiers: objectRows<Dossier>(source.dossiers).map((item) => ({ ...item, ...stringFields(item, ["title", "universe", "reference", "status", "owner", "action", "deadline", "comment"]), id: textValue(item.id) || uid(), progress: Math.max(0, Math.min(100, Number(item.progress) || 0)), width: item.width === "half" || item.width === "third" ? item.width : "full", showProgress: Boolean(item.showProgress), richHtml: sanitizePointHtml(item.richHtml), titleHtml: sanitizePointHtml(item.titleHtml), attachments: normalizeAttachments(item.attachments) })),
    operations: simulations.map(normalizeCommercialOperation),
    promotions: objectRows<Promotion>(promotions).map((item) => normalizePromotion(item)),
    tariffs: objectRows<Tariff>(source.tariffs).map((item) => ({ ...item, ...stringFields(item, ["code", "supplier", "month", "state", "receptionDate", "dueDate", "owner", "comment"]), id: textValue(item.id) || uid() })),
    jira: objectRows<JiraTicket>(source.jira).map(normalizeJiraTicket).filter((ticket) => !isAbandonedJiraStatus(ticket.status)),
    mail: isRecord(source.mail) ? { ...fallback.mail, ...Object.fromEntries(["to", "cc", "subject", "intro"].filter((key) => typeof source.mail?.[key as keyof PointData["mail"]] === "string").map((key) => [key, source.mail![key as keyof PointData["mail"]]])), autoTo: Array.isArray(source.mail.autoTo) ? source.mail.autoTo.filter((value) => typeof value === "string") : [], autoCc: Array.isArray(source.mail.autoCc) ? source.mail.autoCc.filter((value) => typeof value === "string") : [] } : fallback.mail,
  };
}

export const pointSignature = (marketId: string, data: PointData) => JSON.stringify({ marketId, data });

export async function fetchPointRecords(marketId: string, marketOverride?: Market): Promise<PointRecord[]> {
  const response = await fetch(`/api/points?marketId=${encodeURIComponent(marketId)}`, { cache: "no-store" });
  const payload = await response.json() as { points?: PointRecord[]; error?: string };
  if (!response.ok) throw new Error(payload.error || "Impossible de charger les sauvegardes.");
  return (payload.points ?? []).map((record) => ({ ...record, data: normalizePointData(record.data, record.marketId, marketOverride) }));
}

export async function fetchMarkets(): Promise<Market[]> {
  const response = await fetch("/api/markets", { cache: "no-store" });
  const payload = await response.json() as { markets?: { id: string; name: string; shortCode: string; tone: ThemeKey; colorHex?: string; plannerTags?: string[]; position: number; jiraWarningDays?: number; jiraCriticalDays?: number }[]; error?: string };
  if (!response.ok) throw new Error(payload.error || "Impossible de charger les marchés.");
  return (payload.markets ?? []).map((market) => ({ id: market.id, name: market.name, short: market.shortCode, tone: market.tone, colorHex: normalizeHex(market.colorHex), plannerTags: Array.isArray(market.plannerTags) ? market.plannerTags : [], position: market.position, jiraWarningDays: Number(market.jiraWarningDays) || 10, jiraCriticalDays: Number(market.jiraCriticalDays) || 20 }));
}

export async function fetchDirectoryUsers(): Promise<GlobalDirectoryUser[]> {
  const response = await fetch("/api/global-users", { cache: "no-store" });
  const payload = await response.json() as { users?: GlobalDirectoryUser[]; error?: string };
  if (!response.ok) throw new Error(payload.error || "Impossible de charger l’annuaire GLOBAL.");
  return (payload.users ?? []).map((user) => ({ ...user, plannerAlias: user.plannerAlias ?? "" }));
}

export async function fetchPlannerTasks() {
  const response = await fetch("/api/planner-tasks", { cache: "no-store" });
  const payload = await response.json() as { tasks?: PlannerTask[]; registry?: PlannerRegistrySummary; updatedAt?: string; error?: string };
  if (!response.ok) throw new Error(payload.error || "Impossible de charger les simulations Planner.");
  return { tasks: payload.tasks ?? [], registry: payload.registry ?? emptyPlannerRegistry(), updatedAt: payload.updatedAt ?? "" };
}

export function emailList(value: string) {
  return value.split(/[;,\n]/).map((email) => email.trim()).filter(Boolean);
}

export function uniqueEmails(values: string[]) {
  const seen = new Set<string>();
  return values.filter((email) => {
    const key = email.toLocaleLowerCase("fr-FR");
    if (!email || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function applyDirectoryMail(data: PointData, marketId: string, users: GlobalDirectoryUser[]): PointData {
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

export function plannerTaskMatchesMarket(task: PlannerTask, market: Market) {
  const labels = new Set(task.labels.map((label) => label.toLocaleUpperCase("fr-FR")));
  return market.plannerTags.some((tag) => labels.has(tag.toLocaleUpperCase("fr-FR")));
}

export function plannerTaskToOperation(task: PlannerTask, allTasks: PlannerTask[], previous?: CommercialOperation): CommercialOperation {
  const plannerBase = marketSimulationFields(task);
  const plannerOverride = normalizeMarketSimulationOverride(previous?.plannerOverride);
  const resolved = resolveMarketSimulationFields(plannerBase, plannerOverride);
  return {
    id: `planner:${task.externalId}`,
    kind: "simulation",
    ...resolved,
    steps: task.checklist.map((item) => [item.label, item.date || (item.nonApplicable ? "Non applicable" : "À faire")] as [string, string]),
    plannerBase,
    ...(hasMarketSimulationOverride(plannerOverride) ? { plannerOverride } : {}),
    plannerSource: { externalId: task.externalId, labels: task.labels, checklist: task.checklist, metrics: task.metrics, supplierLabel: task.taskName.replace(/^20\d{2}-(?:0[1-9]|1[0-2])-(?:[A-ZÀ-Ÿ]+-)?/i, "").trim() || task.taskName, variationHistory: supplierSeriesForTask(task, allTasks) },
  };
}

export function plannerTasksForPoint(tasks: PlannerTask[], market: Market, meetingDate: string) {
  const currentMonth = safeIsoDate(meetingDate).slice(0, 7);
  const nextMonth = shiftMonth(`${currentMonth}-01`, 1).slice(0, 7);
  return tasks.filter((task) => task.registrySource !== "point-recovery" && plannerTaskMatchesMarket(task, market) && (task.effectiveMonth === currentMonth || task.effectiveMonth === nextMonth));
}

export function mergePlannerOperations(operations: CommercialOperation[], tasks: PlannerTask[], allTasks = tasks) {
  const previousByExternalId = new Map(operations.filter((operation) => operation.plannerSource?.externalId).map((operation) => [operation.plannerSource!.externalId, operation]));
  return [...operations.filter((operation) => !operation.plannerSource && !operation.id.startsWith("planner:")), ...[...new Map(tasks.map(task => [task.externalId, task])).values()].map((task) => plannerTaskToOperation(task, allTasks, previousByExternalId.get(task.externalId)))];
}


export function isoWeek(dateString: string) {
  const date = new Date(`${safeIsoDate(dateString)}T12:00:00`); const target = new Date(date.valueOf()); const day = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - day + 3); const firstThursday = new Date(target.getFullYear(), 0, 4); const firstDay = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDay + 3); return 1 + Math.round((target.valueOf() - firstThursday.valueOf()) / 604800000);
}
export function isoWeekYear(dateString: string) { const date = new Date(`${safeIsoDate(dateString)}T12:00:00`); const day = (date.getDay() + 6) % 7; date.setDate(date.getDate() - day + 3); return date.getFullYear(); }
export function weekInputValue(dateString: string) { return `${isoWeekYear(dateString)}-W${String(isoWeek(dateString)).padStart(2, "0")}`; }
export function dateFromWeekInput(value: string) {
  const match = /^(\d{4})-W(\d{2})$/.exec(value);
  if (!match) return isoToday();
  const year = Number(match[1]); const week = Number(match[2]);
  const januaryFourth = new Date(Date.UTC(year, 0, 4));
  const monday = new Date(januaryFourth);
  monday.setUTCDate(januaryFourth.getUTCDate() - ((januaryFourth.getUTCDay() + 6) % 7) + (week - 1) * 7);
  return monday.toISOString().slice(0, 10);
}
export function monthStart(dateString: string) {
  const date = new Date(`${safeIsoDate(dateString)}T12:00:00Z`);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
}
export function shiftMonth(monthString: string, amount: number) {
  const date = new Date(`${monthString}T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + amount, 1);
  return monthStart(date.toISOString().slice(0, 10));
}
export function calendarMonthLabel(monthString: string) {
  const label = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${monthString}T12:00:00Z`));
  return label.charAt(0).toLocaleUpperCase("fr-FR") + label.slice(1);
}
export function shortMonth(value: Date) { return new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" }).format(value).replace(".", ""); }
export function weekRangeLabel(start: Date, end: Date) {
  const startDay = start.getUTCDate(); const endDay = end.getUTCDate();
  return start.getUTCMonth() === end.getUTCMonth() ? `${startDay}–${endDay} ${shortMonth(end)}` : `${startDay} ${shortMonth(start)}–${endDay} ${shortMonth(end)}`;
}
export function weeksForMonth(monthString: string) {
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
export function dateLabel(value: string) { if (!isIsoDate(value)) return "Date à définir"; return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`)); }
export function dateValue(value: string) { const date = new Date(value.includes("T") ? value : `${value}T12:00:00`); return Number.isFinite(date.valueOf()) ? date.valueOf() : Number.NaN; }
export function daysBetween(from: string, to: string) { if (!from || !to) return 0; const difference = dateValue(to) - dateValue(from); return Number.isFinite(difference) ? Math.max(0, Math.floor(difference / 86400000)) : 0; }
export function isClosed(status: string) { return /(termin|cl[oô]tur|r[eé]solu|annul)/i.test(status); }
export function operationIdentity(operation: CommercialOperation) { return operation.plannerSource?.externalId || operation.sourceId || operation.id; }
export function isOperationClosed(operation: CommercialOperation) {
  return /(faite|fait|termin|non finalis|annul)/i.test(operation.state);
}
export function isPromotionClosed(promotion: Promotion) { return /(termin|cl[oô]tur|annul|fait)/i.test(promotion.salesState); }
export function carriedFromLabel(item: CarryoverFields) {
  return item.carriedFromYear && item.carriedFromWeek ? `Reporté de ${item.carriedFromYear} · S${String(item.carriedFromWeek).padStart(2, "0")}` : "";
}
export function jiraItemCount(item: JiraTicket) { const count = Number(item.count); return Number.isFinite(count) && count > 0 ? Math.round(count) : 1; }
export function jiraStatusSummary(items: JiraTicket[]) {
  const totals = new Map<string, number>();
  items.forEach((item) => totals.set(item.status || "À qualifier", (totals.get(item.status || "À qualifier") ?? 0) + jiraItemCount(item)));
  return Array.from(totals, ([status, count]) => `${status} ${count}`).join(" · ");
}
export function groupJiraPeople(items: JiraTicket[]): JiraPersonGroup[] {
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
export function jiraAttention(item: JiraTicket, pointDate: string, market: Market, rules: JiraAlertRule[] = []): { inactivity: number | null; level: JiraAttentionLevel } {
  if (!item.lastActivity) return { inactivity: null, level: "undated" };
  const inactivity = daysBetween(item.lastActivity, pointDate);
  const rule = jiraRuleFor(item, rules);
  const warningDays = rule?.warningDays ?? market.jiraWarningDays;
  const criticalDays = rule?.criticalDays ?? market.jiraCriticalDays;
  if (inactivity >= Math.max(warningDays + 1, criticalDays || 20)) return { inactivity, level: "critical" };
  if (inactivity >= Math.max(1, warningDays || 10)) return { inactivity, level: "warning" };
  return { inactivity, level: "fresh" };
}
export function jiraTrend(data: PointData, archive: PointRecord[]) {
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
export function jiraDashboardStats(data: PointData, market: Market, archive: PointRecord[]) {
  const activeTickets = data.jira.filter((item) => !isClosedJiraStatus(item.status));
  const currentVolume = activeTickets.reduce((sum, item) => sum + jiraItemCount(item), 0);
  const rows = activeTickets.map((item) => ({ item, ...jiraAttention(item, data.meetingDate, market, data.jiraAlertRules) }));
  const warningCount = rows.filter((row) => row.level === "warning").reduce((sum, row) => sum + jiraItemCount(row.item), 0);
  const criticalCount = rows.filter((row) => row.level === "critical").reduce((sum, row) => sum + jiraItemCount(row.item), 0);
  const statusTotals: { status: string; value: number }[] = JIRA_SUMMARY_STATUSES.map((status) => ({ status, value: activeTickets.filter((item) => item.status === status).reduce((sum, item) => sum + jiraItemCount(item), 0) })).filter((item) => item.value);
  const represented = statusTotals.reduce((sum, item) => sum + item.value, 0);
  if (currentVolume > represented) statusTotals.push({ status: "Autres", value: currentVolume - represented });
  return { activeTickets, currentVolume, rows, warningCount, criticalCount, attentionCount: warningCount + criticalCount, statusTotals, ...jiraTrend(data, archive) };
}
export function safeFilePart(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "marche";
}
export function interactiveAttachmentName(data: PointData, market: Market) {
  return `point-marche-${safeFilePart(market.short)}-${isoWeekYear(data.meetingDate)}-S${String(isoWeek(data.meetingDate)).padStart(2, "0")}.html`;
}
export function normalizeJiraSummary(summary: JiraSummaryImport): JiraSummaryImport {
  const detailedTickets = Array.isArray(summary.detailedTickets) ? summary.detailedTickets : [];
  return { ...summary, detailedTickets, mode: summary.mode ?? (detailedTickets.length ? "detailed" : "summary") };
}
export function jiraImportIdentity(ticket: Pick<JiraTicket, "key" | "internalId" | "assignee" | "status"> & { importedBase?: JiraPointFields }) {
  const assignee = ticket.importedBase?.assignee ?? ticket.assignee;
  const status = ticket.importedBase?.status ?? ticket.status;
  return ticket.internalId || ticket.key || `${assignee.trim().toLocaleLowerCase("fr-FR")}|${status.trim().toLocaleLowerCase("fr-FR")}`;
}
export function jiraImportedFields(ticket: JiraTicket): JiraPointFields {
  return { summary: ticket.summary, status: ticket.status, priority: ticket.priority, assignee: ticket.assignee, lastActivity: ticket.lastActivity, comment: ticket.comment, count: ticket.count };
}
export function resolveJiraFields(base: JiraPointFields, override?: JiraPointOverride): JiraPointFields {
  return { summary: override?.summary ?? base.summary, status: override?.status ?? base.status, priority: override?.priority ?? base.priority, assignee: override?.assignee ?? base.assignee, lastActivity: override?.lastActivity ?? base.lastActivity, comment: override?.comment ?? base.comment, count: override?.count ?? base.count };
}
export function hasJiraOverride(value: JiraPointOverride | undefined) {
  return Boolean(value && (["summary", "status", "priority", "assignee", "lastActivity", "comment", "count"] as const).some((key) => value[key] !== undefined));
}
export function jiraTicketsFromSummary(summaryInput: JiraSummaryImport, selectedPeople: string[], marketId: string, previousTickets: JiraTicket[] = []) {
  const summary = normalizeJiraSummary(summaryInput);
  const selectedUserCodes = new Set(selectedPeople.map((person) => person.toUpperCase()));
  const selected = new Set(selectedPeople);
  const imported: JiraTicket[] = summary.detailedTickets.length ? summary.detailedTickets.filter((ticket) => !isAbandonedJiraStatus(ticket.status) && ticket.marketId === marketId ).map((ticket) => ({
      id: uid(), category: ticket.category ?? "", subcategory: ticket.subcategory ?? "", key: ticket.key, internalId: ticket.internalId, summary: ticket.summary, status: ticket.status, priority: "",
      assignee: ticket.assigneeName || ticket.assigneeUserCode, assigneeUserCode: ticket.assigneeUserCode, createdAt: ticket.createdAt, resolutionAt: ticket.resolutionAt,
      lastActivity: ticket.updatedAt, link: ticket.link, comment: "Import Jira détaillé", count: 1,
    })) : summary.items.filter((item) => !isAbandonedJiraStatus(item.status) && selected.has(item.assignee)).map((item) => ({
    id: uid(), key: "", summary: "Synthèse de la file Jira", status: item.status, priority: "", assignee: item.assignee,
    lastActivity: "", link: item.link, comment: "Tableau Jira hebdomadaire", count: item.count,
  }));
  const previousById = new Map(previousTickets.map((ticket) => [jiraImportIdentity(ticket), ticket]));
  const manual = previousTickets.filter((ticket) => !ticket.importedBase && !/^(?:Import Jira détaillé|Tableau Jira hebdomadaire)$/.test(ticket.comment));
  return [...manual, ...imported.map((ticket) => {
    const previous = previousById.get(jiraImportIdentity(ticket));
    const importedBase = jiraImportedFields(ticket);
    const pointOverride = previous?.pointOverride;
    return { ...ticket, id: previous?.id ?? ticket.id, ...resolveJiraFields(importedBase, pointOverride), importedBase, ...(hasJiraOverride(pointOverride) ? { pointOverride } : {}) };
  })];
}
export async function fetchJiraWeek(year: number, week: number, marketId: string, preferCentral = false, date?: string): Promise<JiraWeekPayload> {
  const response = await fetch(`/api/jira-week?marketId=${encodeURIComponent(marketId)}&year=${year}&week=${week}${preferCentral ? "&preferCentral=1" : ""}${date ? `&date=${encodeURIComponent(date)}` : ""}`, { cache: "no-store" });
  const payload = await response.json() as JiraWeekPayload;
  if (!response.ok) throw new Error(payload.error || "Impossible de charger le tableau Jira hebdomadaire.");
  return payload;
}
export async function applyJiraWeek(data: PointData, marketId: string, replaceCentral = false) {
  if (data.jiraMode === "manual") return data;
  try {
    const payload = await fetchJiraWeek(isoWeekYear(data.meetingDate), isoWeek(data.meetingDate), marketId, replaceCentral, data.meetingDate);
    if (!payload.snapshot) return data;
    return { ...data, jiraResolution: payload.snapshot.summary.resolutionMetrics, sourceFreshness: { ...data.sourceFreshness, jira: payload.snapshot.updatedAt }, jira: jiraTicketsFromSummary(payload.snapshot.summary, payload.assignments[marketId] ?? [], marketId, data.jira) };
  } catch {
    return data;
  }
}
export function toneForStatus(status: string): Tone { if (/(bloqu|d[eé]pass|retard)/i.test(status)) return "red"; if (/(attente|surveill|action|pr[eé]par)/i.test(status)) return "peach"; if (/(fait|termin|re[cç]u|d[eé]lai)/i.test(status)) return "mint"; if (/cours/i.test(status)) return "aqua"; return "violet"; }
export function escapeHtml(value: string) { return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character); }

export function buildAlerts(data: PointData, market: Market): AlertItem[] {
  const alerts: AlertItem[] = []; const pointDate = data.meetingDate || isoToday();
  data.dossiers.forEach((item) => { if (isClosed(item.status)) return; const common = { title: item.title || "Dossier", targetId: `dossier-${item.id}`, category: "Dossier" as const }; if (/bloqu/i.test(item.status)) alerts.push({ ...common, detail: item.comment || "Dossier bloquant", severity: "danger" }); else if (item.deadline && daysBetween(item.deadline, pointDate) > 0) alerts.push({ ...common, detail: `Échéance dépassée depuis ${daysBetween(item.deadline, pointDate)} jour(s)`, severity: "danger" }); else if (/(surveill|action)/i.test(item.status)) alerts.push({ ...common, detail: item.comment || item.action || item.status, severity: "warning" }); });
  const jiraAlerts = data.jira.filter((item) => !isClosedJiraStatus(item.status) && item.lastActivity)
    .map((item) => ({ item, ...jiraAttention(item, pointDate, market, data.jiraAlertRules) }))
    .filter(({ level }) => level === "warning" || level === "critical")
    .sort((a, b) => Number(jiraRuleFor(b.item, data.jiraAlertRules ?? [])?.priority === "high") - Number(jiraRuleFor(a.item, data.jiraAlertRules ?? [])?.priority === "high") || (b.inactivity ?? 0) - (a.inactivity ?? 0))
    .map(({ item, inactivity, level }): AlertItem => ({
      title: item.key || item.summary || "Ticket Jira",
      detail: `${item.subcategory || item.category || "Jira"} · Sans activité depuis ${inactivity} jour(s)${item.assignee ? ` · ${item.assignee}` : ""}`,
      severity: level === "critical" ? "danger" : "warning",
      targetId: `jira-${item.id}`, link: item.link || undefined, category: "Jira",
    }));
  return [...jiraAlerts, ...alerts].sort((a, b) => Number(b.severity === "danger") - Number(a.severity === "danger")).slice(0, 12);
}

