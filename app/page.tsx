"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { GLOBAL_ROLE_OPTIONS, roleLabel, roleMailMode, type GlobalDirectoryUser, type GlobalRole } from "../lib/global-directory";
import { JIRA_SUMMARY_STATUSES, parseJiraAssigneeSummary, type JiraSummaryImport } from "../lib/jira-import";

type Tone = "mint" | "violet" | "aqua" | "peach" | "red";
type View = "read" | "edit" | "mail";
type Section = "general" | "dossiers" | "operations" | "tariffs" | "jira" | "saved" | "markets" | "users" | "mail";
type CarryoverFields = { sourceId?: string; carriedFromYear?: number; carriedFromWeek?: number };
type Dossier = { id: string; title: string; universe: string; reference: string; status: string; owner: string; action: string; deadline: string; progress: number; comment: string } & CarryoverFields;
type CommercialOperation = { id: string; name: string; month: string; state: string; summary: string; steps: [string, string][] } & CarryoverFields;
type Tariff = { id: string; code: string; supplier: string; month: string; state: string; receptionDate: string; dueDate: string; owner: string; comment: string };
type JiraTicket = { id: string; key: string; summary: string; status: string; priority: string; assignee: string; lastActivity: string; link: string; comment: string; count?: number };
type PointData = { pointName: string; themeColor: ThemeKey; customColor: string; meetingDate: string; priority: string; dossiers: Dossier[]; operations: CommercialOperation[]; tariffs: Tariff[]; jira: JiraTicket[]; mail: { to: string; cc: string; subject: string; intro: string; autoTo?: string[]; autoCc?: string[] } };
type AlertItem = { title: string; detail: string; severity: "warning" | "danger" };
type ThemeKey = "mint" | "violet" | "aqua" | "peach" | "red";
type Market = { id: string; name: string; short: string; tone: ThemeKey; colorHex: string; position: number };
type PointRecord = { id: string; marketId: string; year: number; week: number; meetingDate: string; pointName: string; themeColor: ThemeKey; data: PointData; createdAt: string };
type ImportOutcome = { count: number; message?: string };
type JiraPersonGroup = { assignee: string; items: JiraTicket[]; total: number };
type JiraWeekPayload = { snapshot: { year: number; week: number; rawText: string; summary: JiraSummaryImport; updatedAt: string } | null; assignments: Record<string, string[]>; error?: string };
type SessionPayload = { user: { displayName: string; username: string } | null };
type DirectoryDraft = { name: string; email: string; jiraName: string; role: GlobalRole; marketIds: string[] };

