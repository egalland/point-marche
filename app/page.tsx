"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { AppDialog } from "../components/app-dialog";
import { buildMarketJql, GLOBAL_ROLE_OPTIONS, roleLabel, roleMailMode, roleUsesAutomaticJira, type GlobalDirectoryUser, type GlobalRole } from "../lib/global-directory";
import { JIRA_SUMMARY_STATUSES, parseJiraAssigneeSummary, type JiraSummaryImport } from "../lib/jira-import";

type Tone = "mint" | "violet" | "aqua" | "peach" | "red";
type View = "read" | "edit" | "mail";
type Section = "general" | "dossiers" | "operations" | "tariffs" | "jira" | "saved" | "markets" | "users" | "mail";
type CarryoverFields = { sourceId?: string; carriedFromYear?: number; carriedFromWeek?: number };
type Dossier = { id: string; title: string; universe: string; reference: string; status: string; owner: string; action: string; deadline: string; progress: number; comment: string } & CarryoverFields;
type CommercialOperation = { id: string; name: string; month: string; state: string; summary: string; steps: [string, string][] } & CarryoverFields;
type Tariff = { id: string; code: string; supplier: string; month: string; state: string; receptionDate: string; dueDate: string; owner: string; comment: string };
type JiraTicket = { id: string; key: string; internalId?: string; summary: string; status: string; priority: string; assignee: string; assigneeUserCode?: string; createdAt?: string; lastActivity: string; link: string; comment: string; count?: number };
type PointData = { pointName: string; themeColor: ThemeKey; customColor: string; meetingDate: string; priority: string; dossiers: Dossier[]; operations: CommercialOperation[]; tariffs: Tariff[]; jira: JiraTicket[]; mail: { to: string; cc: string; subject: string; intro: string; autoTo?: string[]; autoCc?: string[] } };
type AlertItem = { title: string; detail: string; severity: "warning" | "danger"; targetId?: string; link?: string; category: "Jira" | "Dossier" | "Tarif" };
type ThemeKey = "mint" | "violet" | "aqua" | "peach" | "red";
type Market = { id: string; name: string; short: string; tone: ThemeKey; colorHex: string; position: number; jiraWarningDays: number; jiraCriticalDays: number };
type PointRecord = { id: string; marketId: string; year: number; week: number; meetingDate: string; pointName: string; themeColor: ThemeKey; data: PointData; createdAt: string };
type ImportOutcome = { count: number; message?: string };
type JiraPersonGroup = { assignee: string; items: JiraTicket[]; total: number };
type JiraWeekPayload = { snapshot: { year: number; week: number; rawText: string; summary: JiraSummaryImport; updatedAt: string } | null; assignments: Record<string, string[]>; error?: string };
type SessionPayload = { user: { displayName: string; username: string } | null };
type DirectoryDraft = { name: string; email: string; usercode: string; role: GlobalRole; marketIds: string[] };
type DirectoryEditor = { id: string; draft: DirectoryDraft };
type ConfirmRequest = { title: string; detail: string; confirmLabel: string; destructive?: boolean };

