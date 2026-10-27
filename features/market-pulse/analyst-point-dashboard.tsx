"use client";
import { useAccess } from "./access-panel";

import { appFetch as fetch, readLocalDraft, writeLocalDraft, isLocalWorkspace, readLocalPreference, writeLocalPreference, saveLocalFile, markPointSaved, loadPointDraft, preparePointSave, finishPointSave } from "@/lib/app-transport";
import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { PointSyncStatus } from "./point-sync-status";
import { PointSourceStatus } from "./point-source-status";
import type { PointDraft, DraftSnapshot, StoredPointDraft } from "@/lib/point-persistence";
import { SafeDateInput } from "@/components/safe-date-input";
import { SupplierTurnover } from "@/components/supplier-turnover";
import { AnalystPointCanvas } from "./analyst-point-canvas";
import { AppDialog } from "@/components/app-dialog";
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
import { SourceModeControl } from "./source-mode-control";
import { ManualAnalystJira } from "./manual-analyst-jira";
import { analystJiraCounts } from "@/lib/analyst-point";
import { buildMailDraft, mailPlainText } from "@/lib/mail-draft";
import type { PointSourceMode } from "@/lib/point-source-mode";

type Mode = "read" | "mail";
type Props = {
  onReconnect?: () => void;
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
  if (edit) return <article className="surface analyst-dossier-editor" key={item.id}><header><div><strong>{item.title || "Nouveau dossier"}</strong><small>{item.status}</small></div><button type="button" className="icon-button danger" aria-label={`Supprimer ${item.title || "le dossier"}`} onClick={remove}>×</button></header><div className="form-grid"><label className="field"><span>Titre</span><input value={item.title} onChange={(event) => update({ title: event.target.value })}/></label><label className="field"><span>Statut</span><select value={item.status} onChange={(event) => update({ status: event.target.value })}>{dossierStatuses.map((status) => <option key={status}>{status}</option>)}</select></label><label className="field"><span>Échéance</span><input type="date" value={item.deadline} onChange={(event) => update({ deadline: event.target.value })}/></label><label className="field"><span>Avancement</span><input type="range" min="0" max="100" step="5" value={item.progress} onChange={(event) => update({ progress: Number(event.target.value) })}/></label><label className="field field-wide"><span>Action</span><textarea value={item.action} onChange={(event) => update({ action: event.target.value })}/></label><label className="field field-wide"><span>Commentaire</span><textarea value={item.comment} onChange={(event) => update({ comment: event.target.value })}/></label><label className="progress-visibility-toggle field-wide"><input type="checkbox" checked={item.showProgress} onChange={(event) => update({ showProgress: event.target.checked })}/><span><strong>Afficher l’avancement dans le point</strong><small>La barre reste masquée si cette option n’est pas cochée.</small></span></label></div></article>;
  return <article className="analyst-dossier-card" key={item.id}><span className={`analyst-status-dot status-${item.status === "Fait" ? "done" : item.status === "En attente" ? "waiting" : item.status === "À faire" ? "todo" : "active"}`}/><div><strong>{item.title || "Dossier sans titre"}</strong><small>{item.action || item.comment || "Action à compléter"}</small>{item.showProgress && <div className="analyst-progress"><span><i style={{ width: `${Math.max(0, Math.min(100, item.progress))}%` }}/></span><b>{item.progress}%</b></div>}</div><span>{item.status}</span></article>;
}