const defaultMarkets: Market[] = [
  { id: "revetements-menuiserie", name: "Revêtements & Menuiserie", short: "REV–MEN", tone: "mint", colorHex: "", position: 0 },
  { id: "bois-amex", name: "Bois amin / AMEX", short: "BOIS", tone: "peach", colorHex: "", position: 1 },
  { id: "outillage-quincaillerie", name: "Outillage & Quincaillerie", short: "OUT–QUIN", tone: "aqua", colorHex: "", position: 2 },
  { id: "panneaux", name: "Panneaux", short: "PAN", tone: "violet", colorHex: "", position: 3 },
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
const emptyDirectoryDraft = (): DirectoryDraft => ({ name: "", email: "", jiraName: "", role: "chef-produit", marketIds: [] });
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
      ["MAR-101", "Contrôle règle tarifaire", "En attente d’un tiers", "Moyenne", "Louise Pepin", "", "", ""],
      ["MAR-102", "Écart de promotion", "En cours", "Haute", "Baptiste Plaisir", "", "", ""],
      ["MAR-103", "Mise à jour fournisseur", "En attente de changement", "Moyenne", "Sarah Daniel", "", "", ""],
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
  const payload = await response.json() as { markets?: { id: string; name: string; shortCode: string; tone: ThemeKey; colorHex?: string; position: number }[]; error?: string };
  if (!response.ok) throw new Error(payload.error || "Impossible de charger les marchés.");
  return (payload.markets ?? []).map((market) => ({ id: market.id, name: market.name, short: market.shortCode, tone: market.tone, colorHex: normalizeHex(market.colorHex), position: market.position }));
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
  const autoTo = uniqueEmails(users.filter((user) => user.marketIds.includes(marketId) && roleMailMode(user.role) === "to").map((user) => user.email));
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
function daysBetween(from: string, to: string) { if (!from || !to) return 0; return Math.floor((new Date(`${to}T12:00:00`).valueOf() - new Date(`${from}T12:00:00`).valueOf()) / 86400000); }
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
function jiraTicketsFromSummary(summary: JiraSummaryImport, selectedPeople: string[]) {
  const selected = new Set(selectedPeople);
  return summary.items.filter((item) => selected.has(item.assignee)).map((item) => ({
    id: uid(), key: "", summary: "Synthèse de la file Jira", status: item.status, priority: "", assignee: item.assignee,
    lastActivity: "", link: item.link, comment: "Tableau Jira hebdomadaire", count: item.count,
  }));
}
async function fetchJiraWeek(year: number, week: number): Promise<JiraWeekPayload> {
  const response = await fetch(`/api/jira-week?year=${year}&week=${week}`, { cache: "no-store" });
  const payload = await response.json() as JiraWeekPayload;
  if (!response.ok) throw new Error(payload.error || "Impossible de charger le tableau Jira hebdomadaire.");
  return payload;
}
async function applyJiraWeek(data: PointData, marketId: string) {
  try {
    const payload = await fetchJiraWeek(isoWeekYear(data.meetingDate), isoWeek(data.meetingDate));
    if (!payload.snapshot) return data;
    return { ...data, jira: jiraTicketsFromSummary(payload.snapshot.summary, payload.assignments[marketId] ?? []) };
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
  return <div className={`paste-importer ${open ? "is-open" : ""}`}><button className="secondary-button" onClick={() => setOpen((value) => !value)}><Icon name="copy" /> Coller un tableau</button>{open && <div className="paste-panel"><div><strong>Import rapide des {label}</strong><span>{kind === "jira" ? "Colle le tableau récapitulatif complet : toutes les personnes et tous les statuts seront reconnus." : "Copie les lignes depuis Excel, avec ou sans en-tête."}</span></div>{kind === "jira" && marketName && <div className="paste-market-target"><Icon name="check" size={14}/><span>Marché cible</span><strong>{marketName}</strong></div>}<code>{columns}</code><textarea value={text} onChange={(event) => setText(event.target.value)} placeholder={kind === "jira" ? "Colle ici le tableau Jira complet, tel qu’il est copié…" : "Colle ici les lignes séparées par des tabulations ou des points-virgules…"} /><div className="paste-actions"><span>{message}</span><button className="primary-button small" onClick={() => { const result = onImport(text); setMessage(result.message ?? (result.count ? `${result.count} ligne${result.count > 1 ? "s" : ""} importée${result.count > 1 ? "s" : ""}.` : "Aucune ligne reconnue.")); if (result.count) setText(""); }}>Importer</button></div></div>}</div>;
}

function JiraPasteImporter({ marketId, marketName, markets, year, week, onImport }: { marketId: string; marketName: string; markets: Market[]; year: number; week: number; onImport: (summary: JiraSummaryImport, selectedPeople: string[]) => ImportOutcome }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<JiraSummaryImport>(() => parseJiraAssigneeSummary(""));
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [mappingMarket, setMappingMarket] = useState(marketId);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const selectedPeople = useMemo(() => assignments[mappingMarket] ?? [], [assignments, mappingMarket]);
  const selectedSet = useMemo(() => new Set(selectedPeople), [selectedPeople]);
  const selectedTickets = preview.people.filter((person) => selectedSet.has(person.assignee)).reduce((sum, person) => sum + person.total, 0);

  useEffect(() => {
    let active = true;
    void fetchJiraWeek(year, week).then((payload) => {
      if (!active) return;
      setAssignments(payload.assignments ?? {});
      if (payload.snapshot) {
        setText(payload.snapshot.rawText);
        setPreview(payload.snapshot.summary);
        setMessage(`Tableau global déjà enregistré pour ${year} · S${String(week).padStart(2, "0")}.`);
      } else {
        setText("");
        setPreview(parseJiraAssigneeSummary(""));
        setMessage("Aucun tableau global enregistré pour cette semaine.");
      }
    }).catch((error) => { if (active) setMessage(error instanceof Error ? error.message : "Chargement impossible."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [year, week]);

  const updateText = (value: string) => { setText(value); setMessage(""); setPreview(parseJiraAssigneeSummary(value)); };
  const setPeopleForMarket = (next: string[]) => setAssignments((current) => ({ ...current, [mappingMarket]: next }));
  const togglePerson = (assignee: string) => setPeopleForMarket(selectedSet.has(assignee) ? selectedPeople.filter((name) => name !== assignee) : [...selectedPeople, assignee]);
  const saveGlobalTable = async () => {
    if (!preview.personCount || saving) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/jira-week", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ year, week, rawText: text, assignments }) });
      const payload = await response.json() as JiraWeekPayload;
      if (!response.ok || !payload.snapshot) throw new Error(payload.error || "Enregistrement impossible.");
      setAssignments(payload.assignments);
      const result = onImport(payload.snapshot.summary, payload.assignments[marketId] ?? []);
      setMessage(result.message ?? `Tableau et affectations enregistrés pour ${year} · S${String(week).padStart(2, "0")}.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Enregistrement impossible."); }
    finally { setSaving(false); }
  };
  const formatLabel = preview.format === "tabulated" ? "Tableau tabulé détecté" : preview.format === "markdown" ? "Tableau Jira détecté" : preview.format === "semicolon" ? "Tableau séparé par ; détecté" : "En attente du tableau";

  return <div className={`paste-importer jira-paste-importer ${open ? "is-open" : ""}`}>
    <button type="button" className="secondary-button" onClick={() => setOpen((value) => !value)}><Icon name="copy" /> Tableau Jira de la semaine</button>
    {open && <div className="paste-panel jira-paste-panel">
      <div className="jira-import-heading"><div><strong>Tableau Jira global · {year} · S{String(week).padStart(2, "0")}</strong><span>Colle une seule fois le tableau complet avec tout le monde, puis affecte les personnes à chaque marché.</span></div><div className="paste-market-target"><Icon name="check" size={14}/><span>Marché affiché</span><strong>{marketName}</strong></div></div>
      <code>Personne assignée → À faire → Réouvert → En cours → Attente client → Attente tiers → Attente changement → Total</code>
      <textarea value={text} disabled={loading} onChange={(event) => updateText(event.target.value)} placeholder="Colle ici le tableau Jira tabulé complet…" aria-label="Tableau Jira tabulé complet de la semaine" />
      <div className={`jira-detection ${preview.personCount ? "is-valid" : ""}`}><span><Icon name={preview.personCount ? "check" : "copy"} size={15}/> {loading ? "Chargement du tableau hebdomadaire…" : formatLabel}</span><strong>{preview.personCount ? `${preview.personCount} personne${preview.personCount > 1 ? "s" : ""} · ${preview.tickets} tickets` : "Aucune ligne reconnue"}</strong></div>
      {preview.personCount > 0 && <div className="jira-preview jira-market-mapping">
        <div className="jira-preview-toolbar"><div><strong>Affectations automatiques par marché</strong><span>Choisis un marché, puis coche les personnes qui lui correspondent. Ces choix seront repris les semaines suivantes.</span></div></div>
        <div className="jira-market-tabs" role="tablist" aria-label="Marchés pour les affectations Jira">{markets.map((item) => <button type="button" role="tab" aria-selected={mappingMarket === item.id} className={mappingMarket === item.id ? "active" : ""} key={item.id} onClick={() => setMappingMarket(item.id)}><span>{item.short}</span><b>{(assignments[item.id] ?? []).filter((name) => preview.people.some((person) => person.assignee === name)).length}</b></button>)}</div>
        <div className="jira-person-checklist">{preview.people.map((person) => <label className={selectedSet.has(person.assignee) ? "selected" : ""} key={person.assignee}><input type="checkbox" checked={selectedSet.has(person.assignee)} onChange={() => togglePerson(person.assignee)}/><span><strong>{person.assignee}</strong><small>{person.statuses.filter((status) => status.count).map((status) => `${status.status} ${status.count}`).join(" · ")}</small></span><b>{person.total}</b></label>)}</div>
        <div className="jira-selection-summary"><div><span>{markets.find((item) => item.id === mappingMarket)?.name}</span><strong>{selectedPeople.length} personne{selectedPeople.length > 1 ? "s" : ""} · {selectedTickets} tickets</strong></div><div className="jira-bulk-actions"><button type="button" onClick={() => setPeopleForMarket(preview.people.map((person) => person.assignee))}>Tout cocher</button><button type="button" onClick={() => setPeopleForMarket([])}>Tout décocher</button></div></div>
      </div>}
      <div className="paste-actions"><span>{message}</span><button type="button" className="primary-button small" disabled={!preview.personCount || saving || loading} onClick={saveGlobalTable}><Icon name="check" size={15}/> {saving ? "Enregistrement…" : "Enregistrer le tableau et les affectations"}</button></div>
    </div>}
  </div>;
}

function buildAlerts(data: PointData): AlertItem[] {
  const alerts: AlertItem[] = []; const pointDate = data.meetingDate || isoToday(); const day = new Date(`${pointDate}T12:00:00`).getDate();
  data.dossiers.forEach((item) => { if (isClosed(item.status)) return; if (/bloqu/i.test(item.status)) alerts.push({ title: item.title || "Dossier", detail: item.comment || "Dossier bloquant", severity: "danger" }); else if (item.deadline && daysBetween(item.deadline, pointDate) > 0) alerts.push({ title: item.title || "Dossier", detail: `Échéance dépassée depuis ${daysBetween(item.deadline, pointDate)} jour(s)`, severity: "danger" }); else if (/(surveill|action)/i.test(item.status)) alerts.push({ title: item.title || "Dossier", detail: item.comment || item.action || item.status, severity: "warning" }); });
  data.tariffs.forEach((item) => { if (isClosed(item.state)) return; if (!item.receptionDate && day >= 15) alerts.push({ title: item.supplier || "Évolution tarifaire", detail: "Trame non reçue après le 15", severity: "danger" }); else if (!item.receptionDate && day >= 8) alerts.push({ title: item.supplier || "Évolution tarifaire", detail: "Trame à sécuriser avant le 15", severity: "warning" }); else if (item.receptionDate && daysBetween(item.receptionDate, pointDate) > 5 && !/(termin|fait|valid)/i.test(item.state)) alerts.push({ title: item.supplier || "Évolution tarifaire", detail: `Trame reçue depuis ${daysBetween(item.receptionDate, pointDate)} jours · traitement à contrôler`, severity: "warning" }); });
  data.jira.forEach((item) => { if (!isClosed(item.status) && item.lastActivity && daysBetween(item.lastActivity, pointDate) > 10) alerts.push({ title: item.key || "Ticket Jira", detail: `Aucune activité depuis ${daysBetween(item.lastActivity, pointDate)} jours`, severity: "warning" }); });
  return alerts.slice(0, 12);
}

function PreviewDashboard({ data, market }: { data: PointData; market: Market }) {
  const alerts = useMemo(() => buildAlerts(data), [data]);
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
    <div className="report-grid"><article className="report-focus"><div className="report-heading"><span>01</span><div><small>Dossiers</small><h2>En cours</h2></div><b>{data.dossiers.length} suivi{data.dossiers.length > 1 ? "s" : ""}</b></div>
      {data.dossiers.length ? <div className="report-dossiers">{data.dossiers.map((item, index) => <div className="report-dossier" key={item.id}><span className={`status-dot tone-${toneForStatus(item.status)}`}/><code>{String(index + 1).padStart(2, "0")}</code><div><strong>{item.title || "Dossier sans titre"}</strong><small>{[item.universe, item.reference, item.owner].filter(Boolean).join(" · ") || "Contexte à compléter"}</small></div><p>{item.action || item.comment || "Prochaine action à compléter."}</p><span className={`report-pill tone-${toneForStatus(item.status)}`}>{item.status}</span></div>)}</div> : <div className="report-empty">Aucun dossier renseigné</div>}
      <div className="report-subheading">Opérations commerciales (promo)</div>{data.operations.length ? <div className="report-simulations">{data.operations.map((item, index) => <section className={`report-simulation simulation-${index % 2 ? "violet" : "mint"}`} key={item.id}><div><code>{String.fromCharCode(65 + index)}</code><span className={`report-pill tone-${toneForStatus(item.state)}`}>{item.state}</span></div><small>{item.month || "Mois à définir"}</small><h3>{item.name || "Opération sans titre"}</h3><p>{item.summary}</p><div>{item.steps.map(([label, state]) => <div className="report-step" key={label}><span>{label}</span><strong className={`tone-text-${toneForStatus(state)}`}><i/>{state}</strong></div>)}</div></section>)}</div> : <div className="report-empty">Aucune opération commerciale renseignée</div>}
    </article><aside className="report-side">
      <article className="report-dark-card"><div className="side-heading"><div><span>02</span><h2>Évolutions tarifaires</h2></div><b>{data.tariffs.length} total</b></div>{groupedTariffs.length ? groupedTariffs.map((group) => <section className="tariff-group" key={group.month}><h3>{group.month}<span>{group.items.length} fournisseur{group.items.length > 1 ? "s" : ""}</span></h3>{group.items.map((item) => <div className="tariff-line" key={item.id}><code>{item.code || "—"}</code><strong>{item.supplier || "Fournisseur"}</strong><small>{item.state}</small></div>)}</section>) : <div className="report-empty dark-empty">Aucune évolution</div>}</article>
      <article className="report-dark-card"><div className="side-heading"><div><span>03</span><h2>Jira par personne</h2></div><b>{activeJiraCount} actif{activeJiraCount > 1 ? "s" : ""}</b></div>{jiraPeople.length ? <div className="jira-summary">{jiraPeople.map((person, index) => <div key={person.assignee}><i className={`tone-${(["mint", "violet", "aqua", "peach"] as Tone[])[index % 4]}`}/><p><strong>{person.assignee}</strong><small>{jiraStatusSummary(person.items)}</small></p><b>{person.total}</b></div>)}</div> : <div className="report-empty dark-empty">Aucun ticket actif</div>}</article>
      <article className="report-alert-card"><div className="alert-heading"><span>04</span><h2>Vigilances</h2><b>{alerts.length}</b></div>{alerts.length ? alerts.map((item, index) => <div className="alert-line" key={`${item.title}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{item.title}</strong><small>{item.detail}</small></div></div>) : <div className="report-empty light-empty">Aucune vigilance détectée</div>}</article>
    </aside></div><footer className="report-footer"><span>Market Pulse · {market.name}</span><span>Point marché · {isoWeekYear(data.meetingDate)} · S{String(isoWeek(data.meetingDate)).padStart(2, "0")}</span></footer>
  </div>;
}

function buildMailHtml(data: PointData, market: Market) {
  const alerts = buildAlerts(data); const activeJiraItems = data.jira.filter((item) => !isClosed(item.status)); const activeJira = activeJiraItems.reduce((sum, item) => sum + jiraItemCount(item), 0);
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
  const [newDirectoryUser, setNewDirectoryUser] = useState<DirectoryDraft>(() => emptyDirectoryDraft());
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
  const fileInput = useRef<HTMLInputElement>(null);
  const archiveRequest = useRef(0);
  const market = marketOptions.find((item) => item.id === marketId) ?? marketOptions[0] ?? defaultMarkets[0];
  const theme = themes.find((item) => item.id === data.themeColor) ?? themes[0];
  const accent = normalizeHex(data.customColor) || theme.accent;
  const themeStyle = { "--accent": accent, "--accent-soft": normalizeHex(data.customColor) ? hexSoft(data.customColor) : theme.soft } as CSSProperties;
  const alerts = useMemo(() => buildAlerts(data), [data]);
  const mailHtml = useMemo(() => buildMailHtml(data, market), [data, market]);
  const isDirty = pointSignature(marketId, data) !== lastSavedSignature;
  const currentWeek = isoWeek(data.meetingDate);
  const currentWeekYear = isoWeekYear(data.meetingDate);
  const currentWeekPoint = archive.find((item) => item.week === currentWeek && item.year === currentWeekYear);
  const previousPoint = archive.find((item) => item.year < currentWeekYear || (item.year === currentWeekYear && item.week < currentWeek));
  const calendarWeeks = useMemo(() => weeksForMonth(calendarMonth), [calendarMonth]);
  const jiraPeople = useMemo(() => groupJiraPeople(data.jira), [data.jira]);
  const automaticMailToUsers = directoryUsers.filter((user) => user.marketIds.includes(marketId) && roleMailMode(user.role) === "to");
  const automaticMailCcUsers = directoryUsers.filter((user) => roleMailMode(user.role) === "cc");
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

  const chooseMarket = (nextMarket: string) => {
    if (nextMarket !== marketId && view === "edit" && isDirty && !window.confirm("Changer de marché sans enregistrer ce brouillon ?")) return;
    setSection("general");
    void loadMarket(nextMarket, true, marketOptions.find((item) => item.id === nextMarket));
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
    const selectedRows = summary.people.filter((person) => selectedPeople.includes(person.assignee));
    if (!selectedRows.length) return { count: 0 };
    const jira = jiraTicketsFromSummary(summary, selectedPeople);
    const tickets = selectedRows.reduce((sum, person) => sum + person.total, 0);
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
  const resetPoint = () => { if (!window.confirm("Créer un nouveau point pour ce marché ? Le brouillon actuel sera remplacé, mais les points déjà enregistrés resteront disponibles.")) return; const fresh = initialData(marketId, market); fresh.dossiers = []; fresh.operations = []; fresh.tariffs = []; fresh.jira = []; fresh.mail = data.mail; fresh.themeColor = data.themeColor; fresh.customColor = data.customColor; setData(fresh); setCalendarMonth(monthStart(fresh.meetingDate)); setActiveRecordId(null); setSavedAt(null); setLastSavedSignature(""); setToast("Nouveau brouillon créé."); };
  const loadRecord = async (record: PointRecord, nextView: View = view, skipConfirm = false) => {
    if (!skipConfirm && view === "edit" && isDirty && !window.confirm("Charger ce point et remplacer le brouillon non enregistré ?")) return;
    const recordMarket = marketOptions.find((item) => item.id === record.marketId) ?? market;
    const nextData = await applyJiraWeek(normalizePointData(record.data, record.marketId, recordMarket), record.marketId);
    setMarketId(record.marketId); setData(nextData); setCalendarMonth(monthStart(nextData.meetingDate)); setActiveRecordId(record.id); setSavedAt(new Date(record.createdAt.replace(" ", "T") + (record.createdAt.includes("Z") ? "" : "Z"))); setLastSavedSignature(pointSignature(record.marketId, nextData)); setSection("general"); setView(nextView); setToast(`${record.year} · S${String(record.week).padStart(2, "0")} chargée.`);
  };
  const chooseWeek = async (value: string) => {
    if (!/^\d{4}-W\d{2}$/.test(value)) return;
    const meetingDate = dateFromWeekInput(value);
    const year = isoWeekYear(meetingDate); const week = isoWeek(meetingDate);
    if (year === currentWeekYear && week === currentWeek) { setCalendarMonth(monthStart(meetingDate)); return; }
    if (view === "edit" && isDirty && !window.confirm("Changer de semaine sans enregistrer ce brouillon ?")) return;
    setCalendarMonth(monthStart(meetingDate));
    const latest = archive.find((record) => record.year === year && record.week === week);
    if (latest) { await loadRecord(latest, view, true); return; }
    const fresh = initialData(marketId, market);
    fresh.dossiers = []; fresh.operations = []; fresh.tariffs = []; fresh.jira = []; fresh.mail = data.mail;
    fresh.themeColor = data.themeColor; fresh.customColor = data.customColor; fresh.meetingDate = meetingDate;
    const nextData = await applyJiraWeek(fresh, marketId);
    setData(nextData); setCalendarMonth(monthStart(nextData.meetingDate)); setActiveRecordId(null); setSavedAt(null); setLastSavedSignature(""); setToast(`${year} · S${String(week).padStart(2, "0")} ouverte comme nouveau brouillon.`);
  };
  const chooseCurrentWeek = async () => {
    const today = isoToday();
    setCalendarMonth(monthStart(today));
    await chooseWeek(weekInputValue(today));
  };
  const chooseLatestPublished = async () => {
    const latest = archive[0];
    if (latest) await loadRecord(latest, view);
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
  const updateMarketDraft = (id: string, patch: Partial<Market>) => setMarketOptions((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  const createMarket = async () => {
    if (creatingMarket) return;
    setCreatingMarket(true);
    try {
      const index = marketOptions.length + 1;
      const response = await fetch("/api/markets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: `Nouveau marché ${index}`, shortCode: `MARCHÉ-${index}`, tone: themes[index % themes.length].id, colorHex: "" }) });
      const payload = await response.json() as { market?: { id: string; name: string; shortCode: string; tone: ThemeKey; colorHex?: string; position: number }; error?: string };
      if (!response.ok || !payload.market) throw new Error(payload.error || "Création impossible.");
      const created: Market = { id: payload.market.id, name: payload.market.name, short: payload.market.shortCode, tone: payload.market.tone, colorHex: normalizeHex(payload.market.colorHex), position: payload.market.position };
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
      const response = await fetch("/api/markets", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, name: draft.name, shortCode: draft.short, tone: draft.tone, colorHex: draft.colorHex }) });
      const payload = await response.json() as { market?: { id: string; name: string; shortCode: string; tone: ThemeKey; colorHex?: string; position: number }; error?: string };
      if (!response.ok || !payload.market) throw new Error(payload.error || "Modification impossible.");
      const saved: Market = { id: payload.market.id, name: payload.market.name, short: payload.market.shortCode, tone: payload.market.tone, colorHex: normalizeHex(payload.market.colorHex), position: payload.market.position };
      setMarketOptions((current) => current.map((item) => item.id === id ? saved : item));
      if (id === marketId) setData((current) => ({ ...current, themeColor: saved.tone, customColor: saved.colorHex, mail: { ...current.mail, subject: /^Point marché —/.test(current.mail.subject) ? `Point marché — ${saved.name}` : current.mail.subject } }));
      setToast(`Marché « ${saved.name} » enregistré.`);
    } catch (error) { setToast(error instanceof Error ? error.message : "Modification du marché impossible."); }
    finally { setMarketSavingId(""); }
  };
  const deleteMarket = async (id: string) => {
    const removed = marketOptions.find((item) => item.id === id);
    if (!removed || marketSavingId) return;
    if (!window.confirm(`Supprimer « ${removed.name} » de la liste active ? Les points déjà enregistrés seront conservés.`)) return;
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
  const updateDirectoryUser = (id: string, patch: Partial<GlobalDirectoryUser>) => setDirectoryUsers((current) => current.map((user) => user.id === id ? { ...user, ...patch } : user));
  const toggleDirectoryMarket = (userId: string, selectedMarket: string) => setDirectoryUsers((current) => current.map((user) => user.id !== userId ? user : { ...user, marketIds: user.marketIds.includes(selectedMarket) ? user.marketIds.filter((id) => id !== selectedMarket) : [...user.marketIds, selectedMarket] }));
  const toggleNewDirectoryMarket = (selectedMarket: string) => setNewDirectoryUser((current) => ({ ...current, marketIds: current.marketIds.includes(selectedMarket) ? current.marketIds.filter((id) => id !== selectedMarket) : [...current.marketIds, selectedMarket] }));
  const acceptDirectoryPayload = (users: GlobalDirectoryUser[]) => {
    setDirectoryUsers(users);
    setDirectoryRevision((current) => current + 1);
    setData((current) => applyDirectoryMail(current, marketId, users));
  };
  const createDirectoryUser = async () => {
    if (directorySavingId) return;
    setDirectorySavingId("new");
    try {
      const response = await fetch("/api/global-users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(newDirectoryUser) });
      const payload = await response.json() as { users?: GlobalDirectoryUser[]; error?: string };
      if (!response.ok || !payload.users) throw new Error(payload.error || "Création impossible.");
      acceptDirectoryPayload(payload.users);
      setNewDirectoryUser(emptyDirectoryDraft());
      setToast("Utilisateur ajouté à l’annuaire GLOBAL.");
    } catch (error) { setToast(error instanceof Error ? error.message : "Création de l’utilisateur impossible."); }
    finally { setDirectorySavingId(""); }
  };
  const saveDirectoryUser = async (id: string) => {
    const draft = directoryUsers.find((user) => user.id === id);
    if (!draft || directorySavingId) return;
    setDirectorySavingId(id);
    try {
      const response = await fetch("/api/global-users", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) });
      const payload = await response.json() as { users?: GlobalDirectoryUser[]; error?: string };
      if (!response.ok || !payload.users) throw new Error(payload.error || "Modification impossible.");
      acceptDirectoryPayload(payload.users);
      setToast(`Utilisateur « ${draft.name} » enregistré.`);
    } catch (error) { setToast(error instanceof Error ? error.message : "Modification de l’utilisateur impossible."); }
    finally { setDirectorySavingId(""); }
  };
  const deleteDirectoryUser = async (id: string) => {
    const user = directoryUsers.find((item) => item.id === id);
    if (!user || directorySavingId || !window.confirm(`Retirer « ${user.name} » de l’annuaire GLOBAL ?`)) return;
    setDirectorySavingId(id);
    try {
      const response = await fetch(`/api/global-users?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const payload = await response.json() as { users?: GlobalDirectoryUser[]; error?: string };
      if (!response.ok || !payload.users) throw new Error(payload.error || "Suppression impossible.");
      acceptDirectoryPayload(payload.users);
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

  const navItems: { id: Section; label: string; icon: string; count?: number }[] = [
    { id: "general", label: "Cadre du point", icon: "spark" }, { id: "markets", label: "Gérer les marchés", icon: "edit", count: marketOptions.length }, { id: "users", label: "Utilisateurs GLOBAL", icon: "user", count: directoryUsers.length }, { id: "dossiers", label: "Dossiers en cours", icon: "folder", count: data.dossiers.length },
    { id: "operations", label: "Opérations commerciales", icon: "trend", count: data.operations.length }, { id: "tariffs", label: "Évolutions tarifaires", icon: "trend", count: data.tariffs.length },
    { id: "jira", label: "Tickets Jira", icon: "ticket", count: data.jira.reduce((sum, item) => sum + jiraItemCount(item), 0) }, { id: "saved", label: "Points enregistrés", icon: "download", count: archive.length }, { id: "mail", label: "Paramètres du mail", icon: "mail" },
  ];

  const periodNavigator = <section className={`period-navigator ${view === "edit" ? "edit-period" : "read-period"}`} aria-label={view === "edit" ? "Période d’édition" : "Navigation de lecture"}>
    <div className="period-head">
      <div className="period-title"><span><Icon name={view === "edit" ? "edit" : "eye"} size={15}/> {view === "edit" ? "Période d’édition" : "Lecture des points"}</span><strong>{market.name}</strong></div>
      <label className="period-market"><span>Marché</span><select value={marketId} onChange={(event) => chooseMarket(event.target.value)}>{marketOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <div className="period-state"><span>{currentWeekYear} · S{String(currentWeek).padStart(2, "0")}</span><strong>{isDirty ? "Brouillon modifié" : activeRecordId ? "Point enregistré" : "Nouvelle semaine"}</strong><small>{currentWeekPoint ? `Sauvegardé le ${dateLabel(currentWeekPoint.meetingDate)}` : "Aucun point enregistré"}</small></div>
    </div>
    <div className="visual-week-picker">
      <div className="week-picker-toolbar">
        <div className="month-navigation"><button type="button" aria-label="Mois précédent" onClick={() => setCalendarMonth((current) => shiftMonth(current, -1))}><Icon name="chevron" size={16}/></button><strong>{calendarMonthLabel(calendarMonth)}</strong><button type="button" aria-label="Mois suivant" onClick={() => setCalendarMonth((current) => shiftMonth(current, 1))}><Icon name="chevron" size={16}/></button></div>
        <div className="week-quick-actions"><button type="button" onClick={() => { void chooseCurrentWeek(); }}><Icon name="calendar" size={14}/> Cette semaine</button><button type="button" disabled={!archive.length} onClick={() => { void chooseLatestPublished(); }}><Icon name="check" size={14}/> Dernière publiée</button>{view === "edit" && <button type="button" disabled={!previousPoint} onClick={openCarryover}><Icon name="copy" size={14}/> Reprendre le précédent</button>}</div>
      </div>
      <div className="week-card-strip">{calendarWeeks.map((weekChoice) => { const savedPoint = archive.find((record) => record.year === weekChoice.year && record.week === weekChoice.week); const selected = weekChoice.year === currentWeekYear && weekChoice.week === currentWeek; const today = weekChoice.value === weekInputValue(isoToday()); return <button type="button" className={`week-choice ${selected ? "selected" : ""} ${savedPoint ? "published" : "empty"} ${selected && isDirty ? "draft" : ""}`} aria-pressed={selected} key={weekChoice.value} onClick={() => { void chooseWeek(weekChoice.value); }}><span><i/>{today ? "Cette semaine" : `${weekChoice.year}`}</span><strong>S{String(weekChoice.week).padStart(2, "0")}</strong><small>{weekChoice.range}</small><b>{savedPoint ? "Point enregistré" : "À renseigner"}</b></button>; })}</div>
    </div>
  </section>;

  const renderEditor = () => <div className="editor-layout"><aside className="editor-nav"><div className="editor-nav-title"><span>Sommaire</span><small>Complète ton point</small></div>{navItems.map((item) => <button key={item.id} className={section === item.id ? "active" : ""} onClick={() => setSection(item.id)}><Icon name={item.icon}/><span>{item.label}</span>{item.count !== undefined && <b>{item.count}</b>}<Icon name="chevron" size={15}/></button>)}<div className={`autosave-card ${isDirty ? "is-dirty" : ""}`}><span><Icon name={isDirty ? "edit" : "check"} size={14}/> {isDirty ? "Brouillon à enregistrer" : "Sauvegarde en ligne"}</span><small>{archiveLoading ? "Chargement du registre…" : activeRecordId ? `Point enregistré${savedAt ? ` · ${savedAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : ""}` : "Aucun point enregistré"}</small></div></aside><main className="editor-content">
    {section === "general" && <section className="editor-section">
      <SectionTitle eyebrow="01 · Cadre" title="Préparer le point" detail="Le marché, la date ISO et la couleur pilotent le rendu web et le mail."/>
      <div className="surface form-grid general-grid">
        <label className="field"><span>Marché</span><select value={marketId} onChange={(event) => chooseMarket(event.target.value)}>{marketOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <TextField label="Date du point" type="date" value={data.meetingDate} onChange={(meetingDate) => { setData((current) => ({ ...current, meetingDate })); setCalendarMonth(monthStart(meetingDate)); }}/>
        <div className="week-display"><span>Référence ISO</span><strong>{isoWeekYear(data.meetingDate)} · S{String(isoWeek(data.meetingDate)).padStart(2, "0")}</strong></div>
        <div className="field field-wide theme-field"><span>Couleur de ce point</span><div className="theme-picker">{themes.map((option) => <button key={option.id} type="button" className={!data.customColor && data.themeColor === option.id ? "active" : ""} style={{ "--swatch": option.accent } as CSSProperties} onClick={() => setData((current) => ({ ...current, themeColor: option.id, customColor: "" }))}><i/><b>{option.label}</b></button>)}</div><div className="hex-color-control"><input type="color" value={accent} aria-label="Sélecteur de couleur personnalisée" onChange={(event) => setData((current) => ({ ...current, customColor: event.target.value.toUpperCase() }))}/><label><span>Hexadécimal personnalisé</span><input value={data.customColor} maxLength={7} placeholder={theme.accent.toUpperCase()} onChange={(event) => setData((current) => ({ ...current, customColor: event.target.value.toUpperCase() }))}/></label><small className={data.customColor && !validHex(data.customColor) ? "invalid" : ""}>{data.customColor && !validHex(data.customColor) ? "Format attendu : #RRGGBB" : `Couleur active : ${accent.toUpperCase()}`}</small></div></div>
        <label className="field field-wide"><span>Priorité de la semaine</span><textarea value={data.priority} onChange={(event) => setData((current) => ({ ...current, priority: event.target.value }))} placeholder="L’action principale ou le message clé à retenir…"/></label>
      </div>
      <div className="guidance-grid"><article><span>01</span><strong>Choisis le bon marché</strong><p>Les noms et codes sont administrables dans « Gérer les marchés ».</p></article><article><span>02</span><strong>Reprends les suivis utiles</strong><p>Les dossiers et opérations non terminés du dernier point peuvent être reconduits sans doublon.</p></article><article><span>03</span><strong>Sauvegarde et diffuse</strong><p>Les destinataires et tickets Jira sont préparés depuis l’annuaire GLOBAL.</p></article></div>
    </section>}

    {section === "markets" && <section className="editor-section"><SectionTitle eyebrow="02 · Administration" title="Gérer les marchés" detail="Modifie le nom affiché, le code court et la couleur par défaut, ou ajoute un nouveau marché." action={<button className="primary-button" disabled={creatingMarket} onClick={createMarket}><Icon name="plus"/> {creatingMarket ? "Ajout…" : "Ajouter un marché"}</button>}/><div className="market-admin-note"><Icon name="alert"/><div><strong>Suppression sans perte d’historique</strong><span>Un marché supprimé disparaît de la liste active, mais ses points hebdomadaires restent conservés.</span></div></div><div className="market-admin-list">{marketOptions.map((item, index) => { const marketAccent = normalizeHex(item.colorHex) || themes.find((option) => option.id === item.tone)?.accent || themes[0].accent; return <article className={`surface market-admin-card ${item.id === marketId ? "active" : ""}`} key={item.id}><div className="market-admin-index" style={{ "--swatch": marketAccent } as CSSProperties}><i/><span>{String(index + 1).padStart(2, "0")}</span></div><div className="market-admin-fields"><TextField label="Nom du marché" value={item.name} onChange={(name) => updateMarketDraft(item.id, { name })}/><TextField label="Code court" value={item.short} onChange={(short) => updateMarketDraft(item.id, { short })} placeholder="EX. BOIS"/><label className="field"><span>Palette par défaut</span><select value={item.tone} onChange={(event) => updateMarketDraft(item.id, { tone: event.target.value as ThemeKey, colorHex: "" })}>{themes.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label><label className="field market-hex-field"><span>Hex personnalisé</span><div><input type="color" value={marketAccent} aria-label={`Couleur de ${item.name}`} onChange={(event) => updateMarketDraft(item.id, { colorHex: event.target.value.toUpperCase() })}/><input value={item.colorHex} maxLength={7} placeholder="#RRGGBB" onChange={(event) => updateMarketDraft(item.id, { colorHex: event.target.value.toUpperCase() })}/></div></label></div><div className="market-admin-actions">{item.id === marketId && <span>Marché actif</span>}<button className="secondary-button" disabled={Boolean(marketSavingId)} onClick={() => saveMarket(item.id)}><Icon name="check"/> {marketSavingId === item.id ? "Enregistrement…" : "Enregistrer"}</button><button className="icon-button danger" disabled={Boolean(marketSavingId)} aria-label={`Supprimer ${item.name}`} title="Supprimer de la liste active" onClick={() => deleteMarket(item.id)}><Icon name="trash"/></button></div></article>; })}</div></section>}

    {section === "users" && <section className="editor-section">
      <SectionTitle eyebrow="02 · Annuaire interne" title="Utilisateurs GLOBAL" detail="Associe les personnes aux marchés existants. Un changement de nom du marché conserve automatiquement les liens."/>
      <div className="directory-rule-grid"><article><Icon name="ticket"/><div><strong>Jira automatique</strong><span>Chefs de produit, chefs de marché et analystes tarif/référentiel sont affectés à leurs marchés via leur nom Jira.</span></div></article><article><Icon name="mail"/><div><strong>Mail automatique</strong><span>Ces rôles sont destinataires principaux ; l’unique manager Tarif est ajouté en copie.</span></div></article><article><Icon name="lock"/><div><strong>Administration unique</strong><span>L’annuaire ne change pas la connexion partagée GLOBAL actuellement utilisée.</span></div></article></div>
      <article className="surface directory-create-card"><div className="directory-card-heading"><span className="directory-avatar"><Icon name="plus"/></span><div><strong>Ajouter une personne</strong><small>Nom, adresse mail, identité Jira et rôle métier</small></div></div><div className="directory-fields"><TextField label="Nom complet" value={newDirectoryUser.name} onChange={(name) => setNewDirectoryUser((current) => ({ ...current, name, jiraName: current.jiraName || name }))} placeholder="Louise PEPIN"/><TextField label="Adresse e-mail" type="email" value={newDirectoryUser.email} onChange={(email) => setNewDirectoryUser((current) => ({ ...current, email }))} placeholder="person@example.test"/><TextField label="Nom dans Jira" value={newDirectoryUser.jiraName} onChange={(jiraName) => setNewDirectoryUser((current) => ({ ...current, jiraName }))} placeholder="Louise Pepin"/><label className="field"><span>Rôle</span><select value={newDirectoryUser.role} onChange={(event) => setNewDirectoryUser((current) => ({ ...current, role: event.target.value as GlobalRole, marketIds: event.target.value === "manager-tarif" ? [] : current.marketIds }))}>{GLOBAL_ROLE_OPTIONS.map((role) => <option key={role.id} value={role.id}>{role.label}</option>)}</select></label></div>{newDirectoryUser.role !== "manager-tarif" ? <div className="directory-market-picker"><span>Marchés associés</span><div>{marketOptions.map((item) => <button type="button" className={newDirectoryUser.marketIds.includes(item.id) ? "selected" : ""} key={item.id} onClick={() => toggleNewDirectoryMarket(item.id)}><i style={{ "--swatch": normalizeHex(item.colorHex) || themes.find((themeOption) => themeOption.id === item.tone)?.accent || themes[0].accent } as CSSProperties}/>{item.name}</button>)}</div></div> : <div className="directory-manager-note"><Icon name="mail" size={15}/> Le manager Tarif sera automatiquement ajouté en copie de tous les mails.</div>}<div className="directory-card-actions"><span>{roleMailMode(newDirectoryUser.role) === "to" ? "Jira + destinataire principal" : roleMailMode(newDirectoryUser.role) === "cc" ? "Copie automatique" : "Association conservée sans automatisation"}</span><button className="primary-button" disabled={directorySavingId === "new" || !newDirectoryUser.name || !newDirectoryUser.email} onClick={createDirectoryUser}><Icon name="plus"/> {directorySavingId === "new" ? "Ajout…" : "Ajouter à l’annuaire"}</button></div></article>
      {!directoryReady ? <div className="archive-message"><span>Chargement de l’annuaire GLOBAL…</span></div> : directoryUsers.length ? <div className="directory-list">{directoryUsers.map((user) => <article className="surface directory-user-card" key={user.id}><div className="directory-card-heading"><span className="directory-avatar">{user.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span><div><strong>{user.name || "Utilisateur GLOBAL"}</strong><small>{roleLabel(user.role)}</small></div><div className="directory-automation-badges">{roleMailMode(user.role) === "to" && <><span className="jira">Jira auto</span><span className="mail">Mail À</span></>}{roleMailMode(user.role) === "cc" && <span className="mail">Mail copie</span>}{roleMailMode(user.role) === "none" && <span>En réserve</span>}</div></div><div className="directory-fields"><TextField label="Nom complet" value={user.name} onChange={(name) => updateDirectoryUser(user.id, { name })}/><TextField label="Adresse e-mail" type="email" value={user.email} onChange={(email) => updateDirectoryUser(user.id, { email })}/><TextField label="Nom dans Jira" value={user.jiraName} onChange={(jiraName) => updateDirectoryUser(user.id, { jiraName })}/><label className="field"><span>Rôle</span><select value={user.role} onChange={(event) => updateDirectoryUser(user.id, { role: event.target.value as GlobalRole, marketIds: event.target.value === "manager-tarif" ? [] : user.marketIds })}>{GLOBAL_ROLE_OPTIONS.map((role) => <option key={role.id} value={role.id}>{role.label}</option>)}</select></label></div>{user.role !== "manager-tarif" ? <div className="directory-market-picker"><span>Marchés associés</span><div>{marketOptions.map((item) => <button type="button" className={user.marketIds.includes(item.id) ? "selected" : ""} key={item.id} onClick={() => toggleDirectoryMarket(user.id, item.id)}><i style={{ "--swatch": normalizeHex(item.colorHex) || themes.find((themeOption) => themeOption.id === item.tone)?.accent || themes[0].accent } as CSSProperties}/>{item.name}</button>)}</div></div> : <div className="directory-manager-note"><Icon name="mail" size={15}/> Manager Tarif unique · copie automatique de tous les mails</div>}<div className="directory-card-actions"><span>{user.marketIds.length ? `${user.marketIds.length} marché${user.marketIds.length > 1 ? "s" : ""} lié${user.marketIds.length > 1 ? "s" : ""}` : user.role === "manager-tarif" ? "Périmètre transversal Tarif" : "Aucun marché associé"}</span><div><button className="secondary-button" disabled={Boolean(directorySavingId)} onClick={() => saveDirectoryUser(user.id)}><Icon name="check"/> {directorySavingId === user.id ? "Enregistrement…" : "Enregistrer"}</button><button className="icon-button danger" disabled={Boolean(directorySavingId)} aria-label={`Retirer ${user.name}`} onClick={() => deleteDirectoryUser(user.id)}><Icon name="trash"/></button></div></div></article>)}</div> : <div className="surface archive-empty"><Icon name="user" size={28}/><strong>Annuaire GLOBAL vide</strong><span>Ajoute les chefs de produit, chefs de marché, analystes et le manager Tarif.</span></div>}
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
      <SectionTitle eyebrow="05 · Tableau hebdomadaire global" title="Tickets Jira par personne" detail={`Colle une fois le tableau complet de la semaine, puis contrôle les personnes associées à chaque marché. La vue ${market.name} se met à jour automatiquement.`} action={<div className="title-actions"><JiraPasteImporter key={`${currentWeekYear}-${currentWeek}-${marketId}-${directoryRevision}`} marketId={marketId} marketName={market.name} markets={marketOptions} year={currentWeekYear} week={currentWeek} onImport={importJiraSummary}/><button className="primary-button" onClick={addJira}><Icon name="plus"/> Ajouter une personne</button></div>}/>
      <div className="jira-import-note"><Icon name="ticket"/><div><strong>Un tableau conservé par semaine, des affectations durables par marché</strong><span>Les noms Jira associés dans l’annuaire GLOBAL sont précochés automatiquement. Les autres personnes restent sélectionnables marché par marché, sans doublons.</span></div></div>
      <div className="surface data-table-wrap jira-summary-wrap"><table className="data-table jira-person-table"><thead><tr><th>Personne</th>{JIRA_SUMMARY_STATUSES.map((status) => <th key={status}>{status}</th>)}<th>Total</th><th/></tr></thead><tbody>{jiraPeople.map((person) => <tr key={person.assignee}><th scope="row"><input value={person.assignee} aria-label={`Personne ${person.assignee}`} onChange={(event) => renameJiraPerson(person.assignee, event.target.value)}/></th>{JIRA_SUMMARY_STATUSES.map((status) => { const statusItems = person.items.filter((item) => item.status === status); const count = statusItems.reduce((sum, item) => sum + jiraItemCount(item), 0); const link = statusItems.find((item) => item.link)?.link; return <td key={status}><div className="jira-count-cell"><input type="number" min="0" value={count} aria-label={`${status} pour ${person.assignee}`} onChange={(event) => setJiraPersonCount(person.assignee, status, Number(event.target.value))}/>{link && <a href={link} target="_blank" rel="noreferrer" title={`Ouvrir le filtre « ${status} »`} aria-label={`Ouvrir le filtre ${status} de ${person.assignee}`}>↗</a>}</div></td>; })}<td className="jira-person-total"><strong>{person.total}</strong><small>{jiraStatusSummary(person.items)}</small></td><td><button className="icon-button subtle" aria-label={`Supprimer ${person.assignee}`} onClick={() => removeJiraPerson(person.assignee)}><Icon name="trash" size={15}/></button></td></tr>)}</tbody></table>{!jiraPeople.length && <div className="table-empty">Aucun ticket Jira. Importe le tableau complet ou ajoute une personne.</div>}</div>
    </section>}

    {section === "saved" && <section className="editor-section"><SectionTitle eyebrow="07 · Registre en ligne" title="Points enregistrés" detail="Un seul point est conservé par marché et par semaine. Sauvegarder met à jour le point existant." action={<button className="primary-button" disabled={saving || !ready} onClick={savePoint}><Icon name="check"/> {saving ? "Enregistrement…" : "Sauvegarder ce point"}</button>}/><div className="surface version-summary"><div className="version-week"><span>Semaine active</span><strong>{currentWeekYear} · S{String(currentWeek).padStart(2, "0")}</strong><small>{currentWeekPoint ? `Point enregistré le ${new Date(currentWeekPoint.createdAt.replace(" ", "T") + (currentWeekPoint.createdAt.includes("Z") ? "" : "Z")).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}` : "Aucun point enregistré pour cette semaine"}</small></div><div className="version-next"><span>Fonctionnement</span><strong>{currentWeekPoint ? "Mise à jour" : "Création"}</strong><small>{currentWeekPoint ? "La sauvegarde remplace le contenu enregistré pour cette semaine." : "La première sauvegarde créera le point de cette semaine."}</small></div><div className="version-actions"><button className="secondary-button" onClick={() => fileInput.current?.click()}><Icon name="upload"/> Importer JSON</button><button className="secondary-button" onClick={() => exportJson()}><Icon name="download"/> Exporter le brouillon</button></div></div>{archiveError && <div className="archive-message error"><Icon name="alert"/><span>{archiveError}</span></div>}{archiveLoading ? <div className="archive-message"><span>Chargement des points enregistrés…</span></div> : archive.length ? <div className="archive-list">{archive.map((record) => <article className={`surface archive-row ${activeRecordId === record.id && !isDirty ? "active" : ""}`} key={record.id}><div className="archive-version"><span>{record.year}</span><strong>S{String(record.week).padStart(2, "0")}</strong><small>ISO</small></div><div className="archive-copy"><span>{market.name}</span><strong>{dateLabel(record.meetingDate)}</strong><small>Enregistré le {new Date(record.createdAt.replace(" ", "T") + (record.createdAt.includes("Z") ? "" : "Z")).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</small></div><div className="archive-actions"><button className="secondary-button" onClick={() => exportJson(record)}><Icon name="download"/> JSON</button><button className="primary-button" onClick={() => loadRecord(record)}><Icon name="upload"/> Charger</button></div></article>)}</div> : !archiveError && <div className="surface archive-empty"><Icon name="download" size={28}/><strong>Aucun point enregistré</strong><span>Sauvegarde le premier point hebdomadaire de ce marché.</span></div>}</section>}

    {section === "mail" && <section className="editor-section">
      <SectionTitle eyebrow="07 · Diffusion" title="Paramètres du mail" detail="L’annuaire prépare les destinataires ; tu peux conserver des adresses manuelles en complément." action={<button className="secondary-button" onClick={() => setData((current) => applyDirectoryMail(current, marketId, directoryUsers))}><Icon name="user"/> Actualiser depuis l’annuaire</button>}/>
      <div className="mail-automation-grid">
        <article><span><Icon name="mail" size={15}/> Destinataires automatiques</span><strong>{automaticMailToUsers.length ? automaticMailToUsers.map((user) => user.name).join(" · ") : "Aucun pour ce marché"}</strong><small>Chefs de produit, chefs de marché et analystes liés à {market.name}.</small></article>
        <article><span><Icon name="copy" size={15}/> Copie automatique</span><strong>{automaticMailCcUsers.length ? automaticMailCcUsers.map((user) => user.name).join(" · ") : "Manager Tarif non renseigné"}</strong><small>L’unique manager Tarif est ajouté en copie pour tous les marchés.</small></article>
      </div>
      <div className="surface form-grid mail-settings"><TextField label="Destinataires" value={data.mail.to} onChange={(to) => setData((current) => ({ ...current, mail: { ...current.mail, to } }))} wide/><TextField label="Copie" value={data.mail.cc} onChange={(cc) => setData((current) => ({ ...current, mail: { ...current.mail, cc } }))} wide/><TextField label="Objet" value={data.mail.subject} onChange={(subject) => setData((current) => ({ ...current, mail: { ...current.mail, subject } }))} wide/><label className="field field-wide"><span>Introduction</span><textarea value={data.mail.intro} onChange={(event) => setData((current) => ({ ...current, mail: { ...current.mail, intro: event.target.value } }))}/></label></div><button className="primary-button mail-next" onClick={() => setView("mail")}><Icon name="mail"/> Vérifier le mail</button>
    </section>}
  </main></div>;

  return <div className={`app-shell market-${market.tone}`} style={themeStyle}><div className="ambient ambient-a"/><div className="ambient ambient-b"/>
    <header className="app-header">
      <a className="brand" href="#top"><span className="brand-mark"><Icon name="spark" size={19}/></span><div><strong>Market Pulse</strong><small>Générateur de point marché</small></div></a>
      <div className="market-switch"><span>Marché actif</span><select value={marketId} onChange={(event) => chooseMarket(event.target.value)}>{marketOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
      <nav className="view-tabs" aria-label="Mode d’affichage"><button className={view === "read" ? "active" : ""} onClick={() => chooseView("read")}><Icon name="eye"/> Lecture</button><button className={view === "edit" ? "active" : ""} onClick={() => chooseView("edit")}><Icon name={session.user ? "edit" : "lock"}/> Édition</button><button className={view === "mail" ? "active" : ""} onClick={() => chooseView("mail")}><Icon name="mail"/> Mail</button></nav>
      <div className="header-actions">
        <input ref={fileInput} className="sr-only" type="file" accept="application/json" onChange={importJson}/>
        {session.user && view === "edit" && <><button className="icon-button" title="Importer un fichier JSON" onClick={() => fileInput.current?.click()}><Icon name="upload"/></button><button className="icon-button" title="Exporter le point en JSON" onClick={() => exportJson()}><Icon name="download"/></button><button className="secondary-button new-point" onClick={resetPoint}>Nouveau</button><button className="primary-button save-point" disabled={saving || !ready} onClick={savePoint}><Icon name="check"/> {saving ? "Enregistrement…" : "Sauvegarder"}</button></>}
        {!session.user && <button className="login-button" disabled={!sessionReady} onClick={openLogin}><Icon name="lock"/> {sessionReady ? "Connexion édition" : "Vérification…"}</button>}
        {session.user && <div className="editor-profile"><span><Icon name="user" size={15}/></span><div><strong>{session.user.displayName}</strong><small>{session.user.username}</small></div><button onClick={logout}>Déconnexion</button></div>}
      </div>
    </header>
    <div id="top" className="top-strip"><span className="live-dot"/><strong>{market.short}</strong><i/>{isoWeekYear(data.meetingDate)} · S{String(isoWeek(data.meetingDate)).padStart(2, "0")}<i/>{dateLabel(data.meetingDate)}<i/>{isDirty ? "Brouillon" : activeRecordId ? "Enregistré" : "Non enregistré"}<b>{alerts.length ? `${alerts.length} vigilance${alerts.length > 1 ? "s" : ""}` : "Aucune vigilance"}</b></div>
    {view !== "mail" && periodNavigator}
    {view === "edit" && session.user && renderEditor()}
    {view === "read" && <main className="preview-page"><div className="preview-toolbar"><div><span>Lecture générale</span><strong>Choisis le marché et la semaine dans le calendrier ci-dessus.</strong></div><button className="secondary-button" onClick={() => chooseView("edit")}><Icon name={session.user ? "edit" : "lock"}/> {session.user ? "Modifier ce point" : "Connexion GLOBAL pour modifier"}</button></div>{!activeRecordId && <div className="reader-empty-banner"><Icon name="calendar"/><div><strong>Aucun point enregistré pour cette sélection</strong><span>La lecture affiche le brouillon disponible ; une sauvegarde créera le point de cette semaine.</span></div></div>}<PreviewDashboard data={data} market={market}/></main>}
    {view === "mail" && <main className="mail-page"><div className="mail-toolbar"><div><span>Aperçu Outlook</span><strong>Statique, responsive et sans script.</strong><small>{data.mail.to ? `À : ${data.mail.to}` : "Destinataires à compléter dans Paramètres du mail"}</small></div><div><button className="secondary-button" onClick={() => { setSection("mail"); chooseView("edit"); }}><Icon name={session.user ? "edit" : "lock"}/> Paramètres</button><button className="secondary-button" onClick={() => download(`point-marche-mail-${marketId}-${data.meetingDate}.html`, mailHtml, "text/html;charset=utf-8")}><Icon name="download"/> Télécharger HTML</button><button className="primary-button" onClick={copyMail}><Icon name="copy"/> Copier pour Outlook</button></div></div><div className="mail-frame-wrap"><iframe title="Aperçu du mail Outlook" srcDoc={mailHtml}/></div></main>}
    {carryoverOpen && previousPoint && <div className="login-backdrop" onMouseDown={() => setCarryoverOpen(false)}><section className="carryover-dialog" role="dialog" aria-modal="true" aria-labelledby="carryover-title" onMouseDown={(event) => event.stopPropagation()}>
      <button className="login-close" type="button" aria-label="Fermer" onClick={() => setCarryoverOpen(false)}>×</button>
      <div className="carryover-heading"><span className="login-emblem"><Icon name="copy" size={22}/></span><div><span>Reprise sélective</span><h2 id="carryover-title">Reporter le point précédent</h2><p>{market.name} · {previousPoint.year} · S{String(previousPoint.week).padStart(2, "0")} vers {currentWeekYear} · S{String(currentWeek).padStart(2, "0")}</p></div></div>
      <div className="carryover-presets"><button type="button" onClick={() => setCarryoverPreset("unfinished")}><Icon name="alert" size={14}/> Non terminés</button><button type="button" onClick={() => setCarryoverPreset("all")}>Tout sélectionner</button><button type="button" onClick={() => setCarryoverPreset("none")}>Tout retirer</button></div>
      <div className="carryover-content">
        <div className="carryover-group"><div className="carryover-group-title"><span>Dossiers</span><b>{previousPoint.data.dossiers.length}</b></div>{previousPoint.data.dossiers.length ? previousPoint.data.dossiers.map((item) => { const alreadyCarried = data.dossiers.some((current) => (current.sourceId ?? current.id) === (item.sourceId ?? item.id)); return <label className={`carryover-row ${alreadyCarried ? "is-disabled" : ""}`} key={`dossier:${item.id}`}><input type="checkbox" disabled={alreadyCarried} checked={!alreadyCarried && Boolean(carryoverSelection[`dossier:${item.id}`])} onChange={(event) => setCarryoverSelection((current) => ({ ...current, [`dossier:${item.id}`]: event.target.checked }))}/><span><strong>{item.title || "Dossier sans titre"}</strong><small>{[item.universe, item.reference, item.owner].filter(Boolean).join(" · ") || "Contexte à compléter"}</small></span><b className={`tone-text-${toneForStatus(item.status)}`}>{alreadyCarried ? "Déjà reporté" : item.status}</b></label>; }) : <div className="carryover-empty">Aucun dossier dans ce point.</div>}</div>
        <div className="carryover-group"><div className="carryover-group-title"><span>Opérations commerciales</span><b>{previousPoint.data.operations.length}</b></div>{previousPoint.data.operations.length ? previousPoint.data.operations.map((item) => { const alreadyCarried = data.operations.some((current) => (current.sourceId ?? current.id) === (item.sourceId ?? item.id)); return <label className={`carryover-row ${alreadyCarried ? "is-disabled" : ""}`} key={`operation:${item.id}`}><input type="checkbox" disabled={alreadyCarried} checked={!alreadyCarried && Boolean(carryoverSelection[`operation:${item.id}`])} onChange={(event) => setCarryoverSelection((current) => ({ ...current, [`operation:${item.id}`]: event.target.checked }))}/><span><strong>{item.name || "Opération sans titre"}</strong><small>{item.month || "Mois à définir"}</small></span><b className={`tone-text-${toneForStatus(item.state)}`}>{alreadyCarried ? "Déjà reportée" : item.state}</b></label>; }) : <div className="carryover-empty">Aucune opération commerciale dans ce point.</div>}</div>
      </div>
      <div className="carryover-footer"><span>Le point précédent reste intact. Chaque élément repris garde son origine.</span><button className="primary-button" type="button" disabled={!carryoverSelectedCount} onClick={applyCarryover}><Icon name="copy"/> Reporter {carryoverSelectedCount || ""} élément{carryoverSelectedCount > 1 ? "s" : ""}</button></div>
    </section></div>}
    {loginOpen && <div className="login-backdrop" onMouseDown={() => !loginLoading && setLoginOpen(false)}><section className="login-dialog" role="dialog" aria-modal="true" aria-labelledby="login-title" onMouseDown={(event) => event.stopPropagation()}><button className="login-close" type="button" aria-label="Fermer" disabled={loginLoading} onClick={() => setLoginOpen(false)}>×</button><span className="login-emblem"><Icon name="lock" size={22}/></span><div className="login-heading"><span>Accès aux modifications</span><h2 id="login-title">Connexion GLOBAL</h2><p>La lecture reste accessible. Connecte-toi pour modifier et sauvegarder les points marché.</p></div><form onSubmit={submitLogin}><label><span>Compte</span><input autoFocus autoComplete="username" value={loginUsername} onChange={(event) => setLoginUsername(event.target.value)} /></label><label><span>Mot de passe</span><input type="password" autoComplete="current-password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} /></label>{loginError && <div className="login-error"><Icon name="alert" size={15}/>{loginError}</div>}<button className="primary-button login-submit" type="submit" disabled={loginLoading || !loginUsername || !loginPassword}><Icon name="lock"/> {loginLoading ? "Connexion…" : "Se connecter"}</button></form><small className="login-session-note">La session d’édition reste active pendant 12 heures sur cet appareil.</small></section></div>}
    {toast && <div className="toast"><Icon name="check"/>{toast}</div>}
  </div>;
}