const defaultMarkets: Market[] = [
  { id: "revetements-menuiserie", name: "Revêtements & Menuiserie", short: "REV–MEN", tone: "mint", colorHex: "", position: 0, jiraWarningDays: 10, jiraCriticalDays: 20 },
  { id: "bois-amex", name: "Bois amin / AMEX", short: "BOIS", tone: "peach", colorHex: "", position: 1, jiraWarningDays: 10, jiraCriticalDays: 20 },
  { id: "outillage-quincaillerie", name: "Outillage & Quincaillerie", short: "OUT–QUIN", tone: "aqua", colorHex: "", position: 2, jiraWarningDays: 10, jiraCriticalDays: 20 },
  { id: "panneaux", name: "Panneaux", short: "PAN", tone: "violet", colorHex: "", position: 3, jiraWarningDays: 10, jiraCriticalDays: 20 },
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
const emptyDirectoryDraft = (): DirectoryDraft => ({ name: "", email: "", usercode: "", role: "chef-produit", marketIds: [] });
const uid = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const isoToday = () => new Date().toISOString().slice(0, 10);
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
    tariffs: [
      ["D2381", "JELDWEN ALLEMAGNE", "Août 2026", "Trame reçue", "", "", "", ""],
      ["B9822", "EDAC", "Septembre 2026", "Décalé", "", "", "", "Décalage septembre"],
      ["B9642", "THEUMA", "Août 2026", "En cours", "", "", "", ""],
      ["B6515", "BLOCFER", "Août 2026", "En cours", "", "", "", ""],
      ["C8074", "FELDOR", "Août 2026", "En cours", "", "", "", ""],
      ["A5633", "COULIDOOR", "Août 2026", "En cours", "", "", "", ""],
      ["A3453", "SOGAL", "Septembre 2026", "À préparer", "", "", "", ""],
      ["A8226", "GIMM GAM", "Septembre 2026", "À préparer", "", "", "", ""],
      ["D6280", "LEBO DOORS", "Septembre 2026", "À préparer", "", "", "", ""],
      ["A1170", "BEL’M", "Septembre 2026", "À préparer", "", "", "", ""],
    ].map(([code, supplier, month, state, receptionDate, dueDate, owner, comment]) => ({ id: uid(), code, supplier, month, state, receptionDate, dueDate, owner, comment })),
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
  return {
    pointName: "Point marché",
    themeColor,
    customColor: normalizeHex(source.customColor) || fallback.customColor,
    meetingDate: typeof source.meetingDate === "string" ? source.meetingDate : fallback.meetingDate,
    priority: typeof source.priority === "string" ? source.priority : fallback.priority,
    dossiers: Array.isArray(source.dossiers) ? source.dossiers : [],
    operations: Array.isArray(source.operations) ? source.operations : Array.isArray(source.simulations) ? source.simulations : [],
    tariffs: Array.isArray(source.tariffs) ? source.tariffs : [],
    jira: Array.isArray(source.jira) ? source.jira : [],
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
  const payload = await response.json() as { markets?: { id: string; name: string; shortCode: string; tone: ThemeKey; colorHex?: string; position: number; jiraWarningDays?: number; jiraCriticalDays?: number }[]; error?: string };
  if (!response.ok) throw new Error(payload.error || "Impossible de charger les marchés.");
  return (payload.markets ?? []).map((market) => ({ id: market.id, name: market.name, short: market.shortCode, tone: market.tone, colorHex: normalizeHex(market.colorHex), position: market.position, jiraWarningDays: Number(market.jiraWarningDays) || 10, jiraCriticalDays: Number(market.jiraCriticalDays) || 20 }));
}

async function fetchDirectoryUsers(): Promise<GlobalDirectoryUser[]> {
  const response = await fetch("/api/global-users", { cache: "no-store" });
  const payload = await response.json() as { users?: GlobalDirectoryUser[]; error?: string };
  if (!response.ok) throw new Error(payload.error || "Impossible de charger l’annuaire GLOBAL.");
  return payload.users ?? [];
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

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    edit: <><path d="M4 20h4l11-11-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></>,
    eye: <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></>,
    folder: <><path d="M3 7h6l2 2h10v10H3Z"/><path d="M3 7V5h7l2 2"/></>,
    trend: <><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/><path d="m3 8 6-4 6 7 6-5"/></>,
    ticket: <><path d="M20 13a2 2 0 0 0 0-4V5H4v4a2 2 0 0 1 0 4v4h16Z"/><path d="M9 8.5h6M9 12h6M9 15.5h3"/></>,
    alert: <><path d="M12 3 2.7 20h18.6Z"/><path d="M12 9v5M12 17.5v.1"/></>,
    plus: <path d="M12 5v14M5 12h14"/>, trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/><path d="M10 11v5M14 11v5"/></>,
    copy: <><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></>,
    more: <><circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/></>,
    download: <><path d="M12 3v12m0 0 5-5m-5 5-5-5"/><path d="M4 20h16"/></>, upload: <><path d="M12 16V4m0 0 5 5m-5-5L7 9"/><path d="M4 20h16"/></>,
    spark: <><path d="m12 2 1.4 5.1L18 9l-4.6 1.9L12 16l-1.4-5.1L6 9l4.6-1.9Z"/><path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7Z"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></>,
    user: <><circle cx="12" cy="8" r="3"/><path d="M5 21c.7-4 3-6 7-6s6.3 2 7 6"/></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
    chevron: <path d="m9 6 6 6-6 6"/>, check: <path d="m5 12 4 4L19 6"/>,
  };
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

function isoWeek(dateString: string) {
  const date = new Date(`${dateString || isoToday()}T12:00:00`); const target = new Date(date.valueOf()); const day = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - day + 3); const firstThursday = new Date(target.getFullYear(), 0, 4); const firstDay = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDay + 3); return 1 + Math.round((target.valueOf() - firstThursday.valueOf()) / 604800000);
}
function isoWeekYear(dateString: string) { const date = new Date(`${dateString || isoToday()}T12:00:00`); const day = (date.getDay() + 6) % 7; date.setDate(date.getDate() - day + 3); return date.getFullYear(); }
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
  const date = new Date(`${dateString || isoToday()}T12:00:00Z`);
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
function dateLabel(value: string) { if (!value) return "Date à définir"; return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`)); }
function dateValue(value: string) { return new Date(value.includes("T") ? value : `${value}T12:00:00`).valueOf(); }
function daysBetween(from: string, to: string) { if (!from || !to) return 0; return Math.max(0, Math.floor((dateValue(to) - dateValue(from)) / 86400000)); }
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
function normalizeJiraSummary(summary: JiraSummaryImport): JiraSummaryImport {
  const detailedTickets = Array.isArray(summary.detailedTickets) ? summary.detailedTickets : [];
  return { ...summary, detailedTickets, mode: summary.mode ?? (detailedTickets.length ? "detailed" : "summary") };
}
function jiraTicketsFromSummary(summaryInput: JiraSummaryImport, selectedPeople: string[], marketId: string) {
  const summary = normalizeJiraSummary(summaryInput);
  const selectedUserCodes = new Set(selectedPeople.map((person) => person.toUpperCase()));
  if (summary.detailedTickets.length) {
    return summary.detailedTickets.filter((ticket) => ticket.marketId === marketId && (!selectedUserCodes.size || selectedUserCodes.has(ticket.assigneeUserCode.toUpperCase()))).map((ticket) => ({
      id: uid(), key: ticket.key, internalId: ticket.internalId, summary: ticket.summary, status: ticket.status, priority: "",
      assignee: ticket.assigneeName || ticket.assigneeUserCode, assigneeUserCode: ticket.assigneeUserCode, createdAt: ticket.createdAt,
      lastActivity: ticket.updatedAt, link: ticket.link, comment: "Import Jira détaillé", count: 1,
    }));
  }
  const selected = new Set(selectedPeople);
  return summary.items.filter((item) => selected.has(item.assignee)).map((item) => ({
    id: uid(), key: "", summary: "Synthèse de la file Jira", status: item.status, priority: "", assignee: item.assignee,
    lastActivity: "", link: item.link, comment: "Tableau Jira hebdomadaire", count: item.count,
  }));
}
async function fetchJiraWeek(year: number, week: number, marketId: string): Promise<JiraWeekPayload> {
  const response = await fetch(`/api/jira-week?marketId=${encodeURIComponent(marketId)}&year=${year}&week=${week}`, { cache: "no-store" });
  const payload = await response.json() as JiraWeekPayload;
  if (!response.ok) throw new Error(payload.error || "Impossible de charger le tableau Jira hebdomadaire.");
  return payload;
}
async function applyJiraWeek(data: PointData, marketId: string) {
  try {
    const payload = await fetchJiraWeek(isoWeekYear(data.meetingDate), isoWeek(data.meetingDate), marketId);
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

function PasteImporter({ kind, marketName, onImport }: { kind: "tariffs" | "jira"; marketName?: string; onImport: (text: string) => ImportOutcome }) {
  const [open, setOpen] = useState(false); const [text, setText] = useState(""); const [message, setMessage] = useState("");
  const label = kind === "tariffs" ? "évolutions tarifaires" : "tickets Jira";
  const columns = kind === "tariffs" ? "Code | Fournisseur | Mois | État | Réception | Échéance | Responsable | Commentaire" : "Personne | À faire | Réouvert | En cours | Attente client | Attente tiers | Attente changement | Total";
  const titleId = `paste-${kind}-title`;
  return <div className={`paste-importer ${open ? "is-open" : ""}`}><button className="secondary-button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}><Icon name="copy" /> Coller un tableau</button><AppDialog open={open} onClose={() => setOpen(false)} labelledBy={titleId} className="paste-panel modal-paste-panel"><div><strong id={titleId}>Import rapide des {label}</strong><span>{kind === "jira" ? "Colle le tableau récapitulatif complet : toutes les personnes et tous les statuts seront reconnus." : "Copie les lignes depuis Excel, avec ou sans en-tête."}</span></div>{kind === "jira" && marketName && <div className="paste-market-target"><Icon name="check" size={14}/><span>Marché cible</span><strong>{marketName}</strong></div>}<code>{columns}</code><textarea data-autofocus value={text} onChange={(event) => setText(event.target.value)} placeholder={kind === "jira" ? "Colle ici le tableau Jira complet, tel qu’il est copié…" : "Colle ici les lignes séparées par des tabulations ou des points-virgules…"} /><div className="paste-actions"><span>{message}</span><div><button className="secondary-button small" type="button" onClick={() => setOpen(false)}>Fermer</button><button className="primary-button small" onClick={() => { const result = onImport(text); setMessage(result.message ?? (result.count ? `${result.count} ligne${result.count > 1 ? "s" : ""} importée${result.count > 1 ? "s" : ""}.` : "Aucune ligne reconnue.")); if (result.count) setText(""); }}>Importer</button></div></div></AppDialog></div>;
}

function JiraPasteImporter({ marketId, marketName, directoryUsers, year, week, onImport }: { marketId: string; marketName: string; directoryUsers: GlobalDirectoryUser[]; year: number; week: number; onImport: (summary: JiraSummaryImport, selectedPeople: string[]) => ImportOutcome }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<JiraSummaryImport>(() => parseJiraAssigneeSummary(""));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");
  const marketPeople = useMemo(() => directoryUsers.filter((user) => roleUsesAutomaticJira(user.role) && user.marketIds.includes(marketId) && /^[A-Z]\d{7}$/i.test(user.usercode)), [directoryUsers, marketId]);
  const personByUserCode = useMemo(() => new Map(marketPeople.map((person) => [person.usercode.toUpperCase(), person])), [marketPeople]);
  const jql = useMemo(() => buildMarketJql(directoryUsers, marketId), [directoryUsers, marketId]);
  const recognizedTickets = useMemo(() => preview.detailedTickets.filter((ticket) => personByUserCode.has(ticket.assigneeUserCode.toUpperCase())), [personByUserCode, preview.detailedTickets]);
  const recognizedPeople = useMemo(() => Array.from(new Set(recognizedTickets.map((ticket) => ticket.assigneeUserCode.toUpperCase()))).map((usercode) => {
    const person = personByUserCode.get(usercode);
    const tickets = recognizedTickets.filter((ticket) => ticket.assigneeUserCode.toUpperCase() === usercode);
    return { usercode, name: person?.name ?? usercode, tickets };
  }).sort((a, b) => b.tickets.length - a.tickets.length || a.name.localeCompare(b.name, "fr")), [personByUserCode, recognizedTickets]);
  const unknownUserCodes = useMemo(() => Array.from(new Set(preview.detailedTickets.map((ticket) => ticket.assigneeUserCode.toUpperCase()).filter((usercode) => !personByUserCode.has(usercode)))), [personByUserCode, preview.detailedTickets]);

  useEffect(() => {
    let active = true;
    void fetchJiraWeek(year, week, marketId).then((payload) => {
      if (!active) return;
      if (payload.snapshot) {
        setText(payload.snapshot.rawText);
        setPreview(normalizeJiraSummary(payload.snapshot.summary));
        setMessage(`Import déjà enregistré pour ${marketName} · ${year} · S${String(week).padStart(2, "0")}.`);
      } else {
        setText("");
        setPreview(parseJiraAssigneeSummary(""));
        setMessage("Aucun import Jira enregistré pour ce marché et cette semaine.");
      }
    }).catch((error) => { if (active) setMessage(error instanceof Error ? error.message : "Chargement impossible."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [marketId, marketName, year, week]);

  const updateText = (value: string) => { setText(value); setMessage(""); setPreview(parseJiraAssigneeSummary(value)); };
  const copyJql = async () => {
    if (!jql) return;
    try {
      await navigator.clipboard.writeText(jql);
    } catch {
      const input = document.createElement("textarea");
      input.value = jql;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };
  const saveMarketTable = async () => {
    if (!recognizedTickets.length || saving) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/jira-week", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ marketId, year, week, rawText: text }) });
      const payload = await response.json() as JiraWeekPayload;
      if (!response.ok || !payload.snapshot) throw new Error(payload.error || "Enregistrement impossible.");
      const result = onImport(normalizeJiraSummary(payload.snapshot.summary), payload.assignments[marketId] ?? marketPeople.map((person) => person.usercode));
      setPreview(normalizeJiraSummary(payload.snapshot.summary));
      setMessage(result.message ?? `Import enregistré pour ${marketName} · ${year} · S${String(week).padStart(2, "0")}.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Enregistrement impossible."); }
    finally { setSaving(false); }
  };
  const formatLabel = preview.format === "tabulated" ? "Export tabulé détecté" : preview.format === "markdown" ? "Tableau Jira détecté" : preview.format === "semicolon" ? "Tableau séparé par ; détecté" : "En attente de l’export";

  return <div className={`paste-importer jira-paste-importer ${open ? "is-open" : ""}`}>
    <button type="button" className="secondary-button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}><Icon name="copy" /> Importer les tickets Jira</button>
    <AppDialog open={open} onClose={() => setOpen(false)} busy={saving} labelledBy="jira-import-title" className="paste-panel jira-paste-panel">
      <div className="jira-import-heading"><div><strong id="jira-import-title">Import Jira · {marketName}</strong><span>{year} · S{String(week).padStart(2, "0")} · rattachement automatique par USERCODE</span></div><div className="paste-market-target"><Icon name="check" size={14}/><span>Chefs configurés</span><strong>{marketPeople.length}</strong></div></div>
      <section className={`jira-query-card ${jql ? "" : "is-empty"}`}><div className="jira-query-heading"><div><span>1 · Requête prête pour Jira</span><strong>{jql ? `${marketPeople.length} USERCODE de chefs inclus` : "Aucun chef avec USERCODE disponible"}</strong></div><button type="button" className="secondary-button" disabled={!jql} onClick={copyJql}><Icon name={copied ? "check" : "copy"} size={15}/> {copied ? "Requête copiée" : "Copier la requête"}</button></div>{jql ? <pre className="jira-query-code">{jql}</pre> : <p>Ajoute d’abord un chef de produit ou un chef de marché avec son USERCODE dans l’annuaire GLOBAL.</p>}</section>
      <div className="jira-import-step"><span>2 · Colle l’export détaillé</span><code>Clé de ticket → ID → État → Résumé → Création → Personne assignée (USERCODE) → Mise à jour</code></div>
      <textarea data-autofocus value={text} disabled={loading} onChange={(event) => updateText(event.target.value)} placeholder="Colle ici l’export Jira tabulé détaillé…" aria-label="Export Jira tabulé détaillé de la semaine" />
      <div className={`jira-detection ${preview.mode === "detailed" && preview.detailedTickets.length ? "is-valid" : ""}`}><span><Icon name={preview.mode === "detailed" && preview.detailedTickets.length ? "check" : "copy"} size={15}/> {loading ? "Chargement de l’import hebdomadaire…" : formatLabel}</span><strong>{preview.mode === "detailed" && preview.detailedTickets.length ? `${preview.detailedTickets.length} ticket${preview.detailedTickets.length > 1 ? "s" : ""} détaillé${preview.detailedTickets.length > 1 ? "s" : ""}` : preview.personCount ? "Ancien récapitulatif détecté · export détaillé requis" : "Aucune ligne reconnue"}</strong></div>
      {preview.detailedTickets.length > 0 && <div className="jira-preview jira-auto-preview">
        <div className="jira-preview-toolbar"><div><strong>Prévisualisation automatique</strong><span>Seules les personnes de {marketName} qui ont au moins un ticket seront affichées dans le point.</span></div><b>{recognizedTickets.length} / {preview.detailedTickets.length} tickets reconnus</b></div>
        {recognizedPeople.length ? <div className="jira-preview-persons">{recognizedPeople.map((person) => <article key={person.usercode}><span>{person.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span><div><strong>{person.name}</strong><small>{person.usercode} · {jiraStatusSummary(person.tickets.map((ticket) => ({ id: ticket.key, key: ticket.key, summary: ticket.summary, status: ticket.status, priority: "", assignee: person.name, lastActivity: ticket.updatedAt, link: ticket.link, comment: "", count: 1 })))}</small></div><b>{person.tickets.length}</b></article>)}</div> : <div className="jira-query-empty">Aucun ticket ne correspond aux USERCODE enregistrés pour ce marché.</div>}
        {unknownUserCodes.length > 0 && <div className="jira-unknown"><Icon name="alert" size={15}/><span><strong>{unknownUserCodes.length} USERCODE non rattaché{unknownUserCodes.length > 1 ? "s" : ""}</strong> · {unknownUserCodes.join(", ")} · ces tickets ne seront pas affichés.</span></div>}
      </div>}
      <div className="paste-actions"><span>{message}</span><div><button type="button" className="secondary-button small" disabled={saving} onClick={() => setOpen(false)}>Fermer</button><button type="button" className="primary-button small" disabled={!recognizedTickets.length || saving || loading} onClick={saveMarketTable}><Icon name="check" size={15}/> {saving ? "Enregistrement…" : "Enregistrer l’import de ce marché"}</button></div></div>
    </AppDialog>
  </div>;
}

