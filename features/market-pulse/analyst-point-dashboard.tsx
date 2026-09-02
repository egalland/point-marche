"use client";

import { appFetch as fetch, readLocalDraft, writeLocalDraft, isLocalWorkspace, readLocalPreference, writeLocalPreference, saveLocalFile } from "@/lib/app-transport";
import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { SafeDateInput } from "@/components/safe-date-input";
import { SupplierTurnover } from "@/components/supplier-turnover";
import { AnalystWeekPicker } from "./analyst-week-picker";
import { AnalystJiraPanel } from "./analyst-jira-panel";
import { useAnalystJiraHistory, usePreviousAnalystJiraWeek } from "./use-analyst-jira-history";
import { analystMailHtml, analystInteractiveHtml } from "@/lib/analyst-point-export";
import { jiraHistoryRange } from "@/lib/analyst-jira-history";
import { isIsoDate, isoWeekRange } from "@/lib/iso-week";
import { ModuleLayoutEditor, type ModuleWidth } from "@/components/module-layout-editor";
import { buildAnalystStats, type AnalystStatsMarket } from "@/lib/analyst-stats";
import { groupAnalystActivities } from "@/lib/analyst-activity-groups";
import { fetchAnalystJiraSnapshot } from "@/lib/analyst-jira-client";
import { analystPointModules, initialAnalystPoint, isoWeekParts, normalizeAnalystPoint, previousWeekRange, type AnalystDossier, type AnalystPointData, type AnalystPointModule, type AnalystPointRecord } from "@/lib/analyst-point";
import type { GlobalDirectoryUser } from "@/lib/global-directory";
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
const closed = (value: string) => /(fait|termin|cl[oô]tur|r[eé]solu|annul)/i.test(value);

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

function dossierCard(item: AnalystDossier, edit: boolean, update: (patch: Partial<AnalystDossier>) => void, remove: () => void) {
  if (edit) return <article className="surface analyst-dossier-editor" key={item.id}><header><div><strong>{item.title || "Nouveau dossier"}</strong><small>{item.status}</small></div><button type="button" className="icon-button danger" onClick={remove}>×</button></header><div className="form-grid"><label className="field"><span>Titre</span><input value={item.title} onChange={(event) => update({ title: event.target.value })}/></label><label className="field"><span>Statut</span><select value={item.status} onChange={(event) => update({ status: event.target.value })}>{dossierStatuses.map((status) => <option key={status}>{status}</option>)}</select></label><label className="field"><span>Échéance</span><input type="date" value={item.deadline} onChange={(event) => update({ deadline: event.target.value })}/></label><label className="field"><span>Avancement</span><input type="range" min="0" max="100" step="5" value={item.progress} onChange={(event) => update({ progress: Number(event.target.value) })}/></label><label className="field field-wide"><span>Action</span><textarea value={item.action} onChange={(event) => update({ action: event.target.value })}/></label><label className="field field-wide"><span>Commentaire</span><textarea value={item.comment} onChange={(event) => update({ comment: event.target.value })}/></label><label className="progress-visibility-toggle field-wide"><input type="checkbox" checked={item.showProgress} onChange={(event) => update({ showProgress: event.target.checked })}/><span><strong>Afficher l’avancement dans le point</strong><small>La barre reste masquée si cette option n’est pas cochée.</small></span></label></div></article>;
  return <article className="analyst-dossier-card" key={item.id}><span className={`analyst-status-dot status-${item.status === "Fait" ? "done" : item.status === "En attente" ? "waiting" : item.status === "À faire" ? "todo" : "active"}`}/><div><strong>{item.title || "Dossier sans titre"}</strong><small>{item.action || item.comment || "Action à compléter"}</small>{item.showProgress && <div className="analyst-progress"><span><i style={{ width: `${Math.max(0, Math.min(100, item.progress))}%` }}/></span><b>{item.progress}%</b></div>}</div><span>{item.status}</span></article>;
}