export function AnalystPointDashboard({ users, tasks, markets, plannerUpdatedAt, onPlannerImport, onReconnect }: Props) {
  const { can } = useAccess();
  const canEdit = can("analyst.edit");
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
  const [editingModule, setEditingModule] = useState<AnalystPointModule | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const setMeetingEditing = (active: boolean) => setEditingModule(active ? "jira" : null);
  useEffect(() => { setEditingModule(null); setSettingsOpen(false); }, [analystId, data?.meetingDate, mode]);
  const [sourceChanging, setSourceChanging] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [activeRecordId, setActiveRecordId] = useState("");
  const [jiraReload, setJiraReload] = useState(0);
  const [historyReload, setHistoryReload] = useState(0);
  const [chartReferenceDate, setChartReferenceDate] = useState("");
  const selection = useRef(0);
  const saveAction = useRef<(() => Promise<void>) | null>(null);
  const [jiraLoad, setJiraLoad] = useState({ key: "", error: "" });
  const jiraAnalystId = analyst?.id ?? "";
  const jiraPointDate = data?.meetingDate ?? "";
  const manualJira = data?.jiraMode === "manual";
  const jiraKey = !manualJira && !loading && data?.analystId === jiraAnalystId && jiraAnalystId && jiraPointDate
    ? `${jiraAnalystId}:${jiraPointDate}:${jiraReload}` : "";
  const jiraLoading = !manualJira && (loading || Boolean(jiraKey && jiraLoad.key !== jiraKey));
  const jiraError = jiraKey && jiraLoad.key === jiraKey ? jiraLoad.error : "";
  const jiraUnavailable = jiraLoading || Boolean(jiraError);

  useEffect(() => {
    if (!analyst) return;
    ++selection.current;
    try { window.localStorage.setItem("market-pulse:analyst-id", analyst.id); } catch {}
    writeLocalPreference("market-pulse:analyst-id", analyst.id);
    let active = true;
    void fetch(`/api/analyst-points?analystId=${encodeURIComponent(analyst.id)}`, { cache: "no-store" }).then(async (response) => {
      const payload = await response.json() as { points?: AnalystPointRecord[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Chargement impossible.");
      if (!active) return;
      const normalized = (payload.points ?? []).map((record) => ({ ...record, data: automaticRecipients(normalizeAnalystPoint(record.data, analyst, manager), analyst, manager) }));
      normalized.forEach((record) => markPointSaved({ scope: "analyst", ownerId: analyst.id, data: record.data }, record));
      setRecords(normalized);
      const previous = previousWeekRange();
      const period = isoWeekParts(previous.to);
      const matching = normalized.find((record) => record.year === period.year && record.week === period.week);
      const localDraft = await loadPointDraft("analyst", analyst.id);
      if (!active) return;
      const next = localDraft ? normalizeAnalystPoint(localDraft.data, analyst, manager) : matching?.data ?? initialAnalystPoint(analyst, manager);
      setData(automaticRecipients(next, analyst, manager));
      const nextPeriod = isoWeekParts(next.meetingDate);
      setActiveRecordId(normalized.find((record) => record.year === nextPeriod.year && record.week === nextPeriod.week)?.id ?? "");
      setChartReferenceDate(next.meetingDate);
    }).catch((error) => {
      if (active) {
        const draft = readLocalDraft("analyst", analyst.id);
        setData((current) => draft ? normalizeAnalystPoint(draft.data, analyst, manager) : current?.analystId === analyst.id ? current : initialAnalystPoint(analyst, manager));
        setToast(`${error instanceof Error ? error.message : "Chargement impossible."} Les modifications sont conservées.`);
      }
    }).finally(() => { if (active) { setLoading(false); setJiraReload((current) => current + 1); } });
    return () => { active = false; ++selection.current; };
  }, [analyst, manager]);
  useEffect(() => {
    if (!jiraKey) return;
    const controller = new AbortController();
    let active = true;
    void fetchAnalystJiraSnapshot(jiraAnalystId, isoWeekParts(jiraPointDate), controller.signal).then((snapshot) => {
      if (!active) return;
      if (snapshot) setData((current) => current?.analystId === jiraAnalystId && current.meetingDate === jiraPointDate && current.jiraMode !== "manual"
        ? { ...current, sourceFreshness: { ...current.sourceFreshness, jira: snapshot.updatedAt }, jira: snapshot.tickets, jiraResolved: snapshot.resolvedTickets ?? [] } : current);
      setJiraLoad({ key: jiraKey, error: "" });
    }).catch((error) => {
      if (active) setJiraLoad({ key: jiraKey, error: error instanceof Error ? error.message : "Chargement Jira impossible." });
    });
    return () => { active = false; controller.abort(); };
  }, [jiraKey, jiraAnalystId, jiraPointDate]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(""), 2800); return () => window.clearTimeout(timer); }, [toast]);
  useEffect(() => {
    if (loading || !data || !analyst || data.analystId !== analyst.id) return;
    if (canEdit) writeLocalDraft({ scope: "analyst", ownerId: analyst.id, data });
  }, [analyst, data, loading]);

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); void saveAction.current?.(); }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);

  const chartSettings = useMemo(() => data?.preferences.jiraChart ?? { horizon: "3" as const, ...previousWeekRange() }, [data?.preferences.jiraChart]);
  const historyRange = useMemo(() => jiraHistoryRange(chartReferenceDate || jiraPointDate || previousWeekRange().to, chartSettings), [chartReferenceDate, chartSettings, jiraPointDate]);
  const jiraHistory = useAnalystJiraHistory(!manualJira && !loading && data?.analystId === jiraAnalystId ? jiraAnalystId : "", historyRange, historyReload);
  const previousJiraWeek = usePreviousAnalystJiraWeek(!manualJira && !loading && data?.analystId === jiraAnalystId ? jiraAnalystId : "", jiraPointDate, jiraHistory, historyReload);
  const jiraExportUnavailable = !manualJira && (jiraUnavailable || Boolean((data?.preferences.mailModules.jira || data?.preferences.htmlModules.jira) && (jiraHistory.loading || jiraHistory.error || previousJiraWeek.loading || previousJiraWeek.error)));

  const stats = useMemo(() => data && analyst ? buildAnalystStats(tasks, users, markets, { from: data.periodFrom, to: data.periodTo, marketId: "all", specialty: "all", analystIds: [analyst.id] }) : null, [analyst, data, markets, tasks, users]);
  const cycleStats = useMemo(() => data && analyst ? buildAnalystStats(tasks, users, markets, { from: data.cycleFrom, to: data.cycleTo, marketId: "all", specialty: "all", analystIds: [analyst.id] }) : null, [analyst, data, markets, tasks, users]);
  const mailHtml = useMemo(() => mode === "mail" && data && analyst && stats && cycleStats ? analystMailHtml(data, analyst, stats, cycleStats, jiraHistory.history, previousJiraWeek.count) : "", [mode, analyst, cycleStats, data, stats, jiraHistory.history, previousJiraWeek.count]);
  const interactiveHtml = useMemo(() => mode === "mail" && data && analyst && stats && cycleStats ? analystInteractiveHtml(data, analyst, stats, jiraHistory.history, previousJiraWeek.count, cycleStats) : "", [mode, analyst, cycleStats, data, stats, jiraHistory.history, previousJiraWeek.count]);
  const groupedActivities = useMemo(() => groupAnalystActivities(stats?.contributions ?? []), [stats]);
  const period = isoWeekParts(data?.meetingDate ?? previousWeekRange().to);
  const save = async () => {
    if (!canEdit) return;
    if (saving || loading || jiraUnavailable || !analyst || !data || data.analystId !== analyst.id) return;
    const request = selection.current;
    if (data.periodFrom > data.periodTo) { setToast("La fin de période doit suivre le début."); return; }
    setSaving(true);
    if (canEdit) writeLocalDraft({ scope: "analyst", ownerId: analyst.id, data });
    const submittedDraft = { scope: "analyst" as const, ownerId: analyst.id, data };
    try {
      const concurrency = await preparePointSave(submittedDraft);
      const response = await fetch("/api/analyst-points", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ analystId: analyst.id, data, ...concurrency }) });
      const payload = await response.json() as { point?: AnalystPointRecord; draft?: StoredPointDraft; error?: string };
      if (!response.ok || !payload.point) { finishPointSave(submittedDraft, undefined, response.status === 409); throw new Error(payload.error || "Sauvegarde impossible."); }
      finishPointSave(submittedDraft, { point: payload.point, draft: payload.draft });
      const saved = { ...payload.point, data: normalizeAnalystPoint(payload.point.data, analyst, manager) };
      markPointSaved({ scope: "analyst", ownerId: analyst.id, data: saved.data }, saved);
      if (request === selection.current) {
        setRecords((current) => [saved, ...current.filter((record) => !(record.year === saved.year && record.week === saved.week))].sort((left, right) => right.year - left.year || right.week - left.week));
        setActiveRecordId(saved.id);
      }
      // The draft may have changed while the server was saving. Keep that newer text.
      if (isLocalWorkspace()) {
        const onDisk = await saveLocalFile();
        setToast(`${saved.year} · S${String(saved.week).padStart(2, "0")} ${onDisk ? "enregistrée dans le fichier." : "conservée dans la session. Le fichier reste à enregistrer."}`);
      } else {
        const latest = readLocalDraft("analyst", analyst.id, data.meetingDate);
        const newerEdits = latest && JSON.stringify(latest.data) !== JSON.stringify(data);
        setToast(`${saved.year} · S${String(saved.week).padStart(2, "0")} enregistrée.${newerEdits ? " Les nouvelles modifications restent à enregistrer." : ""}`);
      }
    } catch (error) { setToast(error instanceof Error ? error.message : "Sauvegarde impossible."); }
    finally { finishPointSave(submittedDraft); setSaving(false); }
  };
  useEffect(() => { saveAction.current = save; });

  if (!analyst || !data || data.analystId !== analyst.id || !stats || !cycleStats) return <main className="analyst-point-page"><div className="surface analyst-point-empty"><strong>{analysts.length ? "Chargement du point analyste…" : "Aucun analyste tarifaire dans l’annuaire"}</strong><span>{analysts.length ? "Récupération de l’historique hebdomadaire." : "Ajoute au moins une personne avec le rôle Analyste tarif et référentiel."}</span></div></main>;

  const jiraCounts = analystJiraCounts(data);
  const previousRecord = records.filter((record) => record.year < period.year || (record.year === period.year && record.week < period.week)).sort((left, right) => right.year - left.year || right.week - left.week)[0];
  const updateData = (patch: Partial<AnalystPointData>) => canEdit && setData((current) => current ? { ...current, ...patch } : current);
  const refreshJira = () => { setJiraReload((current) => current + 1); setHistoryReload((current) => current + 1); };
  const changeJiraMode = async (next: PointSourceMode) => {
    if (sourceChanging || next === data.jiraMode) return;
    if (next === "manual") { updateData({ jiraMode: "manual", manualJiraCounts: data.manualJiraCounts ?? { open: data.jira.length, resolved: data.jiraResolved.length } }); return; }
    setSourceChanging(true);
    try {
      const snapshot = await fetchAnalystJiraSnapshot(analyst.id, period);
      if (!snapshot) throw new Error("Aucun import Jira disponible. Les totaux manuels sont conservés.");
      setData((current) => current?.analystId === analyst.id && current.meetingDate === data.meetingDate ? { ...current, jiraMode: "automatic", sourceFreshness: { ...current.sourceFreshness, jira: snapshot.updatedAt }, jira: snapshot.tickets, jiraResolved: snapshot.resolvedTickets ?? [] } : current);
      refreshJira();
    } catch (error) { setToast(error instanceof Error ? error.message : "Import indisponible."); }
    finally { setSourceChanging(false); }
  };
  const updateDossier = (id: string, patch: Partial<AnalystDossier>) => updateData({ dossiers: data.dossiers.map((item) => item.id === id ? { ...item, ...patch } : item) });
  const choosePointWeek = async (nextParts: { year: number; week: number }, keepChartRange = false) => {
    if (loading || saving || nextParts.year < 2020 || nextParts.year > 2200) return;
    if (nextParts.year === period.year && nextParts.week === period.week) return;
    ++selection.current;
    if (canEdit) writeLocalDraft({ scope: "analyst", ownerId: analyst.id, data });
    const nextRange = isoWeekRange(nextParts.year, nextParts.week);
    const saved = records.find((record) => record.year === nextParts.year && record.week === nextParts.week);
    const request = selection.current;
    setLoading(true);
    let localDraft;
    try { localDraft = await loadPointDraft("analyst", analyst.id, nextRange.to); }
    catch (error) { if (request === selection.current) { setLoading(false); setToast(error instanceof Error ? error.message : "Brouillon indisponible."); } return; }
    if (request !== selection.current) return;
    setLoading(false);
    const base = localDraft ? normalizeAnalystPoint(localDraft.data, analyst, manager) : saved?.data;
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

  const carryPrevious = () => {
    if (!previousRecord) return setToast("Aucun point précédent disponible.");
    const known = new Set(data.dossiers.map((item) => item.sourceId ?? item.id));
    const carried = previousRecord.data.dossiers.filter((item) => !closed(item.status) && !known.has(item.sourceId ?? item.id)).map((item) => ({ ...item, id: uid(), sourceId: item.sourceId ?? item.id, carriedFromYear: previousRecord.year, carriedFromWeek: previousRecord.week }));
    updateData({ dossiers: [...data.dossiers, ...carried] });
    setToast(carried.length ? `${carried.length} dossier${carried.length > 1 ? "s" : ""} non terminé${carried.length > 1 ? "s" : ""} repris.` : "Aucun dossier non terminé à reprendre.");
  };
  const setPeriod = (patch: Partial<Pick<AnalystPointData, "periodFrom" | "periodTo">>) => {
    ++selection.current;
    const nextDate = patch.periodTo ?? data.periodTo;
    const nextPeriod = isoWeekParts(nextDate);
    setActiveRecordId(records.find((record) => record.year === nextPeriod.year && record.week === nextPeriod.week)?.id ?? "");
    updateData({ ...patch, meetingDate: nextDate });
    setChartReferenceDate(patch.periodTo ?? data.periodTo);
  };
  const setLayoutOrder = (order: AnalystPointModule[]) => updateData({ preferences: { ...data.preferences, order } });
  const setLayoutWidth = (id: AnalystPointModule, width: ModuleWidth) => updateData({ preferences: { ...data.preferences, widths: { ...data.preferences.widths, [id]: width } } });
  const setVisibility = (destination: "readModules" | "mailModules" | "htmlModules", id: AnalystPointModule, checked: boolean) => updateData({ preferences: { ...data.preferences, [destination]: { ...data.preferences[destination], [id]: checked } } });
  const download = (name: string, content: string, type = "text/html;charset=utf-8") => { if (!can("exports.html") || (type === "message/rfc822" && !can("exports.mail"))) return; const url = URL.createObjectURL(new Blob([content], { type })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 500); };
  const attachmentName = `point-analyste-${analyst.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${period.year}-S${String(period.week).padStart(2, "0")}.html`;
  const copyMail = async () => { if (!can("exports.mail")) return; try { await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([mailHtml], { type: "text/html" }), "text/plain": new Blob([mailPlainText(mailHtml)], { type: "text/plain" }) })]); setToast("Corps du mail copié."); } catch { setToast("Copie bloquée : utilise l’aperçu ou le fichier HTML."); } };
  const downloadMailDraft = () => { download(attachmentName.replace(/\.html$/, ".eml"), buildMailDraft({ ...data.mail, html: mailHtml, attachment: { name: attachmentName, html: interactiveHtml } }), "message/rfc822"); setToast("Mail préparé avec la page jointe. Ouvre le fichier .eml dans Outlook pour vérifier et envoyer."); };
  const dragHtml = (event: DragEvent<HTMLElement>) => { if (!can("exports.html")) { event.preventDefault(); return; } const url = URL.createObjectURL(new Blob([interactiveHtml], { type: "text/html;charset=utf-8" })); event.dataTransfer.setData("DownloadURL", `text/html:${attachmentName}:${url}`); event.dataTransfer.setData("text/plain", attachmentName); window.setTimeout(() => URL.revokeObjectURL(url), 60000); };

  const overviewModule = <section className="analyst-point-module analyst-overview-module"><header><span>Synthèse de la semaine</span>{editingModule === "overview" ? <textarea className="canvas-action-input" aria-label="Message de synthèse" value={data.note} onChange={(event) => updateData({ note: event.target.value })}/> : <strong>{data.note}</strong>}</header><div className="analyst-point-kpis"><article className="resolved"><span>Terminés semaine</span><strong>{jiraUnavailable ? "—" : jiraCounts.resolved}</strong><small>{jiraUnavailable ? "Données Jira en attente" : manualJira ? "Total saisi manuellement" : "Selon la dernière modification Jira"}</small></article><article><span>Simulations</span><strong>{stats.simulations}</strong><small>{movementLabel(stats.movement)}</small></article><article><span>Contrôles</span><strong>{stats.controls}</strong><small>{stats.distinctTasks} tâche{stats.distinctTasks > 1 ? "s" : ""} distincte{stats.distinctTasks > 1 ? "s" : ""}</small></article><article><span>Dossiers actifs</span><strong>{data.dossiers.filter((item) => !closed(item.status)).length}</strong><small>{data.dossiers.length} au total</small></article></div></section>;
  const jiraModule = manualJira && editingModule === "jira" ? <ManualAnalystJira counts={jiraCounts} onChange={(manualJiraCounts) => updateData({ manualJiraCounts })}/> : manualJira ? <section className="analyst-point-module"><header><div><span>Saisie manuelle</span><h2>Activité Jira de la semaine</h2></div></header><div className="analyst-point-kpis"><article><span>Terminés</span><strong>{jiraCounts.resolved}</strong></article><article><span>Encore ouverts</span><strong>{jiraCounts.open}</strong></article></div><p className="comparison-caption">Totaux renseignés pour cette semaine. L’historique et les détails du registre restent séparés.</p></section> : <AnalystJiraPanel analystName={analyst.name} pointDate={data.meetingDate} tickets={data.jiraResolved} unavailable={jiraUnavailable}
    history={jiraHistory} previousWeek={previousJiraWeek} settings={data.preferences.jiraChart}
    onSettingsChange={(jiraChart) => updateData({ preferences: { ...data.preferences, jiraChart } })}
    onSelectWeek={(week) => choosePointWeek(week, true)} onRetry={refreshJira} editing={editingModule === "jira"}/>;
  const plannerModule = <section className="analyst-point-module analyst-planner-module"><header><div><span>Planner</span><h2>Simulations et contrôles</h2><p>{dateLabel(data.periodFrom)} → {dateLabel(data.periodTo)} · source actualisée {plannerUpdatedAt ? new Date(plannerUpdatedAt.replace(" ", "T") + (plannerUpdatedAt.includes("Z") ? "" : "Z")).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "non importée"}</p></div><div className="analyst-planner-total"><strong>{stats.totalActivities}</strong><span>activités</span></div></header>{editingModule === "planner" && <div className="form-grid analyst-inline-period"><label className="field"><span>Du</span><SafeDateInput value={data.periodFrom} max={data.periodTo} onCommit={(periodFrom) => setPeriod({ periodFrom })}/></label><label className="field"><span>Au</span><SafeDateInput value={data.periodTo} min={data.periodFrom} onCommit={(periodTo) => setPeriod({ periodTo })}/></label><PlannerImportDialog markets={markets} onImport={onPlannerImport}/></div>}<div className="analyst-delay-grid">{stats.delaySummaries.map((delay) => <article key={delay.kind}><span>{delay.label}</span><strong>{daysLabel(delay.average)}</strong><small>{delay.previousAverage === null || delay.average === null ? "Pas de comparaison" : `${delay.average - delay.previousAverage > 0 ? "+" : ""}${daysLabel(delay.average - delay.previousAverage)} vs période précédente`}</small><b>{delay.sampleCount} dossier{delay.sampleCount > 1 ? "s" : ""}</b></article>)}</div>{groupedActivities.length ? <div className="analyst-activity-list">{groupedActivities.map((task) => <article key={task.taskId}><div><strong>{task.taskName}</strong><small>{task.activities.map((item) => item.marketIds.map((id) => markets.find((market) => market.id === id)?.name).filter(Boolean).join(" · ")).filter(Boolean).join(" · ") || "Marché non rapproché"}</small><SupplierTurnover value={task.purchases12m}/></div><div>{task.activities.map((item, index) => <span className={item.specialty} key={`${item.taskId}-${item.specialty}-${index}`}>{item.specialty === "simulation" ? "Simulation" : "Contrôle"} · {dateLabel(item.date)}</span>)}</div></article>)}</div> : <div className="analyst-module-empty">Aucune simulation ou contrôle attribué à cet analyste sur la période.</div>}</section>;
  const cycleModule = <section className="analyst-point-module analyst-cycle-module"><header><span>Repère séparé</span><h2>Cycle du 20 au 20</h2><p>{dateLabel(data.cycleFrom)} → {dateLabel(data.cycleTo)}</p></header>{editingModule === "cycle20" && <div className="form-grid analyst-inline-period"><label className="field"><span>Cycle du</span><SafeDateInput value={data.cycleFrom} max={data.cycleTo} onCommit={(cycleFrom) => updateData({ cycleFrom })}/></label><label className="field"><span>Cycle au</span><SafeDateInput value={data.cycleTo} min={data.cycleFrom} onCommit={(cycleTo) => updateData({ cycleTo })}/></label></div>}<div><article><span>Simulations</span><strong>{cycleStats.simulations}</strong></article><article><span>Contrôles</span><strong>{cycleStats.controls}</strong></article><article><span>Tâches</span><strong>{cycleStats.distinctTasks}</strong></article></div><small>Ce bloc ne s’ajoute pas aux totaux de la semaine : il sert uniquement de repère complémentaire.</small></section>;
  const dossiersModule = <section className="analyst-point-module analyst-dossiers-module"><header><div><span>Suivis manuels</span><h2>Dossiers</h2></div><strong>{data.dossiers.filter((item) => !closed(item.status)).length} actif{data.dossiers.filter((item) => !closed(item.status)).length > 1 ? "s" : ""}</strong></header>{data.dossiers.length ? <div>{data.dossiers.map((item) => dossierCard(item, editingModule === "dossiers", (patch) => updateDossier(item.id, patch), () => updateData({ dossiers: data.dossiers.filter((row) => row.id !== item.id) })))}</div> : <div className="analyst-module-empty">Aucun dossier renseigné.</div>}{editingModule === "dossiers" && <div className="title-actions"><button type="button" className="secondary-button" disabled={!previousRecord} onClick={carryPrevious}>Reprendre le précédent</button><button type="button" className="primary-button" onClick={() => updateData({ dossiers: [...data.dossiers, { id: uid(), title: "", status: "En cours", action: "", deadline: "", comment: "", progress: 0, showProgress: false }] })}>Ajouter un dossier</button></div>}</section>;
  const moduleContent: Record<AnalystPointModule, ReactNode> = { overview: overviewModule, jira: jiraModule, planner: plannerModule, cycle20: cycleModule, dossiers: dossiersModule };

  const editor = <fieldset className="meeting-editor-fields" disabled={loading || !canEdit}><div className="analyst-edit-layout"><SourceModeControl label="Tickets Jira" mode={data.jiraMode} busy={sourceChanging} onChange={(next) => { void changeJiraMode(next); }}/>{manualJira && <ManualAnalystJira counts={jiraCounts} onChange={(manualJiraCounts) => updateData({ manualJiraCounts })}/>}<section className="surface analyst-point-form"><header><div><span>Cadre du point</span><strong>Périodes et diffusion</strong></div><div><PlannerImportDialog markets={markets} onImport={onPlannerImport}/></div></header><div className="form-grid"><label className="field"><span>Du</span><SafeDateInput value={data.periodFrom} max={data.periodTo} onCommit={(periodFrom) => setPeriod({ periodFrom })}/></label><label className="field"><span>Au</span><SafeDateInput value={data.periodTo} min={data.periodFrom} onCommit={(periodTo) => setPeriod({ periodTo })}/></label><label className="cycle-toggle field-wide"><input type="checkbox" checked={data.includeCycle20} onChange={(event) => updateData({ includeCycle20: event.target.checked })}/><span><strong>Afficher le repère 20 → 20</strong><small>{dateLabel(data.cycleFrom)} → {dateLabel(data.cycleTo)} · bloc séparé des totaux de la semaine</small></span></label>{data.includeCycle20 && <><label className="field"><span>Cycle du</span><SafeDateInput value={data.cycleFrom} max={data.cycleTo} onCommit={(cycleFrom) => updateData({ cycleFrom })}/></label><label className="field"><span>Cycle au</span><SafeDateInput value={data.cycleTo} min={data.cycleFrom} onCommit={(cycleTo) => updateData({ cycleTo })}/></label></>}</div></section>
      <details className="analyst-options-section"><summary>Destinataires et mail</summary><section className="surface analyst-mail-settings"><header><span>Destinataires automatiques</span><strong>{[analyst.name, manager?.name].filter(Boolean).join(" · ")}</strong><small>L’analyste et le manager Tarif sont destinataires principaux.</small></header><div className="form-grid"><label className="field field-wide"><span>À</span><input value={data.mail.to} onChange={(event) => updateData({ mail: { ...data.mail, to: event.target.value } })}/></label><label className="field field-wide"><span>Copie</span><input value={data.mail.cc} onChange={(event) => updateData({ mail: { ...data.mail, cc: event.target.value } })}/></label><label className="field field-wide"><span>Objet</span><input value={data.mail.subject} onChange={(event) => updateData({ mail: { ...data.mail, subject: event.target.value } })}/></label><label className="field field-wide"><span>Introduction</span><textarea value={data.mail.intro} onChange={(event) => updateData({ mail: { ...data.mail, intro: event.target.value } })}/></label></div></section></details>
      <details className="analyst-options-section"><summary>Disposition et visibilité des blocs</summary><section className="surface analyst-layout-settings"><ModuleLayoutEditor modules={analystPointModules} order={data.preferences.order} widths={data.preferences.widths} onChangeOrder={setLayoutOrder} onChangeWidth={setLayoutWidth}/><div className="analyst-visibility-grid">{(["readModules", "mailModules", "htmlModules"] as const).map((destination) => <article key={destination}><strong>{destination === "readModules" ? "Lecture" : destination === "mailModules" ? "Mail blanc" : "HTML interactif"}</strong>{analystPointModules.map((module) => <label key={module.id}><input type="checkbox" checked={data.preferences[destination][module.id]} onChange={(event) => setVisibility(destination, module.id, event.target.checked)}/><span>{module.label}</span></label>)}</article>)}</div></section></details>
      <details className="analyst-options-section"><summary>Semaines enregistrées</summary><section className="analyst-history"><div className="section-title"><div><span>Historique</span><h2>Semaines sauvegardées</h2><p>Recharge une semaine pour la lire ou la mettre à jour.</p></div></div>{records.length ? <div>{records.map((record) => <button type="button" key={record.id} className={record.id === activeRecordId ? "active" : ""} onClick={() => choosePointWeek(record)}><span>{record.year}</span><strong>S{String(record.week).padStart(2, "0")}</strong><small>{dateLabel(record.periodFrom)} → {dateLabel(record.periodTo)}</small><b>{analystJiraCounts(record.data).resolved} terminés · {record.data.dossiers.length} dossiers</b></button>)}</div> : <div className="analyst-module-empty">Aucune semaine sauvegardée.</div>}</section></details>
    </div></fieldset>;

  const restoreConflict = (draft: PointDraft, snapshot: DraftSnapshot) => {
    ++selection.current;
    const next = automaticRecipients(normalizeAnalystPoint(draft.data, analyst, manager), analyst, manager);
    setData(next); setChartReferenceDate(next.meetingDate); setActiveRecordId(snapshot.point?.id ?? "");
    if (snapshot.point) {
      const shared = normalizeAnalystPoint(snapshot.point.data, analyst, manager), sharedPeriod = isoWeekParts(shared.meetingDate);
      const record: AnalystPointRecord = { ...snapshot.point, analystId: analyst.id, ...sharedPeriod, meetingDate: shared.meetingDate, periodFrom: shared.periodFrom, periodTo: shared.periodTo, updatedAt: snapshot.point.updatedAt ?? snapshot.point.createdAt, data: shared };
      setRecords((current) => [record, ...current.filter((row) => row.year !== sharedPeriod.year || row.week !== sharedPeriod.week)].sort((a, b) => b.year - a.year || b.week - a.week));
    }
    setToast("Brouillon sauvegardé. Tu peux poursuivre le point.");
  };

  return <main className="analyst-point-page analyst-point-v98">
    <header className="analyst-point-hero"><div><span>Point analyste</span><h1>{analyst.name}</h1><p>Suivi descriptif de l’activité et des dossiers, sans objectif individuel.</p></div><div className="analyst-point-controls"><label><span>Analyste</span><select value={analyst.id} onChange={(event) => { setLoading(true); setRecords([]); setActiveRecordId(""); ++selection.current; if (canEdit) writeLocalDraft({ scope: "analyst", ownerId: analyst.id, data }); setAnalystId(event.target.value); }}>{analysts.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><AnalystWeekPicker value={data.meetingDate} savedWeeks={records} disabled={loading || saving} onSelect={choosePointWeek}/></div></header>
    <div className="analyst-point-toolbar"><div className="segmented-control"><button type="button" className={mode === "read" ? "active" : ""} onClick={() => { setMeetingEditing(false); setMode("read"); }}>Lecture</button><button type="button" className={settingsOpen ? "active" : ""} onClick={() => { setMeetingEditing(false); setSettingsOpen(true); }}>Réglages</button><button type="button" className={mode === "mail" ? "active" : ""} onClick={() => { setMeetingEditing(false); setMode("mail"); }}>Mail</button></div><div><span className={activeRecordId ? "analyst-saved-state saved" : "analyst-saved-state"}>{loading ? "Chargement…" : activeRecordId ? JSON.stringify(records.find((record) => record.id === activeRecordId)?.data) === JSON.stringify(data) ? "Semaine enregistrée" : "Modifications à partager" : "Nouveau brouillon"}</span><button type="button" className="primary-button" disabled={saving || jiraUnavailable} onClick={save}>{saving ? "Enregistrement…" : "Sauvegarder la semaine"}</button></div></div>

    {!loading && <PointSyncStatus key={`${analyst.id}:${data.meetingDate}`} scope="analyst" ownerId={analyst.id} date={data.meetingDate} compact={mode === "read"} onRestore={restoreConflict} onReconnect={onReconnect}/>}
    <details className="analyst-source-details"><summary>Sources et actualisation</summary><PointSourceStatus sources={{ ...data.sourceFreshness, planner: plannerUpdatedAt }} jiraMode={data.jiraMode}/></details>
    {jiraUnavailable && <section className={`analyst-jira-load-state${jiraError ? " error" : ""}`} role={jiraError ? "alert" : "status"}><div><strong>{jiraLoading ? "Chargement des tickets Jira…" : "Tickets Jira non chargés"}</strong><span>{jiraLoading ? "Rapprochement avec le registre global pour la semaine sélectionnée." : jiraError}</span>{jiraError && <small>Réessaie le chargement ou passe en saisie manuelle pour continuer le point.</small>}</div>{jiraError && <div className="title-actions"><button type="button" className="secondary-button" onClick={refreshJira}>Réessayer</button><button type="button" className="primary-button" onClick={() => { void changeJiraMode("manual"); setMeetingEditing(true); }}>Passer en manuel</button></div>}</section>}

    {mode === "read" && <AnalystPointCanvas key={`${analyst.id}:${data.meetingDate}`} order={data.preferences.order} widths={data.preferences.widths} visible={data.preferences.readModules} includeCycle20={data.includeCycle20} editing={canEdit ? editingModule : null} onEdit={module=>{if(canEdit)setEditingModule(module);}} onOrder={setLayoutOrder} onWidth={setLayoutWidth} onVisibility={(id, checked) => setVisibility("readModules", id, checked)} onSettings={() => {if(canEdit)setSettingsOpen(true);}} disabled={loading || !canEdit}>
      {(module) => <>{module === "jira" && editingModule === "jira" && <SourceModeControl label="Tickets Jira" mode={data.jiraMode} busy={sourceChanging} onChange={(next) => { void changeJiraMode(next); }}/>} {moduleContent[module]}</>}
    </AnalystPointCanvas>}
    <AppDialog open={settingsOpen && canEdit} onClose={() => setSettingsOpen(false)} labelledBy="analyst-options-title" className="analyst-options-dialog"><header><h2 id="analyst-options-title">Options du point analyste</h2><p>Périodes, sources, diffusion et blocs visibles.</p></header>{editor}</AppDialog>

    {mode === "mail" && !jiraExportUnavailable && <section className="analyst-mail-page"><div className="mail-toolbar"><div><span>Mail blanc</span><strong>Version Outlook + fichier HTML interactif</strong><small>À : {data.mail.to || "destinataires à compléter"}</small></div><div><button type="button" className="secondary-button" onClick={copyMail}>Copier le mail</button><button type="button" className="secondary-button" onClick={() => download(attachmentName.replace(/\.html$/, "-mail.html"), mailHtml)}>Version mail</button><button type="button" className="secondary-button" onClick={() => download(attachmentName, interactiveHtml)}>Télécharger la page</button><button type="button" className="primary-button" onClick={downloadMailDraft}>Préparer le mail + la page</button></div></div><article className="html-attachment-card" draggable onDragStart={dragHtml}><span>HTML</span><div><strong>{attachmentName}</strong><small>Liens Jira cliquables et détails dépliables</small></div><b>Glisser dans Outlook</b></article><div className="mail-frame-wrap"><iframe title="Aperçu du mail analyste" srcDoc={mailHtml}/></div></section>}
    {mode === "mail" && jiraExportUnavailable && !jiraUnavailable && <section className="analyst-jira-load-state" role="status"><div><strong>{jiraHistory.loading ? "Chargement du graphique Jira…" : "Graphique Jira indisponible"}</strong><span>{jiraHistory.error || "Le mail et le HTML attendent les chiffres du graphique."}</span></div>{jiraHistory.error && <button type="button" className="secondary-button" onClick={refreshJira}>Réessayer</button>}</section>}
    {toast && <div className="toast">{toast}</div>}
  </main>;
}
