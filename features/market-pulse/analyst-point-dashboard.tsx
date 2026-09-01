"use client";

import { useEffect, useMemo, useState, type DragEvent, type ReactNode } from "react";
import { AppDialog } from "@/components/app-dialog";
import { ModuleLayoutEditor, type ModuleWidth } from "@/components/module-layout-editor";
import { buildAnalystStats, type AnalystStatsMarket } from "@/lib/analyst-stats";
import { fetchAnalystJiraSnapshot, type AnalystJiraSnapshot } from "@/lib/analyst-jira-client";
import { analystJiraTickets, analystPointModules, daysBetween, initialAnalystPoint, isoWeekParts, jiraStatusBreakdown, normalizeAnalystPoint, previousWeekRange, shiftWeek, type AnalystDossier, type AnalystPointData, type AnalystPointModule, type AnalystPointRecord } from "@/lib/analyst-point";
import { buildAnalystJql, type GlobalDirectoryUser } from "@/lib/global-directory";
import { parseJiraAssigneeSummary } from "@/lib/jira-import";
import type { PlannerTask } from "@/lib/planner-import";
import { PlannerImportDialog } from "./planner-import-dialog";

type Mode = "read" | "edit" | "mail";
type Props = {
  users: GlobalDirectoryUser[];
  tasks: PlannerTask[];
  markets: AnalystStatsMarket[];
  plannerUpdatedAt: string;
  onPlannerImport: (rawText: string) => Promise<{ imported: number; message: string }>;
};

const dossierStatuses = ["À faire", "En cours", "En attente", "Fait"];
const uid = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const isIsoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
const closed = (value: string) => /(fait|termin|cl[oô]tur|r[eé]solu|annul)/i.test(value);
const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);

function dateLabel(value: string) {
  if (!isIsoDate(value.slice(0, 10))) return "—";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
}

function percent(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 0 }).format(value);
}

function daysLabel(value: number | null) {
  return value === null ? "—" : `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value)} j`;
}

function movementLabel(value: number | null) {
  if (value === null) return "Pas de comparaison disponible";
  if (!value) return "Stable vs période précédente";
  return `${value > 0 ? "+" : ""}${percent(value)} vs période précédente`;
}

function automaticRecipients(data: AnalystPointData, analyst: GlobalDirectoryUser, manager?: GlobalDirectoryUser) {
  const previous = new Set((data.mail.autoTo ?? []).map((email) => email.toLocaleLowerCase("fr-FR")));
  const manual = data.mail.to.split(/[;,\n]/).map((email) => email.trim()).filter((email) => email && !previous.has(email.toLocaleLowerCase("fr-FR")));
  const autoTo = Array.from(new Set([analyst.email, manager?.email ?? ""].filter(Boolean)));
  return { ...data, mail: { ...data.mail, to: Array.from(new Set([...manual, ...autoTo])).join("; "), autoTo } };
}

function JiraImporter({ analyst, pointDate, onImport }: { analyst: GlobalDirectoryUser; pointDate: string; onImport: (rawText: string) => Promise<number> }) {
  const [open, setOpen] = useState(false);
  const [rawText, setRawText] = useState("");
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const jql = useMemo(() => buildAnalystJql(analyst), [analyst]);
  const parsed = useMemo(() => parseJiraAssigneeSummary(rawText), [rawText]);
  const tickets = useMemo(() => analystJiraTickets(rawText, analyst), [analyst, rawText]);
  const copyJql = async () => {
    if (!jql) return;
    await navigator.clipboard.writeText(jql);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };
  return <>
    <button type="button" className="secondary-button" onClick={() => setOpen(true)}>Importer Jira</button>
    <AppDialog open={open} onClose={() => setOpen(false)} busy={saving} labelledBy="analyst-jira-import-title" className="analyst-jira-import-dialog">
      <div className="analyst-dialog-heading"><span>Tickets ouverts uniquement</span><h2 id="analyst-jira-import-title">Import Jira · {analyst.name}</h2><p>La requête exclut les tickets terminés. L’export est rapproché uniquement avec le USERCODE {analyst.usercode || "à renseigner"}.</p></div>
      <section className="jira-query-card"><div className="jira-query-heading"><div><span>Requête prête à copier</span><strong>{jql ? "USERCODE analyste inclus" : "USERCODE analyste manquant"}</strong></div><button type="button" className="secondary-button" disabled={!jql} onClick={copyJql}>{copied ? "Requête copiée" : "Copier la requête"}</button></div>{jql ? <pre className="jira-query-code">{jql}</pre> : <p>Ajoute un USERCODE valide dans l’annuaire GLOBAL.</p>}</section>
      <label className="analyst-import-paste"><span>Colle l’export détaillé Jira</span><textarea data-autofocus value={rawText} onChange={(event) => { setRawText(event.target.value); setMessage(""); }} placeholder="Clé · ID · État · Résumé · Création · USERCODE · Mise à jour…"/></label>
      <div className="analyst-import-summary"><span>{parsed.detailedTickets.length} ligne{parsed.detailedTickets.length > 1 ? "s" : ""} reconnue{parsed.detailedTickets.length > 1 ? "s" : ""}</span><strong>{tickets.length} ticket{tickets.length > 1 ? "s" : ""} ouvert{tickets.length > 1 ? "s" : ""} pour {analyst.name}</strong><small>Point de référence : {dateLabel(pointDate)}</small></div>
      {tickets.length > 0 && <div className="analyst-import-preview">{tickets.slice(0, 12).map((ticket) => <a href={ticket.link} target="_blank" rel="noreferrer" key={ticket.id}><span>{ticket.key}</span><strong>{ticket.summary}</strong><small>{ticket.status} · modifié le {dateLabel(ticket.updatedAt)}</small></a>)}</div>}
      <div className="paste-actions"><span>{message}</span><div><button type="button" className="secondary-button" disabled={saving} onClick={() => setOpen(false)}>Fermer</button><button type="button" className="primary-button" disabled={saving || !tickets.length} onClick={async () => { setSaving(true); setMessage(""); try { const count = await onImport(rawText); setMessage(`${count} ticket${count > 1 ? "s" : ""} enregistré${count > 1 ? "s" : ""} pour cette semaine.`); if (count) window.setTimeout(() => setOpen(false), 500); } catch (error) { setMessage(error instanceof Error ? error.message : "Import Jira impossible."); } finally { setSaving(false); } }}>{saving ? "Enregistrement…" : "Importer dans le point"}</button></div></div>
    </AppDialog>
  </>;
}