export function AnalystPointDashboard({ users, tasks, markets, plannerUpdatedAt, onPlannerImport }: Props) {
  const analysts = useMemo(() => users.filter((user) => user.role === "analyste-tarif-referentiel").sort((left, right) => left.name.localeCompare(right.name, "fr")), [users]);
  const manager = users.find((user) => user.role === "manager-tarif");
  const [analystId, setAnalystId] = useState(() => {
    let stored = "";
    try { stored = typeof window !== "undefined" ? window.localStorage.getItem("market-pulse:analyst-id") ?? "" : ""; } catch {}
    if (isLocalWorkspace()) stored = readLocalPreference("market-pulse:analyst-id") ?? "";
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
  const [historyReload, setHistoryReload] = useState(0);
  const [chartReferenceDate, setChartReferenceDate] = useState("");
  const drafts = useRef(new Map<string, AnalystPointData>());
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
    try { window.localStorage.setItem("market-pulse:analyst-id", analyst.id); } catch {}
    writeLocalPreference("market-pulse:analyst-id", analyst.id);
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
      const localDraft = readLocalDraft("analyst", analyst.id);
      const next = localDraft ? normalizeAnalystPoint(localDraft.data, analyst, manager) : matching?.data ?? initialAnalystPoint(analyst, manager);
      setData(automaticRecipients(next, analyst, manager));
      const nextPeriod = isoWeekParts(next.meetingDate);
      setActiveRecordId(normalized.find((record) => record.year === nextPeriod.year && record.week === nextPeriod.week)?.id ?? "");
      setChartReferenceDate(next.meetingDate);
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
  useEffect(() => {
    if (!isLocalWorkspace() || loading || !data || !analyst || data.analystId !== analyst.id) return;
    writeLocalDraft({ scope: "analyst", ownerId: analyst.id, data });
  }, [analyst, data, loading]);

  const chartSettings = data?.preferences.jiraChart ?? { horizon: "3" as const, ...previousWeekRange() };
  const historyRange = useMemo(() => jiraHistoryRange(chartReferenceDate || jiraPointDate || previousWeekRange().to, chartSettings), [chartReferenceDate, chartSettings, jiraPointDate]);
  const jiraHistory = useAnalystJiraHistory(!loading && data?.analystId === jiraAnalystId ? jiraAnalystId : "", historyRange, historyReload);
  const previousJiraWeek = usePreviousAnalystJiraWeek(!loading && data?.analystId === jiraAnalystId ? jiraAnalystId : "", jiraPointDate, jiraHistory, historyReload);
  const jiraExportUnavailable = jiraUnavailable || Boolean((data?.preferences.mailModules.jira || data?.preferences.htmlModules.jira) && (jiraHistory.loading || jiraHistory.error || previousJiraWeek.loading || previousJiraWeek.error));

  const stats = useMemo(() => data && analyst ? buildAnalystStats(tasks, users, markets, { from: data.periodFrom, to: data.periodTo, marketId: "all", specialty: "all", analystIds: [analyst.id] }) : null, [analyst, data, markets, tasks, users]);
  const cycleStats = useMemo(() => data && analyst ? buildAnalystStats(tasks, users, markets, { from: data.cycleFrom, to: data.cycleTo, marketId: "all", specialty: "all", analystIds: [analyst.id] }) : null, [analyst, data, markets, tasks, users]);
  const mailHtml = useMemo(() => mode === "mail" && data && analyst && stats && cycleStats ? analystMailHtml(data, analyst, stats, cycleStats, jiraHistory.history, previousJiraWeek.count) : "", [mode, analyst, cycleStats, data, stats, jiraHistory.history, previousJiraWeek.count]);
  const interactiveHtml = useMemo(() => mode === "mail" && data && analyst && stats ? analystInteractiveHtml(data, analyst, stats, jiraHistory.history, previousJiraWeek.count) : "", [mode, analyst, data, stats, jiraHistory.history, previousJiraWeek.count]);
  const groupedActivities = useMemo(() => groupAnalystActivities(stats?.contributions ?? []), [stats]);
  if (!analyst || !data || data.analystId !== analyst.id || !stats || !cycleStats) return <main className="analyst-point-page"><div className="surface analyst-point-empty"><strong>{analysts.length ? "Chargement du point analyste…" : "Aucun analyste tarifaire dans l’annuaire"}</strong><span>{analysts.length ? "Récupération de l’historique hebdomadaire." : "Ajoute au moins une personne avec le rôle Analyste tarif et référentiel."}</span></div></main>;

  const period = isoWeekParts(data.meetingDate);
  const previousRecord = records.filter((record) => record.year < period.year || (record.year === period.year && record.week < period.week)).sort((left, right) => right.year - left.year || right.week - left.week)[0];
  const updateData = (patch: Partial<AnalystPointData>) => setData((current) => current ? { ...current, ...patch } : current);
  const refreshJira = () => { setJiraReload((current) => current + 1); setHistoryReload((current) => current + 1); };
  const updateDossier = (id: string, patch: Partial<AnalystDossier>) => updateData({ dossiers: data.dossiers.map((item) => item.id === id ? { ...item, ...patch } : item) });
  const choosePointWeek = (nextParts: { year: number; week: number }, keepChartRange = false) => {
    if (loading || saving || nextParts.year < 2020 || nextParts.year > 2200) return;
    if (nextParts.year === period.year && nextParts.week === period.week) return;
    drafts.current.set(`${analyst.id}:${period.year}:${period.week}`, data);
    writeLocalDraft({ scope: "analyst", ownerId: analyst.id, data });
    const nextRange = isoWeekRange(nextParts.year, nextParts.week);
    const saved = records.find((record) => record.year === nextParts.year && record.week === nextParts.week);
    const draft = drafts.current.get(`${analyst.id}:${nextParts.year}:${nextParts.week}`);
    const localDraft = readLocalDraft("analyst", analyst.id, nextRange.to);
    const base = draft ?? (localDraft ? normalizeAnalystPoint(localDraft.data, analyst, manager) : saved?.data);
    const next = base ?? {
      ...initialAnalystPoint(analyst, manager),
      periodFrom: nextRange.from, periodTo: nextRange.to, meetingDate: nextRange.to,
      preferences: data.preferences, mail: data.mail,
    };
    setData(automaticRecipients(keepChartRange ? { ...next, preferences: { ...next.preferences, jiraChart: data.preferences.jiraChart } } : next, analyst, manager));
    setActiveRecordId(saved?.id ?? "");
    if (!keepChartRange) setChartReferenceDate(next.meetingDate);
    setJiraReload((current) => current + 1);
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
      setActiveRecordId(saved.id);
      if (isLocalWorkspace()) {
        writeLocalDraft({ scope: "analyst", ownerId: analyst.id, data: saved.data as unknown as Record<string, unknown> });
        const onDisk = await saveLocalFile();
        setToast(`${saved.year} · S${String(saved.week).padStart(2, "0")} ${onDisk ? "enregistrée dans le fichier." : "conservée dans la session. Le fichier reste à enregistrer."}`);
      } else setToast(`${saved.year} · S${String(saved.week).padStart(2, "0")} enregistrée.`);
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
  const setPeriod = (patch: Partial<Pick<AnalystPointData, "periodFrom" | "periodTo">>) => {
    updateData({ ...patch, meetingDate: patch.periodTo ?? data.periodTo });
    setChartReferenceDate(patch.periodTo ?? data.periodTo);
  };
  const setLayoutOrder = (order: AnalystPointModule[]) => updateData({ preferences: { ...data.preferences, order } });
  const setLayoutWidth = (id: AnalystPointModule, width: ModuleWidth) => updateData({ preferences: { ...data.preferences, widths: { ...data.preferences.widths, [id]: width } } });
  const setVisibility = (destination: "readModules" | "mailModules" | "htmlModules", id: AnalystPointModule, checked: boolean) => updateData({ preferences: { ...data.preferences, [destination]: { ...data.preferences[destination], [id]: checked } } });
  const download = (name: string, content: string) => { const url = URL.createObjectURL(new Blob([content], { type: "text/html;charset=utf-8" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 500); };
  const attachmentName = `point-analyste-${analyst.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${period.year}-S${String(period.week).padStart(2, "0")}.html`;
  const copyMail = async () => { try { await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([mailHtml], { type: "text/html" }), "text/plain": new Blob([`${data.mail.intro}\n\n${data.note}`], { type: "text/plain" }) })]); setToast("Corps du mail copié."); } catch { setToast("Copie bloquée : utilise l’aperçu ou le fichier HTML."); } };
  const dragHtml = (event: DragEvent<HTMLElement>) => { const url = URL.createObjectURL(new Blob([interactiveHtml], { type: "text/html;charset=utf-8" })); event.dataTransfer.setData("DownloadURL", `text/html:${attachmentName}:${url}`); event.dataTransfer.setData("text/plain", attachmentName); window.setTimeout(() => URL.revokeObjectURL(url), 60000); };

  const overviewModule = <section className="analyst-point-module analyst-overview-module"><header><span>Synthèse de la semaine</span><strong>{data.note}</strong></header><div className="analyst-point-kpis"><article className="resolved"><span>Terminés semaine</span><strong>{jiraUnavailable ? "—" : data.jiraResolved.length}</strong><small>{jiraUnavailable ? "Données Jira en attente" : "Selon la dernière modification Jira"}</small></article><article><span>Simulations</span><strong>{stats.simulations}</strong><small>{movementLabel(stats.movement)}</small></article><article><span>Contrôles</span><strong>{stats.controls}</strong><small>{stats.distinctTasks} tâche{stats.distinctTasks > 1 ? "s" : ""} distincte{stats.distinctTasks > 1 ? "s" : ""}</small></article><article><span>Dossiers actifs</span><strong>{data.dossiers.filter((item) => !closed(item.status)).length}</strong><small>{data.dossiers.length} au total</small></article></div></section>;
  const jiraModule = <AnalystJiraPanel analystName={analyst.name} pointDate={data.meetingDate} tickets={data.jiraResolved} unavailable={jiraUnavailable}
    history={jiraHistory} previousWeek={previousJiraWeek} settings={data.preferences.jiraChart}
    onSettingsChange={(jiraChart) => updateData({ preferences: { ...data.preferences, jiraChart } })}
    onSelectWeek={(week) => choosePointWeek(week, true)} onRetry={refreshJira}/>;
  const plannerModule = <section className="analyst-point-module analyst-planner-module"><header><div><span>Planner</span><h2>Simulations et contrôles</h2><p>{dateLabel(data.periodFrom)} → {dateLabel(data.periodTo)} · source actualisée {plannerUpdatedAt ? new Date(plannerUpdatedAt.replace(" ", "T") + (plannerUpdatedAt.includes("Z") ? "" : "Z")).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "non importée"}</p></div><div className="analyst-planner-total"><strong>{stats.totalActivities}</strong><span>activités</span></div></header><div className="analyst-delay-grid">{stats.delaySummaries.map((delay) => <article key={delay.kind}><span>{delay.label}</span><strong>{daysLabel(delay.average)}</strong><small>{delay.previousAverage === null || delay.average === null ? "Pas de comparaison" : `${delay.average - delay.previousAverage > 0 ? "+" : ""}${daysLabel(delay.average - delay.previousAverage)} vs période précédente`}</small><b>{delay.sampleCount} dossier{delay.sampleCount > 1 ? "s" : ""}</b></article>)}</div>{groupedActivities.length ? <div className="analyst-activity-list">{groupedActivities.map((task) => <article key={task.taskId}><div><strong>{task.taskName}</strong><small>{task.activities.map((item) => item.marketIds.map((id) => markets.find((market) => market.id === id)?.name).filter(Boolean).join(" · ")).filter(Boolean).join(" · ") || "Marché non rapproché"}</small><SupplierTurnover value={task.purchases12m}/></div><div>{task.activities.map((item, index) => <span className={item.specialty} key={`${item.taskId}-${item.specialty}-${index}`}>{item.specialty === "simulation" ? "Simulation" : "Contrôle"} · {dateLabel(item.date)}</span>)}</div></article>)}</div> : <div className="analyst-module-empty">Aucune simulation ou contrôle attribué à cet analyste sur la période.</div>}</section>;
  const cycleModule = <section className="analyst-point-module analyst-cycle-module"><header><span>Repère séparé</span><h2>Cycle du 20 au 20</h2><p>{dateLabel(data.cycleFrom)} → {dateLabel(data.cycleTo)}</p></header><div><article><span>Simulations</span><strong>{cycleStats.simulations}</strong></article><article><span>Contrôles</span><strong>{cycleStats.controls}</strong></article><article><span>Tâches</span><strong>{cycleStats.distinctTasks}</strong></article></div><small>Ce bloc ne s’ajoute pas aux totaux de la semaine : il sert uniquement de repère complémentaire.</small></section>;
  const dossiersModule = <section className="analyst-point-module analyst-dossiers-module"><header><div><span>Suivis manuels</span><h2>Dossiers</h2></div><strong>{data.dossiers.filter((item) => !closed(item.status)).length} actif{data.dossiers.filter((item) => !closed(item.status)).length > 1 ? "s" : ""}</strong></header>{data.dossiers.length ? <div>{data.dossiers.map((item) => dossierCard(item, false, () => undefined, () => undefined))}</div> : <div className="analyst-module-empty">Aucun dossier renseigné.</div>}</section>;
  const moduleContent: Record<AnalystPointModule, ReactNode> = { overview: overviewModule, jira: jiraModule, planner: plannerModule, cycle20: cycleModule, dossiers: dossiersModule };

  return <main className="analyst-point-page">
    <header className="analyst-point-hero"><div><span>Point analyste</span><h1>{analyst.name}</h1><p>Suivi descriptif de l’activité et des dossiers, sans objectif individuel.</p></div><div className="analyst-point-controls"><label><span>Analyste</span><select value={analyst.id} onChange={(event) => { setLoading(true); setAnalystId(event.target.value); }}>{analysts.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><AnalystWeekPicker value={data.meetingDate} savedWeeks={records} disabled={loading || saving} onSelect={choosePointWeek}/></div></header>
    <div className="analyst-point-toolbar"><div className="segmented-control"><button type="button" className={mode === "read" ? "active" : ""} onClick={() => setMode("read")}>Lecture</button><button type="button" className={mode === "edit" ? "active" : ""} onClick={() => setMode("edit")}>Préparation</button><button type="button" className={mode === "mail" ? "active" : ""} onClick={() => setMode("mail")}>Mail</button></div><div><span className={activeRecordId ? "analyst-saved-state saved" : "analyst-saved-state"}>{loading ? "Chargement…" : activeRecordId ? "Semaine enregistrée" : "Nouveau brouillon"}</span><button type="button" className="primary-button" disabled={saving || jiraUnavailable} onClick={save}>{saving ? "Enregistrement…" : "Sauvegarder la semaine"}</button></div></div>

    {jiraUnavailable && <section className={`analyst-jira-load-state${jiraError ? " error" : ""}`} role={jiraError ? "alert" : "status"}><div><strong>{jiraLoading ? "Chargement des tickets Jira…" : "Tickets Jira non chargés"}</strong><span>{jiraLoading ? "Rapprochement avec le registre global pour la semaine sélectionnée." : jiraError}</span>{jiraError && <small>La sauvegarde et l’export du point attendent le chargement des tickets pour éviter des chiffres incomplets.</small>}</div>{jiraError && <button type="button" className="secondary-button" onClick={refreshJira}>Réessayer</button>}</section>}

    {mode === "read" && <div className="analyst-render-grid">{data.preferences.order.filter((module) => data.preferences.readModules[module] && (module !== "cycle20" || data.includeCycle20)).map((module) => <div key={module} className={`analyst-render-item width-${data.preferences.widths[module]}`}>{moduleContent[module]}</div>)}</div>}

    {mode === "edit" && <div className="analyst-edit-layout"><section className="surface analyst-point-form"><header><div><span>Cadre du point</span><strong>Périodes et diffusion</strong></div><div><PlannerImportDialog markets={markets} onImport={onPlannerImport}/></div></header><div className="form-grid"><label className="field"><span>Du</span><SafeDateInput value={data.periodFrom} max={data.periodTo} onCommit={(periodFrom) => setPeriod({ periodFrom })}/></label><label className="field"><span>Au</span><SafeDateInput value={data.periodTo} min={data.periodFrom} onCommit={(periodTo) => setPeriod({ periodTo })}/></label><label className="field field-wide"><span>Message de synthèse</span><textarea value={data.note} onChange={(event) => updateData({ note: event.target.value })}/></label><label className="cycle-toggle field-wide"><input type="checkbox" checked={data.includeCycle20} onChange={(event) => updateData({ includeCycle20: event.target.checked })}/><span><strong>Afficher le repère 20 → 20</strong><small>{dateLabel(data.cycleFrom)} → {dateLabel(data.cycleTo)} · bloc séparé des totaux de la semaine</small></span></label>{data.includeCycle20 && <><label className="field"><span>Cycle du</span><SafeDateInput value={data.cycleFrom} max={data.cycleTo} onCommit={(cycleFrom) => updateData({ cycleFrom })}/></label><label className="field"><span>Cycle au</span><SafeDateInput value={data.cycleTo} min={data.cycleFrom} onCommit={(cycleTo) => updateData({ cycleTo })}/></label></>}</div></section>
      <section className="analyst-edit-section"><div className="section-title"><div><span>Dossiers</span><h2>Suivis de la semaine</h2><p>Reporte les dossiers non terminés ou ajoute un nouveau suivi.</p></div><div className="title-actions"><button type="button" className="secondary-button" disabled={!previousRecord} onClick={carryPrevious}>Reprendre le précédent</button><button type="button" className="primary-button" onClick={() => updateData({ dossiers: [...data.dossiers, { id: uid(), title: "", status: "En cours", action: "", deadline: "", comment: "", progress: 0, showProgress: false }] })}>Ajouter un dossier</button></div></div><div className="record-stack">{data.dossiers.map((item) => dossierCard(item, true, (patch) => updateDossier(item.id, patch), () => updateData({ dossiers: data.dossiers.filter((row) => row.id !== item.id) })))}</div></section>
      <section className="surface analyst-mail-settings"><header><span>Destinataires automatiques</span><strong>{[analyst.name, manager?.name].filter(Boolean).join(" · ")}</strong><small>L’analyste et le manager Tarif sont destinataires principaux.</small></header><div className="form-grid"><label className="field field-wide"><span>À</span><input value={data.mail.to} onChange={(event) => updateData({ mail: { ...data.mail, to: event.target.value } })}/></label><label className="field field-wide"><span>Copie</span><input value={data.mail.cc} onChange={(event) => updateData({ mail: { ...data.mail, cc: event.target.value } })}/></label><label className="field field-wide"><span>Objet</span><input value={data.mail.subject} onChange={(event) => updateData({ mail: { ...data.mail, subject: event.target.value } })}/></label><label className="field field-wide"><span>Introduction</span><textarea value={data.mail.intro} onChange={(event) => updateData({ mail: { ...data.mail, intro: event.target.value } })}/></label></div></section>
      <section className="surface analyst-layout-settings"><ModuleLayoutEditor modules={analystPointModules} order={data.preferences.order} widths={data.preferences.widths} onChangeOrder={setLayoutOrder} onChangeWidth={setLayoutWidth}/><div className="analyst-visibility-grid">{(["readModules", "mailModules", "htmlModules"] as const).map((destination) => <article key={destination}><strong>{destination === "readModules" ? "Lecture" : destination === "mailModules" ? "Mail blanc" : "HTML interactif"}</strong>{analystPointModules.map((module) => <label key={module.id}><input type="checkbox" checked={data.preferences[destination][module.id]} onChange={(event) => setVisibility(destination, module.id, event.target.checked)}/><span>{module.label}</span></label>)}</article>)}</div></section>
      <section className="analyst-history"><div className="section-title"><div><span>Historique</span><h2>Semaines sauvegardées</h2><p>Recharge une semaine pour la lire ou la mettre à jour.</p></div></div>{records.length ? <div>{records.map((record) => <button type="button" key={record.id} className={record.id === activeRecordId ? "active" : ""} onClick={() => choosePointWeek(record)}><span>{record.year}</span><strong>S{String(record.week).padStart(2, "0")}</strong><small>{dateLabel(record.periodFrom)} → {dateLabel(record.periodTo)}</small><b>{record.data.jiraResolved.length} terminés · {record.data.dossiers.length} dossiers</b></button>)}</div> : <div className="analyst-module-empty">Aucune semaine sauvegardée.</div>}</section>
    </div>}

    {mode === "mail" && !jiraExportUnavailable && <section className="analyst-mail-page"><div className="mail-toolbar"><div><span>Mail blanc</span><strong>Version Outlook + fichier HTML interactif</strong><small>À : {data.mail.to || "destinataires à compléter"}</small></div><div><button type="button" className="secondary-button" onClick={copyMail}>Copier le mail</button><button type="button" className="primary-button" onClick={() => download(attachmentName, interactiveHtml)}>Télécharger le HTML</button></div></div><article className="html-attachment-card" draggable onDragStart={dragHtml}><span>HTML</span><div><strong>{attachmentName}</strong><small>Liens Jira cliquables et détails dépliables</small></div><b>Glisser dans Outlook</b></article><div className="mail-frame-wrap"><iframe title="Aperçu du mail analyste" srcDoc={mailHtml}/></div></section>}
    {mode === "mail" && jiraExportUnavailable && !jiraUnavailable && <section className="analyst-jira-load-state" role="status"><div><strong>{jiraHistory.loading ? "Chargement du graphique Jira…" : "Graphique Jira indisponible"}</strong><span>{jiraHistory.error || "Le mail et le HTML attendent les chiffres du graphique."}</span></div>{jiraHistory.error && <button type="button" className="secondary-button" onClick={refreshJira}>Réessayer</button>}</section>}
    {toast && <div className="toast">{toast}</div>}
  </main>;
}