function buildAlerts(data: PointData, market: Market): AlertItem[] {
  const alerts: AlertItem[] = []; const pointDate = data.meetingDate || isoToday(); const day = new Date(`${pointDate}T12:00:00`).getDate();
  data.dossiers.forEach((item) => { if (isClosed(item.status)) return; const common = { title: item.title || "Dossier", targetId: `dossier-${item.id}`, category: "Dossier" as const }; if (/bloqu/i.test(item.status)) alerts.push({ ...common, detail: item.comment || "Dossier bloquant", severity: "danger" }); else if (item.deadline && daysBetween(item.deadline, pointDate) > 0) alerts.push({ ...common, detail: `Échéance dépassée depuis ${daysBetween(item.deadline, pointDate)} jour(s)`, severity: "danger" }); else if (/(surveill|action)/i.test(item.status)) alerts.push({ ...common, detail: item.comment || item.action || item.status, severity: "warning" }); });
  data.tariffs.forEach((item) => { if (isClosed(item.state)) return; const common = { title: item.supplier || "Évolution tarifaire", targetId: `tariff-${item.id}`, category: "Tarif" as const }; if (!item.receptionDate && day >= 15) alerts.push({ ...common, detail: "Trame non reçue après le 15", severity: "danger" }); else if (!item.receptionDate && day >= 8) alerts.push({ ...common, detail: "Trame à sécuriser avant le 15", severity: "warning" }); else if (item.receptionDate && daysBetween(item.receptionDate, pointDate) > 5 && !/(termin|fait|valid)/i.test(item.state)) alerts.push({ ...common, detail: `Trame reçue depuis ${daysBetween(item.receptionDate, pointDate)} jours · traitement à contrôler`, severity: "warning" }); });
  const warningDays = Math.max(1, market.jiraWarningDays || 10);
  const criticalDays = Math.max(warningDays + 1, market.jiraCriticalDays || 20);
  const jiraAlerts = data.jira.filter((item) => !isClosed(item.status) && item.lastActivity)
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
  const activeTickets = data.jira.filter((item) => !isClosed(item.status));
  const currentVolume = activeTickets.reduce((sum, item) => sum + jiraItemCount(item), 0);
  const history = archive
    .filter((record) => record.year < pointYear || (record.year === pointYear && record.week < pointWeek))
    .sort((a, b) => a.year - b.year || a.week - b.week)
    .filter((record, index, rows) => rows.findIndex((candidate) => candidate.year === record.year && candidate.week === record.week) === index)
    .slice(-3)
    .map((record) => ({ label: `S${String(record.week).padStart(2, "0")}`, value: record.data.jira.filter((item) => !isClosed(item.status)).reduce((sum, item) => sum + jiraItemCount(item), 0) }));
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

function PreviewDashboard({ data, market, archive }: { data: PointData; market: Market; archive: PointRecord[] }) {
  const alerts = useMemo(() => buildAlerts(data, market), [data, market]);
  const [alertFilter, setAlertFilter] = useState<"all" | "danger" | "jira">("all");
  const visibleAlerts = alerts.filter((item) => alertFilter === "all" || (alertFilter === "danger" ? item.severity === "danger" : item.category === "Jira"));
  const activeJira = data.jira.filter((item) => !isClosed(item.status));
  const activeJiraCount = activeJira.reduce((sum, item) => sum + jiraItemCount(item), 0);
  const metrics = [[data.dossiers.filter((item) => !isClosed(item.status)).length, "Dossiers suivis", "folder", "mint"], [data.tariffs.length, "Évolutions", "trend", "violet"], [activeJiraCount, "Tickets Jira", "ticket", "aqua"], [alerts.length, "Vigilances", "alert", "peach"]] as const;
  const groupedTariffs = Array.from(new Set(data.tariffs.map((item) => item.month || "Sans mois"))).map((month) => ({ month, items: data.tariffs.filter((item) => (item.month || "Sans mois") === month) }));
  const jiraPeople = Array.from(new Set(activeJira.map((item) => item.assignee || "Non assigné"))).map((assignee) => {
    const items = activeJira.filter((item) => (item.assignee || "Non assigné") === assignee);
    return { assignee, items, total: items.reduce((sum, item) => sum + jiraItemCount(item), 0) };
  }).sort((a, b) => b.total - a.total || a.assignee.localeCompare(b.assignee, "fr"));
  return <div className="report-canvas"><div className="report-ambient report-ambient-one"/><div className="report-ambient report-ambient-two"/>
    <header className="report-hero"><div><div className="market-badge"><i/> MARKET PULSE <b>/</b> {market.short}</div><h1>Point marché</h1><p><strong>{market.name}</strong><span>Dossiers · opérations commerciales · évolutions · Jira</span></p></div><div className="week-card"><strong><small>{isoWeekYear(data.meetingDate)} ·</small>S{String(isoWeek(data.meetingDate)).padStart(2, "0")}</strong><i/><div><b>{dateLabel(data.meetingDate)}</b><span>Année et semaine ISO</span></div></div></header>
    <section className="report-metrics">{metrics.map(([value, label, icon, tone], index) => <article className={`report-metric tone-${tone}`} key={label}><span>0{index + 1}</span><div className="report-metric-icon"><Icon name={icon}/></div><strong>{value}</strong><small>{label}</small></article>)}</section>
    <section className="report-priority"><span>Priorité de la semaine</span><strong>{data.priority || "Aucune priorité renseignée."}</strong></section>
    <JiraVolumePulse data={data} archive={archive} market={market}/>
    <div className="report-grid"><article className="report-focus"><div className="report-heading"><span>01</span><div><small>Dossiers</small><h2>En cours</h2></div><b>{data.dossiers.length} suivi{data.dossiers.length > 1 ? "s" : ""}</b></div>
      {data.dossiers.length ? <div className="report-dossiers">{data.dossiers.map((item, index) => <div id={`dossier-${item.id}`} className="report-dossier" key={item.id}><span className={`status-dot tone-${toneForStatus(item.status)}`}/><code>{String(index + 1).padStart(2, "0")}</code><div><strong>{item.title || "Dossier sans titre"}</strong><small>{[item.universe, item.reference, item.owner].filter(Boolean).join(" · ") || "Contexte à compléter"}</small></div><p>{item.action || item.comment || "Prochaine action à compléter."}</p><span className={`report-pill tone-${toneForStatus(item.status)}`}>{item.status}</span></div>)}</div> : <div className="report-empty">Aucun dossier renseigné</div>}
      <div className="report-subheading">Opérations commerciales (promo)</div>{data.operations.length ? <div className="report-simulations">{data.operations.map((item, index) => <section className={`report-simulation simulation-${index % 2 ? "violet" : "mint"}`} key={item.id}><div><code>{String.fromCharCode(65 + index)}</code><span className={`report-pill tone-${toneForStatus(item.state)}`}>{item.state}</span></div><small>{item.month || "Mois à définir"}</small><h3>{item.name || "Opération sans titre"}</h3><p>{item.summary}</p><div>{item.steps.map(([label, state]) => <div className="report-step" key={label}><span>{label}</span><strong className={`tone-text-${toneForStatus(state)}`}><i/>{state}</strong></div>)}</div></section>)}</div> : <div className="report-empty">Aucune opération commerciale renseignée</div>}
    </article><aside className="report-side">
      <article className="report-dark-card"><div className="side-heading"><div><span>02</span><h2>Évolutions tarifaires</h2></div><b>{data.tariffs.length} total</b></div>{groupedTariffs.length ? groupedTariffs.map((group) => <section className="tariff-group" key={group.month}><h3>{group.month}<span>{group.items.length} fournisseur{group.items.length > 1 ? "s" : ""}</span></h3>{group.items.map((item) => <div id={`tariff-${item.id}`} className="tariff-line" key={item.id}><code>{item.code || "—"}</code><strong>{item.supplier || "Fournisseur"}</strong><small>{item.state}</small></div>)}</section>) : <div className="report-empty dark-empty">Aucune évolution</div>}</article>
      <article className="report-dark-card"><div className="side-heading"><div><span>03</span><h2>Jira par personne</h2></div><b>{activeJiraCount} actif{activeJiraCount > 1 ? "s" : ""}</b></div>{jiraPeople.length ? <div className="jira-summary">{jiraPeople.map((person, index) => <div key={person.assignee}><i className={`tone-${(["mint", "violet", "aqua", "peach"] as Tone[])[index % 4]}`}/><p><strong>{person.assignee}</strong><small>{jiraStatusSummary(person.items)}</small></p><b>{person.total}</b></div>)}</div> : <div className="report-empty dark-empty">Aucun ticket actif</div>}</article>
      <article className="report-alert-card"><div className="alert-heading"><span>04</span><h2>Vigilances</h2><b>{visibleAlerts.length}/{alerts.length}</b></div>{alerts.length > 0 && <div className="alert-filters"><button type="button" className={alertFilter === "all" ? "active" : ""} onClick={() => setAlertFilter("all")}>Toutes</button><button type="button" className={alertFilter === "danger" ? "active" : ""} onClick={() => setAlertFilter("danger")}>Critiques</button><button type="button" className={alertFilter === "jira" ? "active" : ""} onClick={() => setAlertFilter("jira")}>Jira</button></div>}{visibleAlerts.length ? visibleAlerts.map((item, index) => <a className="alert-line" key={`${item.title}-${index}`} href={item.link || (item.targetId ? `#${item.targetId}` : "#top")} target={item.link ? "_blank" : undefined} rel={item.link ? "noreferrer" : undefined}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{item.title}</strong><small><b>{item.category}</b> · {item.detail}</small></div><Icon name="chevron" size={14}/></a>) : <div className="report-empty light-empty">{alerts.length ? "Aucune vigilance dans ce filtre" : "Aucune vigilance détectée"}</div>}</article>
    </aside></div><footer className="report-footer"><span>Market Pulse · {market.name}</span><span>Point marché · {isoWeekYear(data.meetingDate)} · S{String(isoWeek(data.meetingDate)).padStart(2, "0")}</span></footer>
  </div>;
}

function buildMailHtml(data: PointData, market: Market) {
  const alerts = buildAlerts(data, market); const activeJiraItems = data.jira.filter((item) => !isClosed(item.status)); const activeJira = activeJiraItems.reduce((sum, item) => sum + jiraItemCount(item), 0);
  const theme = themes.find((item) => item.id === data.themeColor) ?? themes[0];
  const accent = normalizeHex(data.customColor) || theme.accent;
  const dossierRows = data.dossiers.map((item) => `<tr><td style="padding:12px 14px;border-bottom:1px solid #DDE7E3"><b style="color:#10201D">${escapeHtml(item.title || "Dossier")}</b><br><span style="color:#64736F;font-size:11px">${escapeHtml([item.universe, item.reference].filter(Boolean).join(" · "))}</span></td><td style="padding:12px 14px;border-bottom:1px solid #DDE7E3;color:#41534E;font-size:12px">${escapeHtml(item.action || item.comment || "—")}</td><td style="padding:12px 14px;border-bottom:1px solid #DDE7E3;text-align:right"><span style="display:inline-block;padding:6px 9px;border-radius:99px;background:#E7EEE9;color:#253E36;font-size:10px;font-weight:700">${escapeHtml(item.status)}</span></td></tr>`).join("");
  const tariffRows = data.tariffs.map((item) => `<tr><td style="padding:8px 10px;color:#7C8F92;font-family:monospace;font-size:10px">${escapeHtml(item.code || "—")}</td><td style="padding:8px 10px;color:#FFFFFF;font-size:11px;font-weight:700">${escapeHtml(item.supplier || "Fournisseur")}</td><td style="padding:8px 10px;color:#AFC0C2;font-size:10px">${escapeHtml(item.month || "—")}</td><td style="padding:8px 10px;color:${accent};font-size:10px">${escapeHtml(item.state || "—")}</td></tr>`).join("");
  const jiraPeople = Array.from(new Set(activeJiraItems.map((item) => item.assignee || "Non assigné"))).map((assignee) => { const items = activeJiraItems.filter((item) => (item.assignee || "Non assigné") === assignee); return { assignee, items, total: items.reduce((sum, item) => sum + jiraItemCount(item), 0) }; }).sort((a, b) => b.total - a.total || a.assignee.localeCompare(b.assignee, "fr"));
  const jiraRows = jiraPeople.map((person) => `<tr><td style="padding:8px 10px;color:#FFFFFF;font-size:11px;font-weight:700">${escapeHtml(person.assignee)}</td><td style="padding:8px 10px;color:#AFC0C2;font-size:9px">${escapeHtml(jiraStatusSummary(person.items))}</td><td style="padding:8px 10px;color:#70D8FF;font-family:monospace;font-size:12px;font-weight:700;text-align:right">${person.total}</td></tr>`).join("");
  const alertRows = alerts.map((item, index) => `<tr><td style="padding:9px 0;border-bottom:1px solid #E18B5E;width:34px;color:#743817;font-family:monospace;font-size:10px">${String(index + 1).padStart(2, "0")}</td><td style="padding:9px 0;border-bottom:1px solid #E18B5E"><b style="display:block;color:#23140C;font-size:11px">${escapeHtml(item.title)}</b><span style="color:#743817;font-size:10px">${escapeHtml(item.detail)}</span></td></tr>`).join("");
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(data.mail.subject)}</title></head><body style="margin:0;padding:0;background:#F2F5F4;font-family:Arial,sans-serif;color:#10201D"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#F2F5F4"><tr><td align="center" style="padding:26px 12px"><table role="presentation" width="1000" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:1000px;background:#071012">
  <tr><td style="padding:28px 30px 22px;background:#071012"><span style="display:inline-block;padding:6px 10px;border:1px solid ${accent};border-radius:99px;color:${accent};font-size:10px;font-weight:700">MARKET PULSE / ${escapeHtml(market.short)}</span><h1 style="margin:12px 0 4px;color:#FFFFFF;font-size:38px;line-height:42px">Point marché</h1><p style="margin:0;color:${accent};font-size:16px;font-weight:700">${escapeHtml(market.name)}</p><p style="margin:15px 0 0;color:#AFC0C2;font-size:12px">Année ISO ${isoWeekYear(data.meetingDate)} · Semaine ${String(isoWeek(data.meetingDate)).padStart(2, "0")} · ${escapeHtml(dateLabel(data.meetingDate))}</p></td></tr>
  <tr><td style="padding:0 30px 22px;background:#071012"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>${[[data.dossiers.length,"Dossiers"],[data.tariffs.length,"Évolutions"],[activeJira,"Tickets Jira"],[alerts.length,"Vigilances"]].map(([value,label], index) => `<td width="25%" style="padding-right:${index < 3 ? "8px" : "0"}"><table role="presentation" width="100%" style="background:#102023;border:1px solid #263C40"><tr><td style="padding:13px"><b style="display:block;color:#FFFFFF;font-size:24px">${value}</b><span style="color:#AFC0C2;font-size:10px;text-transform:uppercase">${label}</span></td></tr></table></td>`).join("")}</tr></table></td></tr>
  <tr><td style="padding:0 30px 24px;background:#071012"><table role="presentation" width="100%" style="background:#132622;border-left:4px solid ${accent}"><tr><td style="padding:14px 16px"><b style="display:block;color:${accent};font-size:9px;text-transform:uppercase">Priorité de la semaine</b><span style="display:block;margin-top:5px;color:#FFFFFF;font-size:13px">${escapeHtml(data.priority || "Aucune priorité renseignée.")}</span></td></tr></table></td></tr>
  <tr><td style="padding:0 30px 18px;background:#071012"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td valign="top" width="65%" style="padding-right:8px"><table role="presentation" width="100%" style="background:#F5F8F6"><tr><td style="padding:17px 18px 8px;color:#55716A;font-size:10px;font-weight:700;text-transform:uppercase">Dossiers en cours</td></tr><tr><td style="padding:0 8px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${dossierRows || '<tr><td style="padding:16px;color:#64736F;font-size:12px">Aucun dossier renseigné</td></tr>'}</table></td></tr></table></td><td valign="top" width="35%" style="padding-left:8px"><table role="presentation" width="100%" style="background:#FFB083"><tr><td style="padding:16px"><b style="font-size:13px;text-transform:uppercase">Vigilances · ${alerts.length}</b><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:8px">${alertRows || '<tr><td style="padding:12px 0;color:#743817;font-size:11px">Aucune vigilance détectée</td></tr>'}</table></td></tr></table></td></tr></table></td></tr>
  <tr><td style="padding:0 30px 18px;background:#071012"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td valign="top" width="50%" style="padding-right:8px"><table role="presentation" width="100%" style="background:#102023"><tr><td style="padding:15px;color:#B39AFF;font-size:11px;font-weight:700;text-transform:uppercase">Évolutions tarifaires</td></tr><tr><td style="padding:0 6px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${tariffRows || '<tr><td style="padding:12px;color:#AFC0C2;font-size:11px">Aucune évolution</td></tr>'}</table></td></tr></table></td><td valign="top" width="50%" style="padding-left:8px"><table role="presentation" width="100%" style="background:#102023"><tr><td style="padding:15px;color:#70D8FF;font-size:11px;font-weight:700;text-transform:uppercase">Tickets Jira actifs</td></tr><tr><td style="padding:0 6px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${jiraRows || '<tr><td style="padding:12px;color:#AFC0C2;font-size:11px">Aucun ticket actif</td></tr>'}</table></td></tr></table></td></tr></table></td></tr>
  <tr><td style="padding:18px 30px;background:#0C181B;color:#789094;font-size:9px;text-transform:uppercase">Market Pulse · ${escapeHtml(market.name)} · Point marché ${isoWeekYear(data.meetingDate)} · S${String(isoWeek(data.meetingDate)).padStart(2, "0")}</td></tr></table></td></tr></table></body></html>`;
}

export default function Home() {
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
  const [directorySavingId, setDirectorySavingId] = useState("");
  const [directoryEditor, setDirectoryEditor] = useState<DirectoryEditor | null>(null);
  const [directoryRevision, setDirectoryRevision] = useState(0);
  const [lastSavedSignature, setLastSavedSignature] = useState("");
  const [toast, setToast] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(() => monthStart(isoToday()));
  const [session, setSession] = useState<SessionPayload>({ user: null });
  const [sessionReady, setSessionReady] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginUsername, setLoginUsername] = useState("GLOBAL");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [carryoverOpen, setCarryoverOpen] = useState(false);
  const [carryoverSelection, setCarryoverSelection] = useState<Record<string, boolean>>({});
  const [calendarExpanded, setCalendarExpanded] = useState(true);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const archiveRequest = useRef(0);
  const confirmResolver = useRef<((confirmed: boolean) => void) | null>(null);
  const market = marketOptions.find((item) => item.id === marketId) ?? marketOptions[0] ?? defaultMarkets[0];
  const theme = themes.find((item) => item.id === data.themeColor) ?? themes[0];
  const accent = normalizeHex(data.customColor) || theme.accent;
  const themeStyle = { "--accent": accent, "--accent-soft": normalizeHex(data.customColor) ? hexSoft(data.customColor) : theme.soft } as CSSProperties;
  const alerts = useMemo(() => buildAlerts(data, market), [data, market]);
  const mailHtml = useMemo(() => buildMailHtml(data, market), [data, market]);
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
        const latest = points[0];
        if (latest) {
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

  useEffect(() => { const timer = window.setTimeout(() => { void bootstrap(); }, 0); return () => window.clearTimeout(timer); }, [bootstrap]);
  useEffect(() => {
    let active = true;
    void fetch("/api/session", { cache: "no-store" }).then((response) => response.json()).then((payload: SessionPayload) => {
      if (!active) return;
      setSession(payload);
      if (payload.user) {
        void loadDirectory();
        if (new URLSearchParams(window.location.search).get("mode") === "edit") setView("edit");
      }
    }).catch(() => { /* La lecture publique reste disponible. */ }).finally(() => { if (active) setSessionReady(true); });
    return () => { active = false; };
  }, [loadDirectory]);
  useEffect(() => {
    if (!session.user || !directoryReady) return;
    const timer = window.setTimeout(() => setData((current) => applyDirectoryMail(current, marketId, directoryUsers)), 0);
    return () => window.clearTimeout(timer);
  }, [data, directoryReady, directoryUsers, marketId, session.user]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(""), 2600); return () => window.clearTimeout(timer); }, [toast]);
  useEffect(() => {
    if (!isDirty || view !== "edit") return;
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
      setView("edit");
      await loadDirectory();
      setToast("Connexion réussie. Mode édition ouvert.");
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
    setView("read");
    setLoginPassword("");
    setToast("Déconnexion effectuée.");
  };

  const chooseView = (nextView: View) => {
    if (nextView === "edit" && !session.user) {
      openLogin();
      return;
    }
    setView(nextView);
  };

  const chooseMarket = async (nextMarket: string) => {
    if (nextMarket !== marketId && view === "edit" && isDirty && !await requestConfirmation({ title: "Changer de marché ?", detail: "Les modifications du brouillon actuel ne seront pas enregistrées.", confirmLabel: "Changer de marché", destructive: true })) return;
    setSection("general");
    await loadMarket(nextMarket, true, marketOptions.find((item) => item.id === nextMarket));
    setCalendarExpanded(true);
  };
  const updateDossier = (id: string, patch: Partial<Dossier>) => setData((current) => ({ ...current, dossiers: current.dossiers.map((item) => item.id === id ? { ...item, ...patch } : item) }));
  const updateOperation = (id: string, patch: Partial<CommercialOperation>) => setData((current) => ({ ...current, operations: current.operations.map((item) => item.id === id ? { ...item, ...patch } : item) }));
  const updateTariff = (id: string, patch: Partial<Tariff>) => setData((current) => ({ ...current, tariffs: current.tariffs.map((item) => item.id === id ? { ...item, ...patch } : item) }));
  const addDossier = () => setData((current) => ({ ...current, dossiers: [...current.dossiers, { id: uid(), title: "", universe: "", reference: "", status: "En cours", owner: "", action: "", deadline: "", progress: 0, comment: "" }] }));
  const addOperation = () => setData((current) => ({ ...current, operations: [...current.operations, { id: uid(), name: "", month: "", state: "En cours", summary: "", steps: [["Réception de la trame", "À faire"], ["Complétude de la trame", "À faire"], ["Intégration tarif achat", "À faire"], ["Contrôle tarif achat", "À faire"], ["Tarif vente", "À faire"]] }] }));
  const addTariff = () => setData((current) => ({ ...current, tariffs: [...current.tariffs, { id: uid(), code: "", supplier: "", month: "", state: "À préparer", receptionDate: "", dueDate: "", owner: "", comment: "" }] }));
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

  const importTable = (kind: "tariffs" | "jira", text: string) => {
    const parsed = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => line.split(line.includes("\t") ? "\t" : ";").map((cell) => cell.trim())).filter((cells) => cells.length > 1);
    const rows = parsed.filter((cells, index) => !(index === 0 && /(fournisseur|supplier|r[eé]sum[eé]|summary|cl[eé]|ticket)/i.test(cells.join(" "))));
    if (!rows.length) return { count: 0 };
    if (kind === "tariffs") setData((current) => ({ ...current, tariffs: [...current.tariffs, ...rows.map((cells) => ({ id: uid(), code: cells[0] || "", supplier: cells[1] || "", month: cells[2] || "", state: cells[3] || "À préparer", receptionDate: cells[4] || "", dueDate: cells[5] || "", owner: cells[6] || "", comment: cells[7] || "" }))] }));
    else setData((current) => ({ ...current, jira: [...current.jira, ...rows.map((cells) => ({ id: uid(), key: cells[0] || "", summary: cells[1] || "", status: cells[2] || "À qualifier", priority: cells[3] || "Moyenne", assignee: cells[4] || "", lastActivity: cells[5] || "", link: cells[6] || "", comment: cells[7] || "", count: 1 }))] }));
    return { count: rows.length };
  };
  const importJiraSummary = (summary: JiraSummaryImport, selectedPeople: string[]) => {
    const jira = jiraTicketsFromSummary(summary, selectedPeople, marketId);
    if (!jira.length) return { count: 0 };
    const selectedRows = groupJiraPeople(jira);
    const tickets = jira.reduce((sum, item) => sum + jiraItemCount(item), 0);
    setData((current) => ({ ...current, jira }));
    return { count: selectedRows.length, message: `${selectedRows.length} personne${selectedRows.length > 1 ? "s" : ""} · ${tickets} tickets automatiquement rattachés à « ${market.name} ».` };
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
    if (!skipConfirm && view === "edit" && isDirty && !await requestConfirmation({ title: "Charger ce point ?", detail: "Le brouillon non enregistré sera remplacé par le contenu sélectionné.", confirmLabel: "Charger le point", destructive: true })) return;
    const recordMarket = marketOptions.find((item) => item.id === record.marketId) ?? market;
    const nextData = await applyJiraWeek(normalizePointData(record.data, record.marketId, recordMarket), record.marketId);
    setMarketId(record.marketId); setData(nextData); setCalendarMonth(monthStart(nextData.meetingDate)); setActiveRecordId(record.id); setSavedAt(new Date(record.createdAt.replace(" ", "T") + (record.createdAt.includes("Z") ? "" : "Z"))); setLastSavedSignature(pointSignature(record.marketId, nextData)); setSection("general"); setView(nextView); setToast(`${record.year} · S${String(record.week).padStart(2, "0")} chargée.`);
  };
  const chooseWeek = async (value: string) => {
    if (!/^\d{4}-W\d{2}$/.test(value)) return;
    const meetingDate = dateFromWeekInput(value);
    const year = isoWeekYear(meetingDate); const week = isoWeek(meetingDate);
    if (year === currentWeekYear && week === currentWeek) { setCalendarMonth(monthStart(meetingDate)); setCalendarExpanded(false); return; }
    if (view === "edit" && isDirty && !await requestConfirmation({ title: "Changer de semaine ?", detail: "Les modifications du brouillon actuel ne seront pas enregistrées.", confirmLabel: "Changer de semaine", destructive: true })) return;
    setCalendarMonth(monthStart(meetingDate));
    const latest = archive.find((record) => record.year === year && record.week === week);
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
      setData(savedData); setArchive((current) => [saved, ...current.filter((item) => !(item.year === saved.year && item.week === saved.week))].sort((a, b) => b.year - a.year || b.week - a.week)); setActiveRecordId(saved.id); setSavedAt(new Date()); setLastSavedSignature(pointSignature(marketId, savedData)); setArchiveError(""); setToast(`${saved.year} · S${String(saved.week).padStart(2, "0")} enregistrée en ligne.`);
    } catch (error) { setToast(error instanceof Error ? error.message : "Échec de la sauvegarde en ligne."); }
    finally { setSaving(false); }
  };
  useEffect(() => {
    const handleSaveShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase("fr-FR") === "s" && view === "edit" && session.user) {
        event.preventDefault();
        void savePoint();
      }
    };
    window.addEventListener("keydown", handleSaveShortcut);
    return () => window.removeEventListener("keydown", handleSaveShortcut);
  });
  const updateMarketDraft = (id: string, patch: Partial<Market>) => setMarketOptions((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  const createMarket = async () => {
    if (creatingMarket) return;
    setCreatingMarket(true);
    try {
      const index = marketOptions.length + 1;
      const response = await fetch("/api/markets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: `Nouveau marché ${index}`, shortCode: `MARCHÉ-${index}`, tone: themes[index % themes.length].id, colorHex: "" }) });
      const payload = await response.json() as { market?: { id: string; name: string; shortCode: string; tone: ThemeKey; colorHex?: string; position: number; jiraWarningDays: number; jiraCriticalDays: number }; error?: string };
      if (!response.ok || !payload.market) throw new Error(payload.error || "Création impossible.");
      const created: Market = { id: payload.market.id, name: payload.market.name, short: payload.market.shortCode, tone: payload.market.tone, colorHex: normalizeHex(payload.market.colorHex), position: payload.market.position, jiraWarningDays: payload.market.jiraWarningDays, jiraCriticalDays: payload.market.jiraCriticalDays };
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
      const response = await fetch("/api/markets", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, name: draft.name, shortCode: draft.short, tone: draft.tone, colorHex: draft.colorHex, jiraWarningDays: draft.jiraWarningDays, jiraCriticalDays: draft.jiraCriticalDays }) });
      const payload = await response.json() as { market?: { id: string; name: string; shortCode: string; tone: ThemeKey; colorHex?: string; position: number; jiraWarningDays: number; jiraCriticalDays: number }; error?: string };
      if (!response.ok || !payload.market) throw new Error(payload.error || "Modification impossible.");
      const saved: Market = { id: payload.market.id, name: payload.market.name, short: payload.market.shortCode, tone: payload.market.tone, colorHex: normalizeHex(payload.market.colorHex), position: payload.market.position, jiraWarningDays: payload.market.jiraWarningDays, jiraCriticalDays: payload.market.jiraCriticalDays };
      setMarketOptions((current) => current.map((item) => item.id === id ? saved : item));
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
    setDirectoryRevision((current) => current + 1);
    setData((current) => applyDirectoryMail(current, marketId, users));
  };
  const openDirectoryEditor = (user?: GlobalDirectoryUser) => setDirectoryEditor(user
    ? { id: user.id, draft: { name: user.name, email: user.email, usercode: user.usercode, role: user.role, marketIds: [...user.marketIds] } }
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
    } catch { setToast("Copie bloquée : télécharge le fichier HTML."); }
  };

  const navGroups: { label: string; items: { id: Section; label: string; icon: string; count?: number }[] }[] = [
    { label: "Préparer le point", items: [{ id: "general", label: "Cadre du point", icon: "spark" }, { id: "dossiers", label: "Dossiers en cours", icon: "folder", count: data.dossiers.length }, { id: "operations", label: "Opérations commerciales", icon: "trend", count: data.operations.length }, { id: "tariffs", label: "Évolutions tarifaires", icon: "trend", count: data.tariffs.length }, { id: "jira", label: "Tickets Jira", icon: "ticket", count: data.jira.reduce((sum, item) => sum + jiraItemCount(item), 0) }] },
    { label: "Vérifier et diffuser", items: [{ id: "mail", label: "Paramètres du mail", icon: "mail" }, { id: "saved", label: "Historique des points", icon: "download", count: archive.length }] },
    { label: "Paramètres", items: [{ id: "markets", label: "Marchés", icon: "edit", count: marketOptions.length }, { id: "users", label: "Annuaire GLOBAL", icon: "user", count: directoryUsers.length }] },
  ];

  const periodNavigator = <section className={`period-navigator ${view === "edit" ? "edit-period" : "read-period"}`} aria-label={view === "edit" ? "Période d’édition" : "Navigation de lecture"}>
    <div className="period-head">
      <div className="period-title"><span><Icon name={view === "edit" ? "edit" : "eye"} size={15}/> {view === "edit" ? "Point en préparation" : "Point en lecture"}</span><strong>Marché et semaine</strong></div>
      <label className="period-market"><span>Marché</span><select value={marketId} onChange={(event) => { void chooseMarket(event.target.value); }}>{marketOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <div className="period-state"><span>{currentWeekYear} · S{String(currentWeek).padStart(2, "0")}</span><strong>{isDirty ? "Brouillon modifié" : activeRecordId ? "Point enregistré" : "Nouvelle semaine"}</strong><small>{currentWeekPoint ? `Sauvegardé le ${dateLabel(currentWeekPoint.meetingDate)}` : "Aucun point enregistré"}</small></div>
      <button type="button" className={`period-calendar-toggle ${calendarExpanded ? "is-open" : ""}`} aria-expanded={calendarExpanded} onClick={() => setCalendarExpanded((current) => !current)}><Icon name="calendar" size={16}/><span>{calendarExpanded ? "Masquer le calendrier" : "Choisir une semaine"}</span><Icon name="chevron" size={15}/></button>
    </div>
    {calendarExpanded && <div className="visual-week-picker">
      <div className="week-picker-toolbar">
        <div className="month-navigation"><button type="button" aria-label="Mois précédent" onClick={() => setCalendarMonth((current) => shiftMonth(current, -1))}><Icon name="chevron" size={16}/></button><strong>{calendarMonthLabel(calendarMonth)}</strong><button type="button" aria-label="Mois suivant" onClick={() => setCalendarMonth((current) => shiftMonth(current, 1))}><Icon name="chevron" size={16}/></button></div>
        <div className="week-quick-actions"><button type="button" onClick={() => { void chooseCurrentWeek(); }}><Icon name="calendar" size={14}/> Cette semaine</button><button type="button" disabled={!archive.length} onClick={() => { void chooseLatestPublished(); }}><Icon name="check" size={14}/> Dernière publiée</button>{view === "edit" && <button type="button" disabled={!previousPoint} onClick={openCarryover}><Icon name="copy" size={14}/> Reprendre le précédent</button>}</div>
      </div>
      <div className="week-card-strip">{calendarWeeks.map((weekChoice) => { const savedPoint = archive.find((record) => record.year === weekChoice.year && record.week === weekChoice.week); const selected = weekChoice.year === currentWeekYear && weekChoice.week === currentWeek; const today = weekChoice.value === weekInputValue(isoToday()); return <button type="button" className={`week-choice ${selected ? "selected" : ""} ${savedPoint ? "published" : "empty"} ${selected && isDirty ? "draft" : ""}`} aria-pressed={selected} key={weekChoice.value} onClick={() => { void chooseWeek(weekChoice.value); }}><span><i/>{today ? "Cette semaine" : `${weekChoice.year}`}</span><strong>S{String(weekChoice.week).padStart(2, "0")}</strong><small>{weekChoice.range}</small><b>{savedPoint ? "Point enregistré" : "À renseigner"}</b></button>; })}</div>
    </div>}
  </section>;

  const renderEditor = () => <div className="editor-layout"><aside className="editor-nav"><div className="editor-nav-title"><span>Préparation</span><small>Complète puis vérifie ton point</small></div>{navGroups.map((group) => <div className="editor-nav-group" key={group.label}><span>{group.label}</span>{group.items.map((item) => <button key={item.id} className={section === item.id ? "active" : ""} onClick={() => setSection(item.id)}><Icon name={item.icon}/><span>{item.label}</span>{item.count !== undefined && <b>{item.count}</b>}<Icon name="chevron" size={15}/></button>)}</div>)}<div className={`autosave-card ${isDirty ? "is-dirty" : ""}`}><span><Icon name={isDirty ? "edit" : "check"} size={14}/> {isDirty ? "Modifications non enregistrées" : activeRecordId ? "Point enregistré" : "Brouillon prêt"}</span><small>{archiveLoading ? "Chargement de l’historique…" : activeRecordId ? `Dernière sauvegarde${savedAt ? ` · ${savedAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : ""}` : "La première sauvegarde créera ce point"}</small></div></aside><main className="editor-content">
    {section === "general" && <section className="editor-section">
      <SectionTitle eyebrow="01 · Cadre" title="Préparer le point" detail="Le marché et la semaine se choisissent dans le calendrier général ci-dessus."/>
      <div className="surface form-grid general-grid">
        <div className="point-context-summary field-wide"><span><Icon name="calendar" size={16}/> Point sélectionné</span><strong>{market.name}</strong><b>{currentWeekYear} · S{String(currentWeek).padStart(2, "0")} · {dateLabel(data.meetingDate)}</b></div>
        <div className="field field-wide theme-field"><span>Couleur de ce point</span><div className="theme-picker">{themes.map((option) => <button key={option.id} type="button" className={!data.customColor && data.themeColor === option.id ? "active" : ""} style={{ "--swatch": option.accent } as CSSProperties} onClick={() => setData((current) => ({ ...current, themeColor: option.id, customColor: "" }))}><i/><b>{option.label}</b></button>)}</div><div className="hex-color-control"><input type="color" value={accent} aria-label="Sélecteur de couleur personnalisée" onChange={(event) => setData((current) => ({ ...current, customColor: event.target.value.toUpperCase() }))}/><label><span>Hexadécimal personnalisé</span><input value={data.customColor} maxLength={7} placeholder={theme.accent.toUpperCase()} onChange={(event) => setData((current) => ({ ...current, customColor: event.target.value.toUpperCase() }))}/></label><small className={data.customColor && !validHex(data.customColor) ? "invalid" : ""}>{data.customColor && !validHex(data.customColor) ? "Format attendu : #RRGGBB" : `Couleur active : ${accent.toUpperCase()}`}</small></div></div>
        <label className="field field-wide"><span>Priorité de la semaine</span><textarea value={data.priority} onChange={(event) => setData((current) => ({ ...current, priority: event.target.value }))} placeholder="L’action principale ou le message clé à retenir…"/></label>
      </div>
      <div className="guidance-grid"><article><span>01</span><strong>Choisis le bon marché</strong><p>Les noms et codes sont administrables dans « Gérer les marchés ».</p></article><article><span>02</span><strong>Reprends les suivis utiles</strong><p>Les dossiers et opérations non terminés du dernier point peuvent être reconduits sans doublon.</p></article><article><span>03</span><strong>Sauvegarde et diffuse</strong><p>Les destinataires et tickets Jira sont préparés depuis l’annuaire GLOBAL.</p></article></div>
    </section>}

    {section === "markets" && <section className="editor-section"><SectionTitle eyebrow="02 · Administration" title="Gérer les marchés" detail="Modifie le nom affiché, le code court et la couleur par défaut, ou ajoute un nouveau marché." action={<button className="primary-button" disabled={creatingMarket} onClick={createMarket}><Icon name="plus"/> {creatingMarket ? "Ajout…" : "Ajouter un marché"}</button>}/><div className="market-admin-note"><Icon name="alert"/><div><strong>Suppression sans perte d’historique</strong><span>Un marché supprimé disparaît de la liste active, mais ses points hebdomadaires restent conservés.</span></div></div><div className="market-admin-list">{marketOptions.map((item, index) => { const marketAccent = normalizeHex(item.colorHex) || themes.find((option) => option.id === item.tone)?.accent || themes[0].accent; return <article className={`surface market-admin-card ${item.id === marketId ? "active" : ""}`} key={item.id}><div className="market-admin-index" style={{ "--swatch": marketAccent } as CSSProperties}><i/><span>{String(index + 1).padStart(2, "0")}</span></div><div className="market-admin-fields"><TextField label="Nom du marché" value={item.name} onChange={(name) => updateMarketDraft(item.id, { name })}/><TextField label="Code court" value={item.short} onChange={(short) => updateMarketDraft(item.id, { short })} placeholder="EX. BOIS"/><label className="field"><span>Palette par défaut</span><select value={item.tone} onChange={(event) => updateMarketDraft(item.id, { tone: event.target.value as ThemeKey, colorHex: "" })}>{themes.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label><label className="field market-hex-field"><span>Hex personnalisé</span><div><input type="color" value={marketAccent} aria-label={`Couleur de ${item.name}`} onChange={(event) => updateMarketDraft(item.id, { colorHex: event.target.value.toUpperCase() })}/><input value={item.colorHex} maxLength={7} placeholder="#RRGGBB" onChange={(event) => updateMarketDraft(item.id, { colorHex: event.target.value.toUpperCase() })}/></div></label></div><div className="market-admin-actions">{item.id === marketId && <span>Marché actif</span>}<button className="secondary-button" disabled={Boolean(marketSavingId)} onClick={() => saveMarket(item.id)}><Icon name="check"/> {marketSavingId === item.id ? "Enregistrement…" : "Enregistrer"}</button><button className="icon-button danger" disabled={Boolean(marketSavingId)} aria-label={`Supprimer ${item.name}`} title="Supprimer de la liste active" onClick={() => deleteMarket(item.id)}><Icon name="trash"/></button></div></article>; })}</div></section>}

    {section === "users" && <section className="editor-section">
      <SectionTitle eyebrow="Paramètres · Annuaire interne" title="Utilisateurs GLOBAL" detail="Une ligne résume chaque personne ; ouvre-la uniquement lorsque tu veux la modifier." action={<button className="primary-button" type="button" onClick={() => openDirectoryEditor()}><Icon name="plus"/> Ajouter une personne</button>}/>
      <div className="directory-rule-grid"><article><Icon name="ticket"/><div><strong>Jira réservé aux chefs</strong><span>Seuls les chefs de produit et chefs de marché sont inclus dans la requête et l’import Jira.</span></div></article><article><Icon name="mail"/><div><strong>Destinataires du mail</strong><span>Chefs, analystes du marché et manager Tarif sont ajoutés dans les destinataires principaux.</span></div></article><article><Icon name="lock"/><div><strong>Connexion simple</strong><span>L’édition reste protégée par le compte interne GLOBAL partagé, sans comptes individuels.</span></div></article></div>
      {!directoryReady ? <div className="archive-message"><span>Chargement de l’annuaire GLOBAL…</span></div> : directoryUsers.length ? <div className="surface directory-table"><div className="directory-table-head"><span>Personne</span><span>Rôle</span><span>Marché</span><span>Automatisations</span><span/></div>{directoryUsers.map((user) => <button type="button" className="directory-row" key={user.id} onClick={() => openDirectoryEditor(user)}><span className="directory-person"><i className="directory-avatar">{user.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</i><span><strong>{user.name || "Utilisateur GLOBAL"}</strong><small>{user.email}</small></span></span><span className="directory-role">{roleLabel(user.role)}</span><span className="directory-market">{user.marketIds[0] ? marketOptions.find((item) => item.id === user.marketIds[0])?.name ?? "Marché lié" : user.role === "manager-tarif" ? "Tous les marchés" : "Non associé"}</span><span className="directory-automation-badges">{roleUsesAutomaticJira(user.role) && <span className="jira">Jira</span>}{roleMailMode(user.role) === "to" && <span className="mail">Mail À</span>}{roleMailMode(user.role) === "none" && <span>En réserve</span>}</span><Icon name="chevron" size={16}/></button>)}</div> : <div className="surface archive-empty"><Icon name="user" size={28}/><strong>Annuaire GLOBAL vide</strong><span>Ajoute une première personne. Les exemples John DOE ne sont jamais enregistrés automatiquement.</span><button className="primary-button" type="button" onClick={() => openDirectoryEditor()}><Icon name="plus"/> Ajouter une personne</button></div>}
    </section>}

    {section === "dossiers" && <section className="editor-section">
      <SectionTitle eyebrow="02 · Suivi détaillé" title="Dossiers en cours" detail="La zone la plus détaillée du point : contexte, responsable, action et risque." action={<div className="title-actions">{previousPoint && <button className="secondary-button" onClick={openCarryover}><Icon name="copy"/> Reprendre le précédent</button>}<button className="primary-button" onClick={addDossier}><Icon name="plus"/> Ajouter un dossier</button></div>}/>
      {data.dossiers.length ? <div className="record-stack">{data.dossiers.map((item, index) => <article className="surface record-card" key={item.id}>
        <div className="record-header"><span className="record-index">{String(index + 1).padStart(2, "0")}</span><div><strong>{item.title || "Nouveau dossier"}</strong><small>{item.status}{carriedFromLabel(item) ? ` · ${carriedFromLabel(item)}` : ""}</small></div><button className="icon-button danger" aria-label="Supprimer le dossier" onClick={() => setData((current) => ({ ...current, dossiers: current.dossiers.filter((row) => row.id !== item.id) }))}><Icon name="trash"/></button></div>
        <div className="form-grid"><TextField label="Dossier" value={item.title} onChange={(title) => updateDossier(item.id, { title })} placeholder="Nom du dossier"/><TextField label="Univers" value={item.universe} onChange={(universe) => updateDossier(item.id, { universe })}/><TextField label="Référence" value={item.reference} onChange={(reference) => updateDossier(item.id, { reference })}/><SelectField label="Statut" value={item.status} onChange={(status) => updateDossier(item.id, { status })} options={statusOptions}/><TextField label="Responsable" value={item.owner} onChange={(owner) => updateDossier(item.id, { owner })}/><TextField label="Échéance" type="date" value={item.deadline} onChange={(deadline) => updateDossier(item.id, { deadline })}/><label className="field field-wide"><span>Prochaine action</span><textarea value={item.action} onChange={(event) => updateDossier(item.id, { action: event.target.value })}/></label><label className="field field-wide"><span>Commentaire / risque</span><textarea value={item.comment} onChange={(event) => updateDossier(item.id, { comment: event.target.value })}/></label><label className="field progress-field field-wide"><span><b>Avancement</b><strong>{item.progress}%</strong></span><input type="range" min="0" max="100" step="5" value={item.progress} onChange={(event) => updateDossier(item.id, { progress: Number(event.target.value) })}/></label></div>
      </article>)}</div> : <EmptyState label="un dossier" onAdd={addDossier}/>}</section>}

    {section === "operations" && <section className="editor-section">
      <SectionTitle eyebrow="03 · Promo" title="Opérations commerciales" detail="Suis chaque opération commerciale (promo), son mois, son état global et ses étapes de traitement." action={<div className="title-actions">{previousPoint && <button className="secondary-button" onClick={openCarryover}><Icon name="copy"/> Reprendre le précédent</button>}<button className="primary-button" onClick={addOperation}><Icon name="plus"/> Ajouter une opération</button></div>}/>
      {data.operations.length ? <div className="record-stack">{data.operations.map((item, index) => <article className="surface record-card" key={item.id}>
        <div className="record-header"><span className="record-index letter">{String.fromCharCode(65 + index)}</span><div><strong>{item.name || "Nouvelle opération commerciale"}</strong><small>{item.month || "Mois à définir"}{carriedFromLabel(item) ? ` · ${carriedFromLabel(item)}` : ""}</small></div><button className="icon-button danger" aria-label="Supprimer l’opération commerciale" onClick={() => setData((current) => ({ ...current, operations: current.operations.filter((row) => row.id !== item.id) }))}><Icon name="trash"/></button></div>
        <div className="form-grid"><TextField label="Nom de l’opération commerciale" value={item.name} onChange={(name) => updateOperation(item.id, { name })}/><TextField label="Mois affiché" value={item.month} onChange={(month) => updateOperation(item.id, { month })} placeholder="Septembre 2026"/><TextField label="État global" value={item.state} onChange={(state) => updateOperation(item.id, { state })} wide/><TextField label="Résumé" value={item.summary} onChange={(summary) => updateOperation(item.id, { summary })} wide/><div className="steps-editor field-wide"><span>Étapes de traitement</span>{item.steps.map(([label, state], stepIndex) => <div className="step-editor" key={`${item.id}-${stepIndex}`}><input value={label} onChange={(event) => updateOperation(item.id, { steps: item.steps.map((step, i) => i === stepIndex ? [event.target.value, step[1]] as [string,string] : step) })}/><select value={state} onChange={(event) => updateOperation(item.id, { steps: item.steps.map((step, i) => i === stepIndex ? [step[0], event.target.value] as [string,string] : step) })}>{stepOptions.map((option) => <option key={option}>{option}</option>)}</select><button className="icon-button subtle" aria-label="Supprimer l’étape" onClick={() => updateOperation(item.id, { steps: item.steps.filter((_, i) => i !== stepIndex) })}><Icon name="trash" size={15}/></button></div>)}<button className="inline-add" onClick={() => updateOperation(item.id, { steps: [...item.steps, ["Nouvelle étape", "À faire"]] })}><Icon name="plus" size={15}/> Ajouter une étape</button></div></div>
      </article>)}</div> : <EmptyState label="une opération commerciale" onAdd={addOperation}/>}</section>}

    {section === "tariffs" && <section className="editor-section"><SectionTitle eyebrow="04 · Extraction manuelle" title="Évolutions tarifaires" detail="Colle directement ton extraction ou complète les lignes à la main." action={<div className="title-actions"><PasteImporter kind="tariffs" onImport={(text) => importTable("tariffs", text)}/><button className="primary-button" onClick={addTariff}><Icon name="plus"/> Ajouter</button></div>}/><div className="surface data-table-wrap"><table className="data-table"><thead><tr><th>Code</th><th>Fournisseur</th><th>Mois</th><th>État</th><th>Réception trame</th><th>Responsable</th><th>Commentaire</th><th/></tr></thead><tbody>{data.tariffs.map((item) => <tr key={item.id}><td><input value={item.code} onChange={(e) => updateTariff(item.id, { code: e.target.value })}/></td><td><input value={item.supplier} onChange={(e) => updateTariff(item.id, { supplier: e.target.value })}/></td><td><input value={item.month} onChange={(e) => updateTariff(item.id, { month: e.target.value })}/></td><td><input value={item.state} onChange={(e) => updateTariff(item.id, { state: e.target.value })}/></td><td><input type="date" value={item.receptionDate} onChange={(e) => updateTariff(item.id, { receptionDate: e.target.value })}/></td><td><input value={item.owner} onChange={(e) => updateTariff(item.id, { owner: e.target.value })}/></td><td><input value={item.comment} onChange={(e) => updateTariff(item.id, { comment: e.target.value })}/></td><td><button className="icon-button subtle" aria-label="Supprimer" onClick={() => setData((current) => ({ ...current, tariffs: current.tariffs.filter((row) => row.id !== item.id) }))}><Icon name="trash" size={15}/></button></td></tr>)}</tbody></table>{!data.tariffs.length && <div className="table-empty">Aucune évolution tarifaire. Utilise « Coller un tableau » ou « Ajouter ».</div>}</div><div className="rule-note"><Icon name="alert"/><div><strong>Vigilances automatiques</strong><span>Du 8 au 14 : trame à sécuriser · après le 15 : KO sans trame · trame reçue depuis plus de 5 jours : traitement à contrôler.</span></div></div></section>}

    {section === "jira" && <section className="editor-section">
      <SectionTitle eyebrow="05 · Activité Jira" title="Tickets ouverts du marché" detail={`La requête utilise uniquement les USERCODE des chefs de produit et chefs de marché de ${market.name}. Seules les personnes ayant des tickets apparaissent.`} action={<div className="title-actions"><JiraPasteImporter key={`${currentWeekYear}-${currentWeek}-${marketId}-${directoryRevision}`} marketId={marketId} marketName={market.name} directoryUsers={directoryUsers} year={currentWeekYear} week={currentWeek} onImport={importJiraSummary}/><button className="primary-button" onClick={addJira}><Icon name="plus"/> Ajouter une synthèse</button></div>}/>
      <div className="jira-import-note"><Icon name="ticket"/><div><strong>Rattachement automatique par USERCODE et par rôle</strong><span>Aucun préfixe de ticket n’est utilisé. Le marché et le rôle enregistrés dans l’annuaire sont les seules sources d’affectation.</span></div></div>
      <JiraVolumePulse data={data} archive={archive} market={market}/>
      <div className="surface jira-alert-settings"><div><span><Icon name="alert" size={16}/> Alertes sur la dernière modification</span><strong>Seuils propres à {market.name}</strong><small>Ces repères signalent une absence d’activité ; ils ne mesurent pas le temps de résolution.</small></div><label><span>À surveiller après</span><div><input type="number" min="1" max="364" value={market.jiraWarningDays} onChange={(event) => { const warning = Math.max(1, Math.min(364, Number(event.target.value) || 1)); updateMarketDraft(marketId, { jiraWarningDays: warning, jiraCriticalDays: Math.max(warning + 1, market.jiraCriticalDays) }); }}/><b>jours</b></div></label><label><span>Critique après</span><div><input type="number" min={market.jiraWarningDays + 1} max="365" value={market.jiraCriticalDays} onChange={(event) => updateMarketDraft(marketId, { jiraCriticalDays: Math.max(market.jiraWarningDays + 1, Math.min(365, Number(event.target.value) || market.jiraWarningDays + 1)) })}/><b>jours</b></div></label><button className="secondary-button" disabled={Boolean(marketSavingId)} onClick={() => saveMarket(marketId)}><Icon name="check" size={15}/> {marketSavingId === marketId ? "Enregistrement…" : "Enregistrer les seuils"}</button></div>
      <div className="surface data-table-wrap jira-summary-wrap"><table className="data-table jira-person-table"><thead><tr><th>Personne</th>{JIRA_SUMMARY_STATUSES.map((status) => <th key={status}>{status}</th>)}<th>Total</th><th/></tr></thead><tbody>{jiraPeople.map((person) => <tr key={person.assignee}><th scope="row"><input value={person.assignee} aria-label={`Personne ${person.assignee}`} onChange={(event) => renameJiraPerson(person.assignee, event.target.value)}/></th>{JIRA_SUMMARY_STATUSES.map((status) => { const statusItems = person.items.filter((item) => item.status === status); const count = statusItems.reduce((sum, item) => sum + jiraItemCount(item), 0); const link = statusItems.find((item) => item.link)?.link; return <td key={status}><div className="jira-count-cell"><input type="number" min="0" value={count} aria-label={`${status} pour ${person.assignee}`} onChange={(event) => setJiraPersonCount(person.assignee, status, Number(event.target.value))}/>{link && <a href={link} target="_blank" rel="noreferrer" title={`Ouvrir le filtre « ${status} »`} aria-label={`Ouvrir le filtre ${status} de ${person.assignee}`}>↗</a>}</div></td>; })}<td className="jira-person-total"><strong>{person.total}</strong><small>{jiraStatusSummary(person.items)}</small></td><td><button className="icon-button subtle" aria-label={`Supprimer ${person.assignee}`} onClick={() => removeJiraPerson(person.assignee)}><Icon name="trash" size={15}/></button></td></tr>)}</tbody></table>{!jiraPeople.length && <div className="table-empty">Aucun ticket Jira. Importe le tableau complet ou ajoute une personne.</div>}</div>
      {jiraActivityRows.length > 0 && <div className="surface data-table-wrap jira-ticket-detail-wrap"><div className="jira-detail-heading"><div><span>Détail des tickets</span><strong>Priorité visuelle par dernière modification</strong></div><small>Création affichée à titre de contexte uniquement.</small></div><table className="data-table jira-ticket-table"><thead><tr><th>Ticket</th><th>État</th><th>Résumé</th><th>Personne</th><th>Création</th><th>Dernière modification</th><th>Signal</th></tr></thead><tbody>{jiraActivityRows.map(({ item, inactivity }) => { const signal = inactivity === null ? "neutral" : inactivity >= market.jiraCriticalDays ? "critical" : inactivity >= market.jiraWarningDays ? "warning" : "fresh"; return <tr id={`jira-${item.id}`} className={`jira-ticket-${signal}`} key={item.id}><td>{item.link ? <a href={item.link} target="_blank" rel="noreferrer">{item.key} ↗</a> : <strong>{item.key}</strong>}{item.internalId && <small>ID {item.internalId}</small>}</td><td><span className={`report-pill tone-${toneForStatus(item.status)}`}>{item.status}</span></td><td><strong>{item.summary || "Sans résumé"}</strong></td><td><strong>{item.assignee || "Non assigné"}</strong>{item.assigneeUserCode && <small>{item.assigneeUserCode}</small>}</td><td>{item.createdAt ? dateLabel(item.createdAt.slice(0, 10)) : "—"}</td><td>{item.lastActivity ? dateLabel(item.lastActivity.slice(0, 10)) : "—"}</td><td><span className={`jira-activity-signal ${signal}`}>{inactivity === null ? "Non daté" : inactivity === 0 ? "Aujourd’hui" : `${inactivity} j sans activité`}</span></td></tr>; })}</tbody></table></div>}
    </section>}

    {section === "saved" && <section className="editor-section"><SectionTitle eyebrow="Historique" title="Points enregistrés" detail="Un seul point est conservé par marché et par semaine. Le bouton permanent de l’en-tête enregistre la semaine active."/><div className="surface version-summary"><div className="version-week"><span>Semaine active</span><strong>{currentWeekYear} · S{String(currentWeek).padStart(2, "0")}</strong><small>{currentWeekPoint ? `Point enregistré le ${new Date(currentWeekPoint.createdAt.replace(" ", "T") + (currentWeekPoint.createdAt.includes("Z") ? "" : "Z")).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}` : "Aucun point enregistré pour cette semaine"}</small></div><div className="version-next"><span>Sauvegarde</span><strong>{currentWeekPoint ? "Mise à jour" : "Création"}</strong><small>{currentWeekPoint ? "La sauvegarde remplace le contenu enregistré pour cette semaine." : "La première sauvegarde créera le point de cette semaine."} · Raccourci Ctrl/Cmd + S.</small></div><div className="version-actions"><button className="secondary-button" onClick={() => fileInput.current?.click()}><Icon name="upload"/> Importer JSON</button><button className="secondary-button" onClick={() => exportJson()}><Icon name="download"/> Exporter le brouillon</button></div></div>{archiveError && <div className="archive-message error"><Icon name="alert"/><span>{archiveError}</span></div>}{archiveLoading ? <div className="archive-message"><span>Chargement des points enregistrés…</span></div> : archive.length ? <div className="archive-list">{archive.map((record) => <article className={`surface archive-row ${activeRecordId === record.id && !isDirty ? "active" : ""}`} key={record.id}><div className="archive-version"><span>{record.year}</span><strong>S{String(record.week).padStart(2, "0")}</strong><small>ISO</small></div><div className="archive-copy"><span>{market.name}</span><strong>{dateLabel(record.meetingDate)}</strong><small>Enregistré le {new Date(record.createdAt.replace(" ", "T") + (record.createdAt.includes("Z") ? "" : "Z")).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</small></div><div className="archive-actions"><button className="secondary-button" onClick={() => exportJson(record)}><Icon name="download"/> JSON</button><button className="primary-button" onClick={() => loadRecord(record)}><Icon name="upload"/> Charger</button></div></article>)}</div> : !archiveError && <div className="surface archive-empty"><Icon name="download" size={28}/><strong>Aucun point enregistré</strong><span>Sauvegarde le premier point hebdomadaire de ce marché.</span></div>}</section>}

    {section === "mail" && <section className="editor-section">
      <SectionTitle eyebrow="07 · Diffusion" title="Paramètres du mail" detail="L’annuaire prépare les destinataires ; tu peux conserver des adresses manuelles en complément." action={<button className="secondary-button" onClick={() => setData((current) => applyDirectoryMail(current, marketId, directoryUsers))}><Icon name="user"/> Actualiser depuis l’annuaire</button>}/>
      <div className="mail-automation-grid">
        <article><span><Icon name="mail" size={15}/> Équipe du marché</span><strong>{automaticMarketMailUsers.length ? automaticMarketMailUsers.map((user) => user.name).join(" · ") : "Aucun destinataire configuré"}</strong><small>Chefs et analystes rattachés à {market.name}.</small></article>
        <article><span><Icon name="user" size={15}/> Manager Tarif</span><strong>{automaticTariffManager?.name ?? "Manager Tarif non renseigné"}</strong><small>Ajouté comme destinataire principal pour tous les marchés, et non imposé en copie.</small></article>
      </div>
      <div className="surface form-grid mail-settings"><TextField label="Destinataires" value={data.mail.to} onChange={(to) => setData((current) => ({ ...current, mail: { ...current.mail, to } }))} wide/><TextField label="Copie" value={data.mail.cc} onChange={(cc) => setData((current) => ({ ...current, mail: { ...current.mail, cc } }))} wide/><TextField label="Objet" value={data.mail.subject} onChange={(subject) => setData((current) => ({ ...current, mail: { ...current.mail, subject } }))} wide/><label className="field field-wide"><span>Introduction</span><textarea value={data.mail.intro} onChange={(event) => setData((current) => ({ ...current, mail: { ...current.mail, intro: event.target.value } }))}/></label></div><button className="primary-button mail-next" onClick={() => setView("mail")}><Icon name="mail"/> Vérifier le mail</button>
    </section>}
  </main></div>;

  return <div className={`app-shell market-${market.tone}`} style={themeStyle}><div className="ambient ambient-a"/><div className="ambient ambient-b"/>
    <header className="app-header">
      <a className="brand" href="#top"><span className="brand-mark"><Icon name="spark" size={19}/></span><div><strong>Market Pulse</strong><small>Générateur de point marché</small></div></a>
      <nav className="view-tabs" aria-label="Mode d’affichage"><button className={view === "read" ? "active" : ""} onClick={() => chooseView("read")}><Icon name="eye"/> Lecture</button><button className={view === "edit" ? "active" : ""} onClick={() => chooseView("edit")}><Icon name={session.user ? "edit" : "lock"}/> Préparation</button><button className={view === "mail" ? "active" : ""} onClick={() => chooseView("mail")}><Icon name="mail"/> Aperçu mail</button></nav>
      <div className="header-actions">
        <input ref={fileInput} className="sr-only" type="file" accept="application/json" onChange={importJson}/>
        {session.user && view === "edit" && <><details className="header-more"><summary className="icon-button" aria-label="Autres actions" title="Autres actions"><Icon name="more"/></summary><div><button type="button" onClick={() => { fileInput.current?.click(); }}><Icon name="upload"/> Importer un JSON</button><button type="button" onClick={() => exportJson()}><Icon name="download"/> Exporter le brouillon</button><button type="button" className="danger" onClick={() => { void resetPoint(); }}><Icon name="plus"/> Réinitialiser la semaine</button></div></details><button className={`primary-button save-point ${isDirty ? "has-changes" : ""}`} disabled={saving || !ready || (!isDirty && Boolean(activeRecordId))} onClick={savePoint}><Icon name="check"/> {saving ? "Enregistrement…" : isDirty ? "Sauvegarder" : activeRecordId ? "Enregistré" : "Créer le point"}</button></>}
        {!session.user && <button className="login-button" disabled={!sessionReady} onClick={openLogin}><Icon name="lock"/> {sessionReady ? "Connexion édition" : "Vérification…"}</button>}
        {session.user && <div className="editor-profile"><span><Icon name="user" size={15}/></span><div><strong>{session.user.displayName}</strong><small>{session.user.username}</small></div><button onClick={logout}>Déconnexion</button></div>}
      </div>
    </header>
    <div id="top" className="top-strip"><span className="live-dot"/><strong>{market.short}</strong><i/>{isoWeekYear(data.meetingDate)} · S{String(isoWeek(data.meetingDate)).padStart(2, "0")}<i/>{dateLabel(data.meetingDate)}<i/>{isDirty ? "Brouillon" : activeRecordId ? "Enregistré" : "Non enregistré"}<b>{alerts.length ? `${alerts.length} vigilance${alerts.length > 1 ? "s" : ""}` : "Aucune vigilance"}</b></div>
    {view !== "mail" && periodNavigator}
    {view === "edit" && session.user && renderEditor()}
    {view === "read" && <main className="preview-page"><div className="preview-toolbar"><div><span>Lecture générale</span><strong>Choisis le marché et la semaine dans le calendrier ci-dessus.</strong></div><button className="secondary-button" onClick={() => chooseView("edit")}><Icon name={session.user ? "edit" : "lock"}/> {session.user ? "Modifier ce point" : "Connexion GLOBAL pour modifier"}</button></div>{!activeRecordId && <div className="reader-empty-banner"><Icon name="calendar"/><div><strong>Aucun point enregistré pour cette sélection</strong><span>{session.user ? "Tu peux préparer puis sauvegarder le point de cette semaine." : "Aucun brouillon n’est affiché publiquement. Connecte-toi pour préparer cette semaine."}</span></div></div>}{(activeRecordId || session.user) ? <PreviewDashboard data={data} market={market} archive={archive}/> : <div className="surface reader-empty-state"><span className="login-emblem"><Icon name="calendar" size={24}/></span><strong>Cette semaine n’a pas encore de point publié</strong><p>Sélectionne une autre semaine enregistrée ou connecte-toi pour la préparer.</p></div>}</main>}
    {view === "mail" && <main className="mail-page"><div className="mail-toolbar"><div><span>Aperçu Outlook</span><strong>Statique, responsive et sans script.</strong><small>{data.mail.to ? `À : ${data.mail.to}` : "Destinataires à compléter dans Paramètres du mail"}</small></div><div><button className="secondary-button" onClick={() => { setSection("mail"); chooseView("edit"); }}><Icon name={session.user ? "edit" : "lock"}/> Paramètres</button><button className="secondary-button" onClick={() => download(`point-marche-mail-${marketId}-${data.meetingDate}.html`, mailHtml, "text/html;charset=utf-8")}><Icon name="download"/> Télécharger HTML</button><button className="primary-button" onClick={copyMail}><Icon name="copy"/> Copier pour Outlook</button></div></div><div className="mail-frame-wrap"><iframe title="Aperçu du mail Outlook" srcDoc={mailHtml}/></div></main>}
    {directoryDraft && <AppDialog open={Boolean(directoryEditor)} onClose={() => { if (!directorySavingId) setDirectoryEditor(null); }} busy={Boolean(directorySavingId)} labelledBy="directory-dialog-title" className="directory-dialog">
      <div className="dialog-heading"><span className="login-emblem"><Icon name="user" size={22}/></span><div><span>Annuaire GLOBAL</span><h2 id="directory-dialog-title">{directoryEditor?.id === "new" ? "Ajouter une personne" : `Modifier ${directoryDraft.name}`}</h2><p>Le rôle détermine automatiquement Jira et les destinataires du mail.</p></div></div>
      <form className="directory-dialog-form" onSubmit={(event) => { event.preventDefault(); if (directoryEditor?.id === "new") void createDirectoryUser(); else if (directoryEditor) void saveDirectoryUser(directoryEditor.id); }}>
        <div className="directory-fields"><TextField label="Nom complet" value={directoryDraft.name} onChange={(name) => updateDirectoryDraft({ name })} placeholder="John DOE"/><TextField label="Adresse e-mail" type="email" value={directoryDraft.email} onChange={(email) => updateDirectoryDraft({ email })} placeholder="person@example.test"/><label className="field"><span>Rôle</span><select value={directoryDraft.role} onChange={(event) => { const role = event.target.value as GlobalRole; updateDirectoryDraft({ role, marketIds: role === "manager-tarif" ? [] : directoryDraft.marketIds }); }}>{GLOBAL_ROLE_OPTIONS.map((role) => <option key={role.id} value={role.id}>{role.label}</option>)}</select></label><TextField label={`USERCODE Jira${roleUsesAutomaticJira(directoryDraft.role) ? " · requis" : " · facultatif"}`} value={directoryDraft.usercode} onChange={(usercode) => updateDirectoryDraft({ usercode: usercode.toUpperCase() })} placeholder="J1234567"/></div>
        {directoryDraft.role !== "manager-tarif" ? <label className="directory-market-select"><span>Marché de la personne{directoryDraftNeedsMarket ? " · requis" : ""}</span><select value={directoryDraft.marketIds[0] ?? ""} onChange={(event) => updateDirectoryDraft({ marketIds: event.target.value ? [event.target.value] : [] })}><option value="">Sélectionner un marché…</option>{marketOptions.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select><small>Le lien utilise l’identifiant du marché : un changement de nom ne le casse pas.</small></label> : <div className="directory-manager-note"><Icon name="mail" size={15}/> Manager Tarif unique · destinataire principal de tous les mails</div>}
        <div className="directory-dialog-automation"><span className={roleUsesAutomaticJira(directoryDraft.role) ? "is-on" : ""}><Icon name="ticket" size={15}/> {roleUsesAutomaticJira(directoryDraft.role) ? "Inclus dans Jira" : "Exclu de Jira"}</span><span className={roleMailMode(directoryDraft.role) === "to" ? "is-on" : ""}><Icon name="mail" size={15}/> {roleMailMode(directoryDraft.role) === "to" ? "Destinataire du mail" : "Sans mail automatique"}</span></div>
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
    <AppDialog open={loginOpen} onClose={() => { if (!loginLoading) setLoginOpen(false); }} busy={loginLoading} labelledBy="login-title" className="login-dialog"><span className="login-emblem"><Icon name="lock" size={22}/></span><div className="login-heading"><span>Accès aux modifications</span><h2 id="login-title">Connexion GLOBAL</h2><p>La lecture reste accessible. Connecte-toi pour modifier et sauvegarder les points marché.</p></div><form onSubmit={submitLogin}><label><span>Compte</span><input data-autofocus autoComplete="username" value={loginUsername} onChange={(event) => setLoginUsername(event.target.value)} /></label><label><span>Mot de passe</span><input type="password" autoComplete="current-password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} /></label>{loginError && <div className="login-error"><Icon name="alert" size={15}/>{loginError}</div>}<button className="primary-button login-submit" type="submit" disabled={loginLoading || !loginUsername || !loginPassword}><Icon name="lock"/> {loginLoading ? "Connexion…" : "Se connecter"}</button></form><small className="login-session-note">La session d’édition reste active pendant 12 heures sur cet appareil.</small></AppDialog>
    {confirmRequest && <AppDialog open onClose={() => settleConfirmation(false)} labelledBy="confirm-dialog-title" className="confirm-dialog"><span className={`confirm-emblem ${confirmRequest.destructive ? "danger" : ""}`}><Icon name={confirmRequest.destructive ? "alert" : "check"} size={22}/></span><div className="login-heading"><span>Confirmation</span><h2 id="confirm-dialog-title">{confirmRequest.title}</h2><p>{confirmRequest.detail}</p></div><div className="confirm-actions"><button className="secondary-button" type="button" onClick={() => settleConfirmation(false)}>Annuler</button><button className={`primary-button ${confirmRequest.destructive ? "danger-button-solid" : ""}`} type="button" onClick={() => settleConfirmation(true)}>{confirmRequest.confirmLabel}</button></div></AppDialog>}
    {toast && <div className="toast"><Icon name="check"/>{toast}</div>}
  </div>;
}