function SafeDateInput({ value, onCommit, min, max }: { value: string; onCommit: (value: string) => void; min?: string; max?: string }) {
  const [draftState, setDraftState] = useState({ source: value, draft: value });
  const draft = draftState.source === value ? draftState.draft : value;
  return <input type="date" value={draft} min={min} max={max} onChange={(event) => { const next = event.target.value; setDraftState({ source: value, draft: next }); if (isIsoDate(next)) onCommit(next); }} onBlur={() => { if (!isIsoDate(draft)) setDraftState({ source: value, draft: value }); }}/>
}

function StockTrend({ records, data }: { records: AnalystPointRecord[]; data: AnalystPointData }) {
  const [horizon, setHorizon] = useState<"1" | "3" | "6" | "12" | "custom">("3");
  const [customFrom, setCustomFrom] = useState(() => shiftWeek(data.periodFrom, -12).from);
  const [customTo, setCustomTo] = useState(data.periodTo);
  const current = { date: data.meetingDate, label: `S${String(isoWeekParts(data.meetingDate).week).padStart(2, "0")}`, value: data.jira.length };
  const cutoff = useMemo(() => {
    if (horizon === "custom") return customFrom;
    const date = new Date(`${data.meetingDate}T12:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() - Number(horizon));
    return date.toISOString().slice(0, 10);
  }, [customFrom, data.meetingDate, horizon]);
  const points = records.filter((record) => record.meetingDate >= cutoff && (horizon !== "custom" || record.meetingDate <= customTo)).sort((left, right) => left.meetingDate.localeCompare(right.meetingDate)).map((record) => ({ date: record.meetingDate, label: `S${String(record.week).padStart(2, "0")}`, value: record.data.jira.length })).filter((point) => point.date !== current.date);
  points.push(current);
  const max = Math.max(1, ...points.map((point) => point.value));
  const previous = points.at(-2)?.value;
  const delta = previous === undefined ? null : current.value - previous;
  return <article className="analyst-stock-trend"><header><div><span>Stock Jira ouvert</span><strong>Évolution des points sauvegardés</strong></div><select value={horizon} onChange={(event) => setHorizon(event.target.value as typeof horizon)}><option value="1">1 mois</option><option value="3">3 mois</option><option value="6">6 mois</option><option value="12">1 an</option><option value="custom">Période donnée</option></select></header>{horizon === "custom" && <div className="analyst-custom-range"><SafeDateInput value={customFrom} onCommit={setCustomFrom} max={customTo}/><span>→</span><SafeDateInput value={customTo} onCommit={setCustomTo} min={customFrom}/></div>}<div className="analyst-stock-chart">{points.map((point, index) => <div key={`${point.date}-${index}`} className={index === points.length - 1 ? "current" : ""}><b>{point.value}</b><span><i style={{ height: `${Math.max(8, point.value / max * 100)}%` }}/></span><small>{point.label}</small></div>)}</div><footer><span>Écart vs point précédent</span><strong>{delta === null ? "—" : `${delta > 0 ? "+" : ""}${delta}`}</strong><small>{points.length > 1 ? `${points.length} points affichés` : "Première mesure"}</small></footer></article>;
}

function dossierCard(item: AnalystDossier, edit: boolean, update: (patch: Partial<AnalystDossier>) => void, remove: () => void) {
  if (edit) return <article className="surface analyst-dossier-editor" key={item.id}><header><div><strong>{item.title || "Nouveau dossier"}</strong><small>{item.status}</small></div><button type="button" className="icon-button danger" onClick={remove}>×</button></header><div className="form-grid"><label className="field"><span>Titre</span><input value={item.title} onChange={(event) => update({ title: event.target.value })}/></label><label className="field"><span>Statut</span><select value={item.status} onChange={(event) => update({ status: event.target.value })}>{dossierStatuses.map((status) => <option key={status}>{status}</option>)}</select></label><label className="field"><span>Échéance</span><input type="date" value={item.deadline} onChange={(event) => update({ deadline: event.target.value })}/></label><label className="field"><span>Avancement</span><input type="range" min="0" max="100" step="5" value={item.progress} onChange={(event) => update({ progress: Number(event.target.value) })}/></label><label className="field field-wide"><span>Action</span><textarea value={item.action} onChange={(event) => update({ action: event.target.value })}/></label><label className="field field-wide"><span>Commentaire</span><textarea value={item.comment} onChange={(event) => update({ comment: event.target.value })}/></label><label className="progress-visibility-toggle field-wide"><input type="checkbox" checked={item.showProgress} onChange={(event) => update({ showProgress: event.target.checked })}/><span><strong>Afficher l’avancement dans le point</strong><small>La barre reste masquée si cette option n’est pas cochée.</small></span></label></div></article>;
  return <article className="analyst-dossier-card" key={item.id}><span className={`analyst-status-dot status-${item.status === "Fait" ? "done" : item.status === "En attente" ? "waiting" : item.status === "À faire" ? "todo" : "active"}`}/><div><strong>{item.title || "Dossier sans titre"}</strong><small>{item.action || item.comment || "Action à compléter"}</small>{item.showProgress && <div className="analyst-progress"><span><i style={{ width: `${Math.max(0, Math.min(100, item.progress))}%` }}/></span><b>{item.progress}%</b></div>}</div><span>{item.status}</span></article>;
}

function analystMailHtml(data: AnalystPointData, analyst: GlobalDirectoryUser, stats: ReturnType<typeof buildAnalystStats>, cycleStats: ReturnType<typeof buildAnalystStats>) {
  const modules = data.preferences.mailModules;
  const jiraStatuses = jiraStatusBreakdown(data.jira);
  const section = (title: string, body: string) => `<tr><td style="padding:0 28px 16px"><table width="100%" role="presentation" cellspacing="0" cellpadding="0" style="border:1px solid #DDE6E3;border-radius:12px"><tr><td style="padding:15px 17px 8px;color:#36534B;font-size:11px;font-weight:700;text-transform:uppercase">${title}</td></tr><tr><td style="padding:0 17px 14px">${body}</td></tr></table></td></tr>`;
  const jiraRows = data.jira.slice().sort((left, right) => daysBetween(right.updatedAt, data.meetingDate) - daysBetween(left.updatedAt, data.meetingDate)).map((ticket) => { const days = daysBetween(ticket.updatedAt, data.meetingDate); const color = days >= data.preferences.jiraCriticalDays ? "#B42318" : days >= data.preferences.jiraWarningDays ? "#9A5B13" : "#47615A"; return `<tr><td style="padding:9px;border-bottom:1px solid #EDF1EF"><a href="${escapeHtml(ticket.link)}" style="color:#126887;font-weight:700">${escapeHtml(ticket.key)}</a></td><td style="padding:9px;border-bottom:1px solid #EDF1EF;color:#253D36;font-size:11px">${escapeHtml(ticket.summary)}</td><td style="padding:9px;border-bottom:1px solid #EDF1EF;color:${color};font-size:10px;font-weight:700">${days} j sans activité</td></tr>`; }).join("");
  const resolvedRows = data.jiraResolved.map((ticket) => `<tr><td style="padding:9px;border-bottom:1px solid #EDF1EF"><a href="${escapeHtml(ticket.link)}" style="color:#126887;font-weight:700">${escapeHtml(ticket.key)}</a></td><td style="padding:9px;border-bottom:1px solid #EDF1EF;color:#253D36;font-size:11px">${escapeHtml(ticket.summary)}</td><td style="padding:9px;border-bottom:1px solid #EDF1EF;color:#1E7A5C;font-size:10px;font-weight:700">Modifié le ${escapeHtml(dateLabel(ticket.updatedAt))}</td></tr>`).join("");
  const noResolvedMail = '<tr><td style="padding:9px;color:#71817D;font-size:11px">Aucun ticket terminé pendant cette semaine.</td></tr>';
  const activityRows = stats.contributions.map((item) => `<tr><td style="padding:9px;border-bottom:1px solid #EDF1EF;color:#5A6D67;font-size:10px">${escapeHtml(dateLabel(item.date))}</td><td style="padding:9px;border-bottom:1px solid #EDF1EF;color:#253D36;font-size:11px;font-weight:700">${escapeHtml(item.taskName)}</td><td style="padding:9px;border-bottom:1px solid #EDF1EF;color:#36534B;font-size:10px">${item.specialty === "simulation" ? "Simulation" : "Contrôle"}</td></tr>`).join("");
  const dossierRows = data.dossiers.map((item) => `<tr><td style="padding:9px;border-bottom:1px solid #EDF1EF;color:#253D36;font-size:11px;font-weight:700">${escapeHtml(item.title || "Dossier")}</td><td style="padding:9px;border-bottom:1px solid #EDF1EF;color:#5A6D67;font-size:10px">${escapeHtml(item.action || item.comment || "—")}</td><td style="padding:9px;border-bottom:1px solid #EDF1EF;color:#36534B;font-size:10px">${escapeHtml(item.status)}</td></tr>`).join("");
  const sections: Record<AnalystPointModule, string> = {
    overview: section("Synthèse", `<p style="margin:0;color:#253D36;font-size:12px;line-height:18px">${escapeHtml(data.note || "Aucun message particulier.")}</p>`),
    jira: section("Activité Jira", `<p style="margin:0 0 8px;color:#36534B;font-size:10px;font-weight:700;text-transform:uppercase">${data.jira.length} ticket(s) non terminé(s) attribué(s)</p><table width="100%" role="presentation" cellspacing="0" cellpadding="0" style="margin-bottom:10px"><tr>${jiraStatuses.map((item) => `<td style="padding:9px;background:#F4F7F6;border-right:4px solid #FFFFFF"><b style="display:block;font-size:17px">${item.count}</b><span style="color:#61736E;font-size:9px">${escapeHtml(item.status)}</span></td>`).join("") || '<td style="padding:9px;color:#71817D;font-size:11px">Aucun ticket attribué non terminé.</td>'}</tr></table><table width="100%" role="presentation" cellspacing="0" cellpadding="0">${jiraRows || '<tr><td style="padding:9px;color:#71817D;font-size:11px">Aucun ticket attribué non terminé.</td></tr>'}</table><p style="margin:16px 0 8px;color:#1E7A5C;font-size:10px;font-weight:700;text-transform:uppercase">${data.jiraResolved.length} ticket(s) terminé(s) pendant la semaine · dernière modification</p><table width="100%" role="presentation" cellspacing="0" cellpadding="0">${resolvedRows || noResolvedMail}</table>`),
    planner: section("Simulations et contrôles", `<table width="100%" role="presentation" cellspacing="0" cellpadding="0">${activityRows || '<tr><td style="padding:9px;color:#71817D;font-size:11px">Aucune activité sur la période.</td></tr>'}</table>`),
    cycle20: data.includeCycle20 ? section("Repère 20 → 20", `<p style="margin:0;color:#253D36;font-size:12px">${cycleStats.simulations} simulation(s) · ${cycleStats.controls} contrôle(s) · ${cycleStats.distinctTasks} tâche(s)</p>`) : "",
    dossiers: section("Dossiers", `<table width="100%" role="presentation" cellspacing="0" cellpadding="0">${dossierRows || '<tr><td style="padding:9px;color:#71817D;font-size:11px">Aucun dossier.</td></tr>'}</table>`),
  };
  const kpis = [[data.jira.length, "Non terminés attribués"], [data.jiraResolved.length, "Terminés semaine"], [stats.simulations, "Simulations"], [stats.controls, "Contrôles"]];
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(data.mail.subject)}</title></head><body style="margin:0;background:#FFFFFF;font-family:Arial,sans-serif;color:#10201D"><table width="100%" role="presentation" cellspacing="0" cellpadding="0" style="background:#FFFFFF"><tr><td align="center" style="padding:24px 10px"><table width="900" role="presentation" cellspacing="0" cellpadding="0" style="width:100%;max-width:900px;border:1px solid #DDE6E3;border-top:5px solid #72F5C5"><tr><td style="padding:25px 28px 18px"><span style="color:#46615A;font-size:10px;font-weight:700;text-transform:uppercase">Market Pulse / Point analyste</span><h1 style="margin:7px 0 4px;font-size:30px">${escapeHtml(analyst.name)}</h1><p style="margin:0;color:#5E726C;font-size:12px">${escapeHtml(dateLabel(data.periodFrom))} → ${escapeHtml(dateLabel(data.periodTo))}</p><p style="margin:16px 0 0;color:#41534E;font-size:12px;line-height:18px">${escapeHtml(data.mail.intro)}</p></td></tr><tr><td style="padding:0 28px 16px"><table width="100%" role="presentation" cellspacing="0" cellpadding="0"><tr>${kpis.map(([value, label], index) => `<td width="25%" style="padding-right:${index < 3 ? "8px" : "0"}"><table width="100%" role="presentation" style="background:#F4F7F6;border:1px solid #DDE6E3"><tr><td style="padding:13px"><b style="display:block;font-size:22px">${value}</b><span style="color:#61736E;font-size:9px;text-transform:uppercase">${label}</span></td></tr></table></td>`).join("")}</tr></table></td></tr>${data.preferences.order.filter((module) => modules[module]).map((module) => sections[module]).join("")}<tr><td style="padding:17px 28px;border-top:1px solid #E7EDEA;color:#71817D;font-size:9px;text-transform:uppercase">Source : imports Jira et Planner enregistrés dans Market Pulse</td></tr></table></td></tr></table></body></html>`;
}

function analystInteractiveHtml(data: AnalystPointData, analyst: GlobalDirectoryUser, stats: ReturnType<typeof buildAnalystStats>) {
  const jiraStatuses = jiraStatusBreakdown(data.jira).map((item) => `<article><b>${item.count}</b><span>${escapeHtml(item.status)}</span></article>`).join("");
  const tickets = data.jira.map((ticket) => `<details><summary><b>${escapeHtml(ticket.key)}</b><span>${escapeHtml(ticket.status)} · ${daysBetween(ticket.updatedAt, data.meetingDate)} j sans activité</span></summary><p>${escapeHtml(ticket.summary)}</p><a href="${escapeHtml(ticket.link)}" target="_blank">Ouvrir dans Jira ↗</a></details>`).join("");
  const resolvedTickets = data.jiraResolved.map((ticket) => `<details><summary><b>${escapeHtml(ticket.key)}</b><span>Modifié le ${escapeHtml(dateLabel(ticket.updatedAt))}</span></summary><p>${escapeHtml(ticket.summary)}</p><a href="${escapeHtml(ticket.link)}" target="_blank">Ouvrir dans Jira ↗</a></details>`).join("");
  const noResolvedHtml = "<p>Aucun ticket terminé pendant cette semaine.</p>";
  const activities = stats.contributions.map((item) => `<article><b>${escapeHtml(item.taskName)}</b><span>${escapeHtml(item.specialty === "simulation" ? "Simulation" : "Contrôle")} · ${escapeHtml(dateLabel(item.date))}</span></article>`).join("");
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(data.mail.subject)}</title><style>body{margin:0;background:#f4f7f6;color:#14231f;font-family:Arial,sans-serif}.shell{width:min(1100px,calc(100% - 32px));margin:24px auto}.hero,.panel{padding:24px;border:1px solid #dce6e2;border-radius:16px;background:#fff}.hero{border-top:5px solid #45d8a4}.hero span,.panel>span{color:#397866;font-size:11px;font-weight:700;text-transform:uppercase}.hero h1{margin:7px 0}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:15px;margin-top:15px}.panel{min-width:0}.panel h2{margin:6px 0 14px}.status-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-bottom:14px}.status-grid article{margin:0}.status-grid b{font-size:20px}.subhead{display:block;margin-top:18px;color:#1e7a5c;font-size:11px;font-weight:700;text-transform:uppercase}details,article{margin-top:8px;padding:12px;border:1px solid #e2e9e6;border-radius:11px;background:#fafcfb}summary{display:flex;justify-content:space-between;gap:12px;cursor:pointer}details p,article span{display:block;color:#65756f;font-size:12px;line-height:1.5}a{color:#08779a;font-weight:700}@media(max-width:760px){.grid{grid-template-columns:1fr}}</style></head><body><main class="shell"><header class="hero"><span>Market Pulse / Point analyste</span><h1>${escapeHtml(analyst.name)}</h1><p>${escapeHtml(dateLabel(data.periodFrom))} → ${escapeHtml(dateLabel(data.periodTo))}</p><strong>${escapeHtml(data.note)}</strong></header><div class="grid">${data.preferences.htmlModules.jira ? `<section class="panel"><span>Jira attribué</span><h2>${data.jira.length} tickets non terminés</h2><div class="status-grid">${jiraStatuses || "<p>Aucun ticket attribué non terminé.</p>"}</div>${tickets}<b class="subhead">${data.jiraResolved.length} terminé(s) pendant la semaine · dernière modification</b>${resolvedTickets || noResolvedHtml}</section>` : ""}${data.preferences.htmlModules.planner ? `<section class="panel"><span>Planner</span><h2>${stats.totalActivities} activités</h2>${activities || "<p>Aucune activité sur la période.</p>"}</section>` : ""}</div></main></body></html>`;
}

export function AnalystPointDashboard({ users, tasks, markets, plannerUpdatedAt, onPlannerImport }: Props) {
  const analysts = useMemo(() => users.filter((user) => user.role === "analyste-tarif-referentiel").sort((left, right) => left.name.localeCompare(right.name, "fr")), [users]);
  const manager = users.find((user) => user.role === "manager-tarif");
  const [analystId, setAnalystId] = useState(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("market-pulse:analyst-id") : "";
    return analysts.some((item) => item.id === stored) ? stored ?? "" : analysts[0]?.id ?? "";
  });
  const analyst = analysts.find((user) => user.id === analystId) ?? analysts[0];
  const [data, setData] = useState<AnalystPointData | null>(() => analyst ? initialAnalystPoint(analyst, manager) : null);
  const [records, setRecords] = useState<AnalystPointRecord[]>([]);
  const [mode, setMode] = useState<Mode>("read");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [activeRecordId, setActiveRecordId] = useState("");
  const [jiraReload, setJiraReload] = useState(0);
  const [jiraLoad, setJiraLoad] = useState({ key: "", error: "" });
  const jiraAnalystId = analyst?.id ?? "";
  const jiraPointDate = data?.meetingDate ?? "";
  const jiraKey = !loading && data?.analystId === jiraAnalystId && jiraAnalystId && jiraPointDate
    ? `${jiraAnalystId}:${jiraPointDate}:${jiraReload}` : "";
  const jiraLoading = loading || Boolean(jiraKey && jiraLoad.key !== jiraKey);
  const jiraError = jiraKey && jiraLoad.key === jiraKey ? jiraLoad.error : "";
  const jiraUnavailable = jiraLoading || Boolean(jiraError);

  useEffect(() => {
    if (!analyst) return;
    window.localStorage.setItem("market-pulse:analyst-id", analyst.id);
    let active = true;
    void fetch(`/api/analyst-points?analystId=${encodeURIComponent(analyst.id)}`, { cache: "no-store" }).then(async (response) => {
      const payload = await response.json() as { points?: AnalystPointRecord[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Chargement impossible.");
      if (!active) return;
      const normalized = (payload.points ?? []).map((record) => ({ ...record, data: automaticRecipients(normalizeAnalystPoint(record.data, analyst, manager), analyst, manager) }));
      setRecords(normalized);
      const previous = previousWeekRange();
      const period = isoWeekParts(previous.to);
      const matching = normalized.find((record) => record.year === period.year && record.week === period.week);
      const next = matching?.data ?? initialAnalystPoint(analyst, manager);
      setData(automaticRecipients(next, analyst, manager));
      setActiveRecordId(matching?.id ?? "");
    }).catch((error) => { if (active) { setRecords([]); setData(initialAnalystPoint(analyst, manager)); setToast(error instanceof Error ? error.message : "Chargement impossible."); } }).finally(() => { if (active) { setLoading(false); setJiraReload((current) => current + 1); } });
    return () => { active = false; };
  }, [analyst, manager]);
  useEffect(() => {
    if (!jiraKey) return;
    const controller = new AbortController();
    let active = true;
    void fetchAnalystJiraSnapshot(jiraAnalystId, isoWeekParts(jiraPointDate), controller.signal).then((snapshot) => {
      if (!active) return;
      if (snapshot) setData((current) => current?.analystId === jiraAnalystId && current.meetingDate === jiraPointDate
        ? { ...current, jira: snapshot.tickets, jiraResolved: snapshot.resolvedTickets ?? [] } : current);
      setJiraLoad({ key: jiraKey, error: "" });
    }).catch((error) => {
      if (active) setJiraLoad({ key: jiraKey, error: error instanceof Error ? error.message : "Chargement Jira impossible." });
    });
    return () => { active = false; controller.abort(); };
  }, [jiraKey, jiraAnalystId, jiraPointDate]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(""), 2800); return () => window.clearTimeout(timer); }, [toast]);

  const stats = useMemo(() => data && analyst ? buildAnalystStats(tasks, users, markets, { from: data.periodFrom, to: data.periodTo, marketId: "all", specialty: "all", analystIds: [analyst.id] }) : null, [analyst, data, markets, tasks, users]);
  const cycleStats = useMemo(() => data && analyst ? buildAnalystStats(tasks, users, markets, { from: data.cycleFrom, to: data.cycleTo, marketId: "all", specialty: "all", analystIds: [analyst.id] }) : null, [analyst, data, markets, tasks, users]);
  const mailHtml = useMemo(() => data && analyst && stats && cycleStats ? analystMailHtml(data, analyst, stats, cycleStats) : "", [analyst, cycleStats, data, stats]);
  const interactiveHtml = useMemo(() => data && analyst && stats ? analystInteractiveHtml(data, analyst, stats) : "", [analyst, data, stats]);
  if (!analyst || !data || data.analystId !== analyst.id || !stats || !cycleStats) return <main className="analyst-point-page"><div className="surface analyst-point-empty"><strong>{analysts.length ? "Chargement du point analyste…" : "Aucun analyste tarifaire dans l’annuaire"}</strong><span>{analysts.length ? "Récupération de l’historique hebdomadaire." : "Ajoute au moins une personne avec le rôle Analyste tarif et référentiel."}</span></div></main>;

  const period = isoWeekParts(data.meetingDate);
  const previousRecord = records.filter((record) => record.year < period.year || (record.year === period.year && record.week < period.week)).sort((left, right) => right.year - left.year || right.week - left.week)[0];
  const jiraRows = data.jira.map((ticket) => ({ ticket, inactivity: daysBetween(ticket.updatedAt, data.meetingDate) })).sort((left, right) => right.inactivity - left.inactivity);
  const jiraWarning = jiraRows.filter((row) => row.inactivity >= data.preferences.jiraWarningDays && row.inactivity < data.preferences.jiraCriticalDays).length;
  const jiraCritical = jiraRows.filter((row) => row.inactivity >= data.preferences.jiraCriticalDays).length;
  const jiraStatuses = jiraStatusBreakdown(data.jira);
  const groupedActivities = Array.from(new Map(stats.contributions.map((item) => [item.taskId, { taskId: item.taskId, taskName: item.taskName, date: item.date, activities: stats.contributions.filter((candidate) => candidate.taskId === item.taskId) }])).values()).sort((left, right) => right.date.localeCompare(left.date));
  const updateData = (patch: Partial<AnalystPointData>) => setData((current) => current ? { ...current, ...patch } : current);
  const updateDossier = (id: string, patch: Partial<AnalystDossier>) => updateData({ dossiers: data.dossiers.map((item) => item.id === id ? { ...item, ...patch } : item) });
  const chooseWeek = (amount: number) => {
    const nextRange = shiftWeek(data.periodFrom, amount);
    const nextParts = isoWeekParts(nextRange.to);
    const saved = records.find((record) => record.year === nextParts.year && record.week === nextParts.week);
    const next = saved?.data ?? initialAnalystPoint(analyst, manager);
    if (!saved) { next.periodFrom = nextRange.from; next.periodTo = nextRange.to; next.meetingDate = nextRange.to; next.preferences = data.preferences; next.mail = data.mail; }
    setData(automaticRecipients(next, analyst, manager));
    setActiveRecordId(saved?.id ?? "");
    setJiraReload((current) => current + 1);
  };

  const importAnalystJira = async (rawText: string) => {
    const currentPeriod = isoWeekParts(data.meetingDate);
    const response = await fetch("/api/analyst-jira", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ analystId: analyst.id, year: currentPeriod.year, week: currentPeriod.week, rawText }) });
    const payload = await response.json() as { snapshot?: AnalystJiraSnapshot; imported?: number; error?: string };
    if (!response.ok || !payload.snapshot) throw new Error(payload.error || "Import Jira impossible.");
    updateData({ jira: payload.snapshot.tickets });
    setJiraReload((current) => current + 1);
    return payload.imported ?? payload.snapshot.tickets.length;
  };
  const save = async () => {
    if (saving || jiraUnavailable) return;
    setSaving(true);
    try {
      const response = await fetch("/api/analyst-points", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ analystId: analyst.id, data }) });
      const payload = await response.json() as { point?: AnalystPointRecord; error?: string };
      if (!response.ok || !payload.point) throw new Error(payload.error || "Sauvegarde impossible.");
      const saved = { ...payload.point, data: normalizeAnalystPoint(payload.point.data, analyst, manager) };
      setRecords((current) => [saved, ...current.filter((record) => !(record.year === saved.year && record.week === saved.week))].sort((left, right) => right.year - left.year || right.week - left.week));
      setActiveRecordId(saved.id); setToast(`${saved.year} · S${String(saved.week).padStart(2, "0")} enregistrée.`);
    } catch (error) { setToast(error instanceof Error ? error.message : "Sauvegarde impossible."); }
    finally { setSaving(false); }
  };
  const carryPrevious = () => {
    if (!previousRecord) return setToast("Aucun point précédent disponible.");
    const known = new Set(data.dossiers.map((item) => item.sourceId ?? item.id));
    const carried = previousRecord.data.dossiers.filter((item) => !closed(item.status) && !known.has(item.sourceId ?? item.id)).map((item) => ({ ...item, id: uid(), sourceId: item.sourceId ?? item.id, carriedFromYear: previousRecord.year, carriedFromWeek: previousRecord.week }));
    updateData({ dossiers: [...data.dossiers, ...carried] });
    setToast(carried.length ? `${carried.length} dossier${carried.length > 1 ? "s" : ""} non terminé${carried.length > 1 ? "s" : ""} repris.` : "Aucun dossier non terminé à reprendre.");
  };
  const setPeriod = (patch: Partial<Pick<AnalystPointData, "periodFrom" | "periodTo">>) => updateData({ ...patch, meetingDate: patch.periodTo ?? data.periodTo });
  const setLayoutOrder = (order: AnalystPointModule[]) => updateData({ preferences: { ...data.preferences, order } });
  const setLayoutWidth = (id: AnalystPointModule, width: ModuleWidth) => updateData({ preferences: { ...data.preferences, widths: { ...data.preferences.widths, [id]: width } } });
  const setVisibility = (destination: "readModules" | "mailModules" | "htmlModules", id: AnalystPointModule, checked: boolean) => updateData({ preferences: { ...data.preferences, [destination]: { ...data.preferences[destination], [id]: checked } } });
  const download = (name: string, content: string) => { const url = URL.createObjectURL(new Blob([content], { type: "text/html;charset=utf-8" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 500); };
  const attachmentName = `point-analyste-${analyst.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${period.year}-S${String(period.week).padStart(2, "0")}.html`;
  const copyMail = async () => { try { await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([mailHtml], { type: "text/html" }), "text/plain": new Blob([`${data.mail.intro}\n\n${data.note}`], { type: "text/plain" }) })]); setToast("Corps du mail copié."); } catch { setToast("Copie bloquée : utilise l’aperçu ou le fichier HTML."); } };
  const dragHtml = (event: DragEvent<HTMLElement>) => { const url = URL.createObjectURL(new Blob([interactiveHtml], { type: "text/html;charset=utf-8" })); event.dataTransfer.setData("DownloadURL", `text/html:${attachmentName}:${url}`); event.dataTransfer.setData("text/plain", attachmentName); window.setTimeout(() => URL.revokeObjectURL(url), 60000); };

  const overviewModule = <section className="analyst-point-module analyst-overview-module"><header><span>Synthèse de la semaine</span><strong>{data.note}</strong></header><div className="analyst-point-kpis"><article><span>Non terminés attribués</span><strong>{jiraUnavailable ? "—" : data.jira.length}</strong><small>{jiraUnavailable ? "Données Jira en attente" : jiraCritical ? `${jiraCritical} en attention forte` : "Aucune attention forte"}</small></article><article className="resolved"><span>Terminés semaine</span><strong>{jiraUnavailable ? "—" : data.jiraResolved.length}</strong><small>{jiraUnavailable ? "Données Jira en attente" : "Selon la dernière modification Jira"}</small></article><article><span>Simulations</span><strong>{stats.simulations}</strong><small>{movementLabel(stats.movement)}</small></article><article><span>Contrôles</span><strong>{stats.controls}</strong><small>{stats.distinctTasks} tâche{stats.distinctTasks > 1 ? "s" : ""} distincte{stats.distinctTasks > 1 ? "s" : ""}</small></article><article><span>Dossiers actifs</span><strong>{data.dossiers.filter((item) => !closed(item.status)).length}</strong><small>{data.dossiers.length} au total</small></article></div></section>;
  const jiraModule = jiraUnavailable ? <section className="analyst-point-module analyst-jira-module" aria-busy={jiraLoading}><header><div><span>Jira · activité hebdomadaire</span><h2>Tickets de {analyst.name}</h2></div></header><div className="analyst-module-empty">{jiraLoading ? "Chargement depuis le registre Jira…" : "Les tickets ne peuvent pas être affichés tant que le chargement n’a pas réussi."}</div></section> : <section className="analyst-point-module analyst-jira-module"><header><div><span>Jira · activité hebdomadaire</span><h2>Tickets de {analyst.name}</h2><p>Le stock non terminé est limité aux tickets attribués. Les terminés sont rattachés à la semaine par leur dernière modification Jira.</p></div><div className="analyst-jira-signals"><span><b>{jiraWarning}</b> à surveiller</span><span className="critical"><b>{jiraCritical}</b> attention forte</span><span className="resolved"><b>{data.jiraResolved.length}</b> terminés semaine</span></div></header><StockTrend records={records} data={data}/><div className="analyst-jira-subtitle"><div><span>Stock attribué actuel</span><strong>{data.jira.length} ticket{data.jira.length > 1 ? "s" : ""} non terminé{data.jira.length > 1 ? "s" : ""}</strong></div><small>Ventilation selon l’état Jira et alertes depuis la dernière modification.</small></div>{jiraStatuses.length ? <div className="analyst-jira-status-grid">{jiraStatuses.map((item) => <article key={item.status}><strong>{item.count}</strong><span>{item.status}</span></article>)}</div> : <div className="analyst-module-empty">Aucun ticket attribué non terminé.</div>}{jiraRows.length ? <div className="analyst-jira-list">{jiraRows.map(({ ticket, inactivity }) => <a key={ticket.id} className={inactivity >= data.preferences.jiraCriticalDays ? "critical" : inactivity >= data.preferences.jiraWarningDays ? "warning" : "fresh"} href={ticket.link} target="_blank" rel="noreferrer"><span>{ticket.key}</span><div><strong>{ticket.summary}</strong><small>{ticket.status} · créé le {dateLabel(ticket.createdAt)}</small></div><b>{inactivity ? `${inactivity} j sans activité` : "À jour"}</b></a>)}</div> : null}<div className="analyst-jira-subtitle resolved"><div><span>Tickets terminés dans la semaine</span><strong>{data.jiraResolved.length} ticket{data.jiraResolved.length > 1 ? "s" : ""} terminé{data.jiraResolved.length > 1 ? "s" : ""}</strong></div><small>Semaine déterminée par la dernière modification Jira.</small></div>{data.jiraResolved.length ? <div className="analyst-jira-list analyst-jira-resolved-list">{data.jiraResolved.map((ticket) => <a key={`resolved-${ticket.id}`} className="resolved" href={ticket.link} target="_blank" rel="noreferrer"><span>{ticket.key}</span><div><strong>{ticket.summary}</strong><small>{ticket.status} · créé le {dateLabel(ticket.createdAt)}</small></div><b>Modifié le {dateLabel(ticket.updatedAt)}</b></a>)}</div> : <div className="analyst-module-empty">Aucun ticket terminé pendant la semaine sélectionnée.</div>}</section>;
  const plannerModule = <section className="analyst-point-module analyst-planner-module"><header><div><span>Planner</span><h2>Simulations et contrôles</h2><p>{dateLabel(data.periodFrom)} → {dateLabel(data.periodTo)} · source actualisée {plannerUpdatedAt ? new Date(plannerUpdatedAt.replace(" ", "T") + (plannerUpdatedAt.includes("Z") ? "" : "Z")).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "non importée"}</p></div><div className="analyst-planner-total"><strong>{stats.totalActivities}</strong><span>activités</span></div></header><div className="analyst-delay-grid">{stats.delaySummaries.map((delay) => <article key={delay.kind}><span>{delay.label}</span><strong>{daysLabel(delay.average)}</strong><small>{delay.previousAverage === null || delay.average === null ? "Pas de comparaison" : `${delay.average - delay.previousAverage > 0 ? "+" : ""}${daysLabel(delay.average - delay.previousAverage)} vs période précédente`}</small><b>{delay.sampleCount} dossier{delay.sampleCount > 1 ? "s" : ""}</b></article>)}</div>{groupedActivities.length ? <div className="analyst-activity-list">{groupedActivities.map((task) => <article key={task.taskId}><div><strong>{task.taskName}</strong><small>{task.activities.map((item) => item.marketIds.map((id) => markets.find((market) => market.id === id)?.name).filter(Boolean).join(" · ")).filter(Boolean).join(" · ") || "Marché non rapproché"}</small></div><div>{task.activities.map((item, index) => <span className={item.specialty} key={`${item.taskId}-${item.specialty}-${index}`}>{item.specialty === "simulation" ? "Simulation" : "Contrôle"} · {dateLabel(item.date)}</span>)}</div></article>)}</div> : <div className="analyst-module-empty">Aucune simulation ou contrôle attribué à cet analyste sur la période.</div>}</section>;
  const cycleModule = <section className="analyst-point-module analyst-cycle-module"><header><span>Repère séparé</span><h2>Cycle du 20 au 20</h2><p>{dateLabel(data.cycleFrom)} → {dateLabel(data.cycleTo)}</p></header><div><article><span>Simulations</span><strong>{cycleStats.simulations}</strong></article><article><span>Contrôles</span><strong>{cycleStats.controls}</strong></article><article><span>Tâches</span><strong>{cycleStats.distinctTasks}</strong></article></div><small>Ce bloc ne s’ajoute pas aux totaux de la semaine : il sert uniquement de repère complémentaire.</small></section>;
  const dossiersModule = <section className="analyst-point-module analyst-dossiers-module"><header><div><span>Suivis manuels</span><h2>Dossiers</h2></div><strong>{data.dossiers.filter((item) => !closed(item.status)).length} actif{data.dossiers.filter((item) => !closed(item.status)).length > 1 ? "s" : ""}</strong></header>{data.dossiers.length ? <div>{data.dossiers.map((item) => dossierCard(item, false, () => undefined, () => undefined))}</div> : <div className="analyst-module-empty">Aucun dossier renseigné.</div>}</section>;
  const moduleContent: Record<AnalystPointModule, ReactNode> = { overview: overviewModule, jira: jiraModule, planner: plannerModule, cycle20: cycleModule, dossiers: dossiersModule };

  return <main className="analyst-point-page">
    <header className="analyst-point-hero"><div><span>Point analyste</span><h1>{analyst.name}</h1><p>Suivi descriptif de l’activité et des dossiers, sans objectif individuel.</p></div><div className="analyst-point-controls"><label><span>Analyste</span><select value={analyst.id} onChange={(event) => { setLoading(true); setAnalystId(event.target.value); }}>{analysts.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><div className="analyst-week-control"><button type="button" disabled={loading} aria-label="Semaine précédente" onClick={() => chooseWeek(-1)}>←</button><div><span>{period.year}</span><strong>S{String(period.week).padStart(2, "0")}</strong><small>{dateLabel(data.periodFrom)} → {dateLabel(data.periodTo)}</small></div><button type="button" disabled={loading} aria-label="Semaine suivante" onClick={() => chooseWeek(1)}>→</button></div></div></header>
    <div className="analyst-point-toolbar"><div className="segmented-control"><button type="button" className={mode === "read" ? "active" : ""} onClick={() => setMode("read")}>Lecture</button><button type="button" className={mode === "edit" ? "active" : ""} onClick={() => setMode("edit")}>Préparation</button><button type="button" className={mode === "mail" ? "active" : ""} onClick={() => setMode("mail")}>Mail</button></div><div><span className={activeRecordId ? "analyst-saved-state saved" : "analyst-saved-state"}>{loading ? "Chargement…" : activeRecordId ? "Semaine enregistrée" : "Nouveau brouillon"}</span><button type="button" className="primary-button" disabled={saving || jiraUnavailable} onClick={save}>{saving ? "Enregistrement…" : "Sauvegarder la semaine"}</button></div></div>

    {jiraUnavailable && <section className={`analyst-jira-load-state${jiraError ? " error" : ""}`} role={jiraError ? "alert" : "status"}><div><strong>{jiraLoading ? "Chargement des tickets Jira…" : "Tickets Jira non chargés"}</strong><span>{jiraLoading ? "Rapprochement avec le registre global pour la semaine sélectionnée." : jiraError}</span>{jiraError && <small>La sauvegarde et l’export du point attendent le chargement des tickets pour éviter des chiffres incomplets.</small>}</div>{jiraError && <button type="button" className="secondary-button" onClick={() => setJiraReload((current) => current + 1)}>Réessayer</button>}</section>}

    {mode === "read" && <div className="analyst-render-grid">{data.preferences.order.filter((module) => data.preferences.readModules[module] && (module !== "cycle20" || data.includeCycle20)).map((module) => <div key={module} className={`analyst-render-item width-${data.preferences.widths[module]}`}>{moduleContent[module]}</div>)}</div>}

    {mode === "edit" && <div className="analyst-edit-layout"><section className="surface analyst-point-form"><header><div><span>Cadre du point</span><strong>Périodes et diffusion</strong></div><div><JiraImporter analyst={analyst} pointDate={data.meetingDate} onImport={importAnalystJira}/><PlannerImportDialog markets={markets} onImport={onPlannerImport}/></div></header><div className="form-grid"><label className="field"><span>Du</span><SafeDateInput value={data.periodFrom} max={data.periodTo} onCommit={(periodFrom) => setPeriod({ periodFrom })}/></label><label className="field"><span>Au</span><SafeDateInput value={data.periodTo} min={data.periodFrom} onCommit={(periodTo) => setPeriod({ periodTo })}/></label><label className="field field-wide"><span>Message de synthèse</span><textarea value={data.note} onChange={(event) => updateData({ note: event.target.value })}/></label><label className="cycle-toggle field-wide"><input type="checkbox" checked={data.includeCycle20} onChange={(event) => updateData({ includeCycle20: event.target.checked })}/><span><strong>Afficher le repère 20 → 20</strong><small>{dateLabel(data.cycleFrom)} → {dateLabel(data.cycleTo)} · bloc séparé des totaux de la semaine</small></span></label>{data.includeCycle20 && <><label className="field"><span>Cycle du</span><SafeDateInput value={data.cycleFrom} max={data.cycleTo} onCommit={(cycleFrom) => updateData({ cycleFrom })}/></label><label className="field"><span>Cycle au</span><SafeDateInput value={data.cycleTo} min={data.cycleFrom} onCommit={(cycleTo) => updateData({ cycleTo })}/></label></>}<label className="field"><span>Alerte Jira après</span><input type="number" min="1" value={data.preferences.jiraWarningDays} onChange={(event) => updateData({ preferences: { ...data.preferences, jiraWarningDays: Math.max(1, Number(event.target.value) || 1), jiraCriticalDays: Math.max(Number(event.target.value) + 1, data.preferences.jiraCriticalDays) } })}/></label><label className="field"><span>Attention forte après</span><input type="number" min={data.preferences.jiraWarningDays + 1} value={data.preferences.jiraCriticalDays} onChange={(event) => updateData({ preferences: { ...data.preferences, jiraCriticalDays: Math.max(data.preferences.jiraWarningDays + 1, Number(event.target.value) || data.preferences.jiraWarningDays + 1) } })}/></label></div></section>
      <section className="analyst-edit-section"><div className="section-title"><div><span>Dossiers</span><h2>Suivis de la semaine</h2><p>Reporte les dossiers non terminés ou ajoute un nouveau suivi.</p></div><div className="title-actions"><button type="button" className="secondary-button" disabled={!previousRecord} onClick={carryPrevious}>Reprendre le précédent</button><button type="button" className="primary-button" onClick={() => updateData({ dossiers: [...data.dossiers, { id: uid(), title: "", status: "En cours", action: "", deadline: "", comment: "", progress: 0, showProgress: false }] })}>Ajouter un dossier</button></div></div><div className="record-stack">{data.dossiers.map((item) => dossierCard(item, true, (patch) => updateDossier(item.id, patch), () => updateData({ dossiers: data.dossiers.filter((row) => row.id !== item.id) })))}</div></section>
      <section className="surface analyst-mail-settings"><header><span>Destinataires automatiques</span><strong>{[analyst.name, manager?.name].filter(Boolean).join(" · ")}</strong><small>L’analyste et le manager Tarif sont destinataires principaux.</small></header><div className="form-grid"><label className="field field-wide"><span>À</span><input value={data.mail.to} onChange={(event) => updateData({ mail: { ...data.mail, to: event.target.value } })}/></label><label className="field field-wide"><span>Copie</span><input value={data.mail.cc} onChange={(event) => updateData({ mail: { ...data.mail, cc: event.target.value } })}/></label><label className="field field-wide"><span>Objet</span><input value={data.mail.subject} onChange={(event) => updateData({ mail: { ...data.mail, subject: event.target.value } })}/></label><label className="field field-wide"><span>Introduction</span><textarea value={data.mail.intro} onChange={(event) => updateData({ mail: { ...data.mail, intro: event.target.value } })}/></label></div></section>
      <section className="surface analyst-layout-settings"><ModuleLayoutEditor modules={analystPointModules} order={data.preferences.order} widths={data.preferences.widths} onChangeOrder={setLayoutOrder} onChangeWidth={setLayoutWidth}/><div className="analyst-visibility-grid">{(["readModules", "mailModules", "htmlModules"] as const).map((destination) => <article key={destination}><strong>{destination === "readModules" ? "Lecture" : destination === "mailModules" ? "Mail blanc" : "HTML interactif"}</strong>{analystPointModules.map((module) => <label key={module.id}><input type="checkbox" checked={data.preferences[destination][module.id]} onChange={(event) => setVisibility(destination, module.id, event.target.checked)}/><span>{module.label}</span></label>)}</article>)}</div></section>
      <section className="analyst-history"><div className="section-title"><div><span>Historique</span><h2>Semaines sauvegardées</h2><p>Recharge une semaine pour la lire ou la mettre à jour.</p></div></div>{records.length ? <div>{records.map((record) => <button type="button" key={record.id} className={record.id === activeRecordId ? "active" : ""} onClick={() => { setData(record.data); setActiveRecordId(record.id); setJiraReload((current) => current + 1); }}><span>{record.year}</span><strong>S{String(record.week).padStart(2, "0")}</strong><small>{dateLabel(record.periodFrom)} → {dateLabel(record.periodTo)}</small><b>{record.data.jira.length} ouverts · {record.data.jiraResolved.length} résolus · {record.data.dossiers.length} dossiers</b></button>)}</div> : <div className="analyst-module-empty">Aucune semaine sauvegardée.</div>}</section>
    </div>}

    {mode === "mail" && !jiraUnavailable && <section className="analyst-mail-page"><div className="mail-toolbar"><div><span>Mail blanc</span><strong>Version Outlook + fichier HTML interactif</strong><small>À : {data.mail.to || "destinataires à compléter"}</small></div><div><button type="button" className="secondary-button" onClick={copyMail}>Copier le mail</button><button type="button" className="primary-button" onClick={() => download(attachmentName, interactiveHtml)}>Télécharger le HTML</button></div></div><article className="html-attachment-card" draggable onDragStart={dragHtml}><span>HTML</span><div><strong>{attachmentName}</strong><small>Liens Jira cliquables et détails dépliables</small></div><b>Glisser dans Outlook</b></article><div className="mail-frame-wrap"><iframe title="Aperçu du mail analyste" srcDoc={mailHtml}/></div></section>}
    {toast && <div className="toast">{toast}</div>}
  </main>;
}
