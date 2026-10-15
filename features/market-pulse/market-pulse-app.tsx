"use client";
import { WorkspaceHelp } from "@/components/workspace-help";
import { APP_VERSION } from "@/lib/app-version";
import { appFetch as fetch, isLocalWorkspace, markLocalFormPending, readLocalDraft, writeLocalDraft, saveLocalFile, markPointSaved, hasUnsavedSessionDrafts, configureHostedDrafts, loadPointDraft, preparePointSave, finishPointSave, hostedPointDrafts } from "@/lib/app-transport";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type DragEvent as ReactDragEvent, type ReactNode } from "react";
import { normalizeJiraRules } from "@/lib/jira-alert-rules";
import { PointSyncStatus, DraftQueueStatus } from "./point-sync-status";
import { PointSourceStatus } from "./point-source-status";
import type { DraftSnapshot, PointDraft, StoredPointDraft } from "@/lib/point-persistence";
import { AppDialog } from "@/components/app-dialog";
import { AppIcon as Icon } from "@/components/app-icon";
import { AppearanceProvider } from "@/components/appearance-provider";
import { AppearanceControl, AppearanceSettings } from "@/components/appearance-control";
import { ActionMenu } from "@/components/action-menu";
import { accentTokens } from "@/lib/color-contrast";
import type { ModuleWidth } from "@/components/module-layout-editor";
import { GLOBAL_ROLE_OPTIONS, roleLabel, roleMailMode, roleUsesAutomaticJira, type GlobalDirectoryUser, type GlobalRole } from "@/lib/global-directory";
import { JIRA_SUMMARY_STATUSES } from "@/lib/jira-import";
import { type PlannerTask } from "@/lib/planner-import";
import type { PlannerRegistrySummary } from "@/lib/planner-registry";
import { AnalystPointDashboard } from "./analyst-point-dashboard";
import { AnalystStatsDashboard } from "./analyst-stats-dashboard";
import { ImportCenter } from "./import-center";
import { PlannerImportDialog } from "./planner-import-dialog";
import { WorkspaceNavigation, workspaceTitles } from "./workspace-navigation";
import { SourceModeControl } from "./source-mode-control";
import { MarketComparisonChart } from "./market-comparison";
import { type PointSourceMode } from "@/lib/point-source-mode";
import { buildMailDraft, mailPlainText } from "@/lib/mail-draft";
import { marketComparisonColors, openTicketCount, type MarketComparisonRow } from "@/lib/market-comparison";
import { MARKET_SIMULATION_STATES, hasMarketSimulationOverride, resolveMarketSimulationFields, updateMarketSimulationOverride, type MarketSimulationFields } from "@/lib/market-simulation";
import { View, Section, FontScale, Density, PointModule, Dossier, CommercialOperation, Promotion, JiraPointFields, JiraPointOverride, JiraTicket, PointData, ThemeKey, Market, PointRecord, SessionPayload, DirectoryDraft, DirectoryEditor, ConfirmRequest, defaultMarkets, themes, statusOptions, pointModules, allModulesVisible, defaultModuleOrder, defaultModuleWidths, copyPreferences, emptyPlannerRegistry, emptyDirectoryDraft, uid, isoToday, isIsoDate, validHex, normalizeHex, isRecord, initialData, normalizePointData, pointSignature, fetchPointRecords, fetchMarkets, fetchDirectoryUsers, fetchPlannerTasks, applyDirectoryMail, plannerTasksForPoint, mergePlannerOperations, isoWeek, isoWeekYear, weekInputValue, dateFromWeekInput, monthStart, shiftMonth, calendarMonthLabel, weeksForMonth, dateLabel, daysBetween, isClosed, operationIdentity, isOperationClosed, isPromotionClosed, carriedFromLabel, jiraItemCount, jiraStatusSummary, groupJiraPeople, interactiveAttachmentName, resolveJiraFields, hasJiraOverride, jiraTicketsFromSummary, fetchJiraWeek, applyJiraWeek, toneForStatus } from "./point-model";
import { PreviewDashboard, JiraVolumePulse, type PointCanvasActions } from "./point-preview";
import { buildMailHtml, buildInteractiveHtml } from "./point-exports";

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
  const [carryoverOpen, setCarryoverOpen] = useState(false);
  const [carryoverSelection, setCarryoverSelection] = useState<Record<string, boolean>>({});
  const [calendarExpanded, setCalendarExpanded] = useState(false);
  const [meetingEditing, setMeetingEditing] = useState(false);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [refreshingImports, setRefreshingImports] = useState(false);
  const [sourceChanging, setSourceChanging] = useState<"jira" | "planner" | null>(null);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const [directorySort, setDirectorySort] = useState<{ key: "name" | "role" | "market"; direction: "asc" | "desc" }>({ key: "name", direction: "asc" });
  const fileInput = useRef<HTMLInputElement>(null);
  const archiveRequest = useRef(0);
  const resumedDrafts = useRef(new Set<string>());
  const confirmResolver = useRef<((confirmed: boolean) => void) | null>(null);
  const comparisonRequest = useRef(0);
  const comparisonContext = useRef("");
  const undoStack = useRef<PointData[]>([]);
  const redoStack = useRef<PointData[]>([]);
  const previousData = useRef(data);
  const historyRestoring = useRef(false);
  const lastHistoryAt = useRef(0);
  const [historyAvailability, setHistoryAvailability] = useState({ undo: false, redo: false });
  const comparisonContextValue = `${marketId}:${data.meetingDate}`;
  const market = marketOptions.find((item) => item.id === marketId) ?? marketOptions[0] ?? defaultMarkets[0];
  const marketPlannerTagsKey = market.plannerTags.join("|");
  const theme = themes.find((item) => item.id === data.themeColor) ?? themes[0];
  const accent = normalizeHex(data.customColor) || theme.accent;
  const themeStyle = ({ ...accentTokens(accent), "--point-font-scale": String(data.preferences.fontScalePercent / 100) }) as CSSProperties;
  const preparedData = useMemo(() => {
    const snapshot = data.marketComparison;
    if (!snapshot || snapshot.year !== isoWeekYear(data.meetingDate) || snapshot.week !== isoWeek(data.meetingDate)) return { ...data, marketComparison: null };
    if (data.jiraMode !== "manual") return data;
    return { ...data, marketComparison: { ...snapshot, rows: snapshot.rows.map((row): MarketComparisonRow => row.marketId === marketId ? { ...row, count: openTicketCount(data.jira), source: "manual", updatedAt: data.meetingDate } : row) } };
  }, [data, marketId]);
  const mailHtml = useMemo(() => view === "mail" ? buildMailHtml(preparedData, market, archive) : "", [archive, preparedData, market, view]);
  const interactiveHtml = useMemo(() => view === "mail" ? buildInteractiveHtml(preparedData, market, archive) : "", [archive, preparedData, market, view]);
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
    setArchiveLoading(true);
    setArchiveError("");
    try {
      const points = await fetchPointRecords(nextMarket, marketOverride);
      if (requestId !== archiveRequest.current) return;
      points.forEach((point) => markPointSaved({ scope: "market", ownerId: nextMarket, data: point.data }, point));
      if (loadLatest) {
        const draft = await loadPointDraft("market", nextMarket);
        if (requestId !== archiveRequest.current) return;
        const latest = points[0];
        if (draft) {
          const draftData = normalizePointData(draft.data, nextMarket, marketOverride);
          resumedDrafts.current.add(`${nextMarket}:${isoWeekYear(draftData.meetingDate)}:${isoWeek(draftData.meetingDate)}`);
          const saved = points.find((point) => point.year === isoWeekYear(draftData.meetingDate) && point.week === isoWeek(draftData.meetingDate));
          const nextData = draftData;
          setData(nextData);
          setCalendarMonth(monthStart(nextData.meetingDate));
          setActiveRecordId(saved?.id ?? null);
          setSavedAt(saved ? new Date(saved.createdAt) : null);
          setLastSavedSignature(saved ? pointSignature(nextMarket, saved.data) : "");
        } else if (latest) {
          const nextData = normalizePointData(latest.data, nextMarket, marketOverride);
          setData(nextData);
          setCalendarMonth(monthStart(nextData.meetingDate));
          setActiveRecordId(latest.id);
          setSavedAt(new Date(latest.createdAt.replace(" ", "T") + (latest.createdAt.includes("Z") ? "" : "Z")));
          setLastSavedSignature(pointSignature(nextMarket, nextData));
        } else {
          const nextData = await applyJiraWeek(initialData(nextMarket, marketOverride), nextMarket);
          if (requestId !== archiveRequest.current) return;
          setData(nextData);
          setCalendarMonth(monthStart(nextData.meetingDate));
          setActiveRecordId(null);
          setSavedAt(null);
          setLastSavedSignature("");
        }
      }
      setMarketId(nextMarket);
      setArchive(points);
    } catch (error) {
      if (requestId !== archiveRequest.current) return;
      setArchiveError(error instanceof Error ? error.message : "Impossible de charger les sauvegardes.");
      setToast("Chargement impossible. Le point affiché et ses modifications sont conservés.");
    } finally {
      if (requestId === archiveRequest.current) {
        setArchiveLoading(false);
        setReady(true);
      }
    }
  }, []);

  const bootstrap = useCallback(async () => {
    try {
      const [loadedMarkets, currentSession] = await Promise.all([fetchMarkets(), fetch("/api/session", { cache: "no-store" }).then(async (response) => { const payload = await response.json() as SessionPayload; if (!response.ok || !payload.user) throw new Error("L’espace partagé est indisponible. Réessaie sans fermer la page."); return payload; })]);
      configureHostedDrafts(currentSession.user?.username ?? null);
      setSession(currentSession);
      if (currentSession.user) {
        const requestedMode = new URLSearchParams(window.location.search).get("mode");
        if (requestedMode === "edit") { setView("read"); setMeetingEditing(true); }
        else if (requestedMode === "analyst" || requestedMode === "stats" || requestedMode === "imports" || requestedMode === "settings") setView(requestedMode);
      }
      const options = loadedMarkets.length ? loadedMarkets : defaultMarkets;
      setMarketOptions(options);
      const firstMarket = options.find((item) => item.id === "revetements-menuiserie") ?? options[0];
      await loadMarket(firstMarket.id, true, firstMarket);
    } catch (error) {
      setMarketOptions(defaultMarkets);
      await loadMarket(defaultMarkets[0].id, true, defaultMarkets[0]);
      setToast(error instanceof Error ? error.message : "Impossible de charger les marchés.");
    } finally { setSessionReady(true); }
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
  useEffect(() => { comparisonContext.current = comparisonContextValue; }, [comparisonContextValue]);
  useEffect(() => {
    if (!session.user) return;
    const timer = window.setTimeout(() => { void Promise.all([loadDirectory(), loadPlanner()]); }, 0);
    return () => window.clearTimeout(timer);
  }, [session.user, loadDirectory, loadPlanner]);
  useEffect(() => {
    if (!session.user || !directoryReady || archiveLoading) return;
    const timer = window.setTimeout(() => setData((current) => applyDirectoryMail(current, marketId, directoryUsers)), 0);
    return () => window.clearTimeout(timer);
  }, [archiveLoading, data, directoryReady, directoryUsers, marketId, session.user]);
  useEffect(() => {
    if (!session.user || !ready || archiveLoading || !plannerReady || !plannerTasks.length || data.plannerMode === "manual" || activeRecordId) return;
    if (resumedDrafts.current.has(`${marketId}:${isoWeekYear(data.meetingDate)}:${isoWeek(data.meetingDate)}`)) return;
    const timer = window.setTimeout(() => setData((current) => current.plannerMode === "manual" ? current : ({ ...current, sourceFreshness: { ...current.sourceFreshness, planner: plannerUpdatedAt }, operations: mergePlannerOperations(current.operations, plannerTasksForPoint(plannerTasks, market, current.meetingDate), plannerTasks) })), 0);
    return () => window.clearTimeout(timer);
  }, [activeRecordId, archiveLoading, data.meetingDate, data.plannerMode, market, marketId, marketPlannerTagsKey, plannerReady, plannerTasks, plannerUpdatedAt, ready, session.user]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(""), 2600); return () => window.clearTimeout(timer); }, [toast]);
  useEffect(() => {
    if (!ready || archiveLoading || !session.user) return;
    writeLocalDraft({ scope: "market", ownerId: marketId, data });
  }, [archiveLoading, data, marketId, ready, session.user]);
  useEffect(() => {
    markLocalFormPending("directory-editor", directoryEditor !== null);
    return () => markLocalFormPending("directory-editor", false);
  }, [directoryEditor]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [view]);
  useEffect(() => {
    if (isLocalWorkspace() || !session.user) return;
    const protectDraft = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedSessionDrafts()) return;
      event.preventDefault(); event.returnValue = "";
    };
    const synchronize = () => { void hostedPointDrafts.flushAll(); };
    const onHidden = () => { if (document.visibilityState === "hidden") void hostedPointDrafts.flushAll(true); };
    window.addEventListener("beforeunload", protectDraft);
    window.addEventListener("online", synchronize);
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", onHidden);
    return () => { window.removeEventListener("beforeunload", protectDraft); window.removeEventListener("online", synchronize); if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onHidden); };
  }, [session.user]);
  useEffect(() => {
    const previous = previousData.current;
    if (historyRestoring.current) {
      historyRestoring.current = false;
    } else if (session.user && view === "read" && previous !== data) {
      const now = Date.now();
      if (!undoStack.current.length || now - lastHistoryAt.current > 650) {
        undoStack.current.push(previous);
        if (undoStack.current.length > 80) undoStack.current.shift();
      }
      redoStack.current = [];
      lastHistoryAt.current = now;
    }
    previousData.current = data;
    const timer = window.setTimeout(() => setHistoryAvailability({ undo: undoStack.current.length > 0, redo: redoStack.current.length > 0 }), 0);
    return () => window.clearTimeout(timer);
  }, [data, session.user, view]);
  useEffect(() => {
    undoStack.current = [];
    redoStack.current = [];
    previousData.current = data;
    lastHistoryAt.current = 0;
    const timer = window.setTimeout(() => setHistoryAvailability({ undo: false, redo: false }), 0);
    // A change of saved point starts a separate editing history.
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketId, activeRecordId, currentWeek, currentWeekYear]);

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
  const undoPoint = () => {
    const previous = undoStack.current.pop();
    if (!previous) return;
    redoStack.current.push(data);
    historyRestoring.current = true;
    lastHistoryAt.current = 0;
    setData(previous);
    setHistoryAvailability({ undo: undoStack.current.length > 0, redo: redoStack.current.length > 0 });
  };
  const redoPoint = () => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(data);
    historyRestoring.current = true;
    lastHistoryAt.current = 0;
    setData(next);
    setHistoryAvailability({ undo: undoStack.current.length > 0, redo: redoStack.current.length > 0 });
  };

  const retryWorkspace = () => { void bootstrap(); };

  const chooseView = (nextView: View) => {
    setMeetingEditing(false);
    if (nextView === "settings") setSection("personalization");
    if (nextView === "edit") { setView("read"); setMeetingEditing(true); return; }
    setView(nextView);
  };

  const chooseMarket = async (nextMarket: string) => {
    if (archiveLoading || nextMarket === marketId) return;
    if (session.user) writeLocalDraft({ scope: "market", ownerId: marketId, data });
    if (isDirty && !saving && !autoSaveError) void savePoint(true);
    setSection("general");
    await loadMarket(nextMarket, true, marketOptions.find((item) => item.id === nextMarket));
    setCalendarExpanded(false);
  };
  const updateDossier = (id: string, patch: Partial<Dossier>) => { if (patch.title !== undefined && patch.titleHtml === undefined) patch = { ...patch, titleHtml: "" }; setData((current) => ({ ...current, dossiers: current.dossiers.map((item) => item.id === id ? { ...item, ...patch } : item) })); };
  const updateOperation = (id: string, patch: Partial<CommercialOperation>) => setData((current) => ({ ...current, operations: current.operations.map((item) => {
    if (item.id !== id) return item;
    if (!item.plannerSource || !item.plannerBase) return { ...item, ...patch };
    const editablePatch = Object.fromEntries(((["name", "month", "state", "summary"] as const)).filter((key) => typeof patch[key] === "string").map((key) => [key, patch[key]])) as Partial<MarketSimulationFields>;
    const plannerOverride = updateMarketSimulationOverride(item.plannerBase, item.plannerOverride, editablePatch);
    return { ...item, ...patch, ...resolveMarketSimulationFields(item.plannerBase, plannerOverride), ...(hasMarketSimulationOverride(plannerOverride) ? { plannerOverride } : { plannerOverride: undefined }) };
  }) }));
  const resetOperationOverride = (id: string) => setData((current) => ({ ...current, operations: current.operations.map((item) => item.id === id && item.plannerBase ? { ...item, ...item.plannerBase, plannerOverride: undefined } : item) }));
  const updatePromotion = (id: string, patch: Partial<Promotion>) => setData((current) => ({ ...current, promotions: current.promotions.map((item) => item.id === id ? { ...item, ...patch } : item) }));
  const updateJira = (id: string, patch: Partial<JiraPointFields>) => setData((current) => ({ ...current, jira: current.jira.map((item) => {
    if (item.id !== id) return item;
    if (!item.importedBase) return { ...item, ...patch };
    const next: JiraPointOverride = { ...item.pointOverride };
    (Object.keys(patch) as (keyof JiraPointFields)[]).forEach((key) => {
      const value = patch[key];
      if (value === item.importedBase?.[key]) delete next[key];
      else if (value !== undefined) (next as Record<string, unknown>)[key] = value;
    });
    if (hasJiraOverride(next)) next.updatedAt = new Date().toISOString();
    else delete next.updatedAt;
    return { ...item, ...resolveJiraFields(item.importedBase, next), ...(hasJiraOverride(next) ? { pointOverride: next } : { pointOverride: undefined }) };
  }) }));
  const resetJiraOverride = (id: string) => setData((current) => ({ ...current, jira: current.jira.map((item) => item.id === id && item.importedBase ? { ...item, ...item.importedBase, pointOverride: undefined } : item) }));
  const updateModuleVisibility = (destination: "readModules" | "mailModules" | "htmlModules", module: PointModule, visible: boolean) => setData((current) => ({ ...current, preferences: { ...current.preferences, [destination]: { ...current.preferences[destination], [module]: visible } } }));
  const updateModuleWidth = (module: PointModule, width: ModuleWidth) => setData((current) => ({ ...current, preferences: { ...current.preferences, moduleWidths: { ...current.preferences.moduleWidths, [module]: width } } }));
  const insertCanvasModule = (module: PointModule, before: PointModule | null) => setData((current) => {
    const moduleOrder = current.preferences.moduleOrder.filter((item) => item !== module);
    const target = before ? moduleOrder.indexOf(before) : moduleOrder.length;
    moduleOrder.splice(target < 0 ? moduleOrder.length : target, 0, module);
    return { ...current, preferences: { ...current.preferences, moduleOrder, readModules: { ...current.preferences.readModules, [module]: true }, mailModules: { ...current.preferences.mailModules, [module]: true }, htmlModules: { ...current.preferences.htmlModules, [module]: true } } };
  });
  const hideCanvasModule = (module: PointModule) => setData((current) => ({ ...current, preferences: { ...current.preferences, readModules: { ...current.preferences.readModules, [module]: false }, mailModules: { ...current.preferences.mailModules, [module]: false }, htmlModules: { ...current.preferences.htmlModules, [module]: false } } }));
  const moveCanvasModule = (module: PointModule, amount: number) => setData((current) => {
    const moduleOrder = current.preferences.moduleOrder.slice();
    const index = moduleOrder.indexOf(module);
    const target = Math.max(0, Math.min(moduleOrder.length - 1, index + amount));
    if (index < 0 || index === target) return current;
    moduleOrder.splice(index, 1);
    moduleOrder.splice(target, 0, module);
    return { ...current, preferences: { ...current.preferences, moduleOrder } };
  });
  const resetCanvasLayout = () => setData((current) => ({ ...current, preferences: { ...current.preferences, moduleOrder: [...defaultModuleOrder], moduleWidths: { ...defaultModuleWidths }, readModules: allModulesVisible(), mailModules: allModulesVisible(), htmlModules: allModulesVisible() } }));
  const updateFontScalePercent = (value: number) => setData((current) => {
    const fontScalePercent = Math.max(85, Math.min(130, Math.round(value / 5) * 5));
    const fontScale: FontScale = fontScalePercent < 98 ? "compact" : fontScalePercent > 107 ? "large" : "standard";
    return { ...current, preferences: { ...current.preferences, fontScalePercent, fontScale } };
  });
  const addDossier = () => setData((current) => ({ ...current, dossiers: [...current.dossiers, { id: uid(), title: "", universe: "", reference: "", status: "En cours", owner: "", action: "", deadline: "", progress: 0, comment: "" }] }));
  const addOperation = (month = calendarMonthLabel(monthStart(data.meetingDate))) => setData((current) => ({ ...current, operations: [...current.operations, { id: uid(), kind: "simulation", name: "Nouvelle simulation", month, state: "À faire", summary: "", steps: [] }] }));
  const addPromotion = () => setData((current) => ({ ...current, promotions: [...current.promotions, { id: uid(), name: "Nouvelle promotion", period: calendarMonthLabel(monthStart(current.meetingDate)), purchaseNote: "", salesState: "À préparer", action: "", comment: "" }] }));
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
      return { ...current, jira: current.jira.filter((item) => !(isPerson(item) && item.status === status) || item.id === keptId).map((item) => item.id === keptId ? { ...item, count, key: "", internalId: undefined, summary: "Synthèse manuelle", createdAt: "", lastActivity: "", link: "", comment: "Saisie manuelle" } : item) };
    }
    return { ...current, jira: [...current.jira, { id: uid(), key: "", summary: "Synthèse manuelle", status, priority: "", assignee, lastActivity: "", link: "", comment: "Saisie manuelle", count }] };
  });

  const synchronizePlannerPoint = (tasks = plannerTasks) => {
    if (data.plannerMode === "manual") { setToast("Le point est en saisie manuelle. Repasse en import automatique pour le synchroniser."); return 0; }
    const relevant = plannerTasksForPoint(tasks, market, data.meetingDate);
    setData((current) => ({ ...current, sourceFreshness: { ...current.sourceFreshness, planner: plannerUpdatedAt }, operations: mergePlannerOperations(current.operations, relevant, tasks) }));
    setToast(relevant.length ? `${relevant.length} simulation${relevant.length > 1 ? "s" : ""} Planner synchronisée${relevant.length > 1 ? "s" : ""}.` : "Aucune simulation Planner pour ce marché et cette période.");
    return relevant.length;
  };
  const importPlannerData = async (rawText: string) => {
    const selection = archiveRequest.current, context = comparisonContext.current;
    const response = await fetch("/api/planner-tasks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rawText }) });
    const payload = await response.json() as { imported?: number; ignoredRows?: number; error?: string };
    if (!response.ok) throw new Error(payload.error || "Import Planner impossible.");
    const refreshed = await fetchPlannerTasks();
    setPlannerTasks(refreshed.tasks);
    setPlannerRegistry(refreshed.registry);
    setPlannerUpdatedAt(refreshed.updatedAt);
    setPlannerReady(true);
    const relevant = plannerTasksForPoint(refreshed.tasks, market, data.meetingDate);
    if (selection === archiveRequest.current && context === comparisonContext.current) setData((current) => current.plannerMode === "manual" ? current : ({ ...current, sourceFreshness: { ...current.sourceFreshness, planner: refreshed.updatedAt }, operations: mergePlannerOperations(current.operations, relevant, refreshed.tasks) }));
    return {
      imported: payload.imported ?? 0,
      message: `${payload.imported ?? 0} tâche${(payload.imported ?? 0) > 1 ? "s" : ""} enregistrée${(payload.imported ?? 0) > 1 ? "s" : ""} · ${relevant.length} liée${relevant.length > 1 ? "s" : ""} au point actif.`,
    };
  };
  const refreshJiraFromRegistry = async () => {
    if (data.jiraMode === "manual") { setToast("Import enregistré. La saisie manuelle du point est conservée."); return; }
    const selection = archiveRequest.current, context = comparisonContext.current;
    try {
      const payload = await fetchJiraWeek(currentWeekYear, currentWeek, marketId, true);
      if ((selection !== archiveRequest.current || context !== comparisonContext.current)) return;
      if (!payload.snapshot) throw new Error("Aucun import Jira disponible pour cette semaine. Les données du point sont conservées.");
      setData((current) => current.jiraMode === "manual" ? current : ({ ...current, sourceFreshness: { ...current.sourceFreshness, jira: payload.snapshot!.updatedAt }, jira: jiraTicketsFromSummary(payload.snapshot!.summary, payload.assignments[marketId] ?? [], marketId, current.jira) }));
      setToast("Registre Jira actualisé. Les corrections du point sont conservées.");
    } catch (error) {
      if (selection === archiveRequest.current && context === comparisonContext.current) setToast(error instanceof Error ? error.message : "Actualisation Jira impossible. Les données sont conservées.");
    }
  };
  const refreshImports = async () => {
    if (refreshingImports || archiveLoading) return;
    const selection = archiveRequest.current, context = comparisonContext.current;
    setRefreshingImports(true);
    try {
      const [planner, jira] = await Promise.allSettled([
        data.plannerMode === "automatic" ? fetchPlannerTasks() : Promise.resolve(null),
        data.jiraMode === "automatic" ? fetchJiraWeek(currentWeekYear, currentWeek, marketId, true) : Promise.resolve(null),
      ]);
      if ((selection !== archiveRequest.current || context !== comparisonContext.current)) return;
      const errors: string[] = [];
      if (planner.status === "fulfilled" && planner.value) {
        const source = planner.value;
        setPlannerTasks(source.tasks); setPlannerRegistry(source.registry); setPlannerUpdatedAt(source.updatedAt);
        if (source.updatedAt || source.tasks.length) setData((current) => current.plannerMode === "manual" ? current : { ...current, sourceFreshness: { ...current.sourceFreshness, planner: source.updatedAt }, operations: mergePlannerOperations(current.operations, plannerTasksForPoint(source.tasks, market, current.meetingDate), source.tasks) });
        else errors.push("Aucun import Planner disponible.");
      } else if (planner.status === "rejected") errors.push(planner.reason instanceof Error ? planner.reason.message : "Planner indisponible.");
      if (jira.status === "fulfilled" && jira.value) {
        const source = jira.value;
        if (source.snapshot) setData((current) => current.jiraMode === "manual" ? current : { ...current, sourceFreshness: { ...current.sourceFreshness, jira: source.snapshot!.updatedAt }, jira: jiraTicketsFromSummary(source.snapshot!.summary, source.assignments[marketId] ?? [], marketId, current.jira) });
        else errors.push("Aucun import Jira disponible.");
      } else if (jira.status === "rejected") errors.push(jira.reason instanceof Error ? jira.reason.message : "Jira indisponible.");
      setToast(errors.length ? `${errors.join(" ")} Les données concernées sont conservées.` : "Imports actualisés. Les saisies manuelles et corrections du point sont conservées.");
    } finally { setRefreshingImports(false); }
  };
  const setSourceMode = async (source: "jira" | "planner", mode: PointSourceMode) => {
    if (sourceChanging || data[`${source}Mode`] === mode) return;
    const selection = archiveRequest.current;
    if (mode === "manual") { setData((current) => ({ ...current, [`${source}Mode`]: "manual" })); return; }
    if (!await requestConfirmation({ title: "Reprendre les données importées ?", detail: "Le dernier import actualisera les valeurs non modifiées. Les ajouts manuels et les corrections propres à ce point seront conservés.", confirmLabel: "Reprendre l’import" })) return;
    if (selection !== archiveRequest.current) return;
    setSourceChanging(source);
    const context = comparisonContext.current;
    try {
      if (source === "jira") {
        const payload = await fetchJiraWeek(currentWeekYear, currentWeek, marketId, true);
        if (!payload.snapshot) throw new Error("Aucun import Jira disponible. La saisie manuelle est conservée.");
        if (selection === archiveRequest.current && comparisonContext.current === context) setData((current) => ({ ...current, jiraMode: "automatic", sourceFreshness: { ...current.sourceFreshness, jira: payload.snapshot!.updatedAt }, jira: jiraTicketsFromSummary(payload.snapshot!.summary, payload.assignments[marketId] ?? [], marketId, current.jira) }));
      } else {
        if (!plannerReady || (!plannerUpdatedAt && !plannerTasks.length)) throw new Error("Aucun import Planner disponible. La saisie manuelle est conservée.");
        setData((current) => ({ ...current, plannerMode: "automatic", sourceFreshness: { ...current.sourceFreshness, planner: plannerUpdatedAt }, operations: mergePlannerOperations(current.operations, plannerTasksForPoint(plannerTasks, market, current.meetingDate), plannerTasks) }));
      }
    } catch (error) { setToast(error instanceof Error ? error.message : "Actualisation impossible."); }
    finally { setSourceChanging(null); }
  };
  const loadMarketComparison = async () => {
    const requestId = ++comparisonRequest.current, context = comparisonContext.current;
    const year = currentWeekYear, week = currentWeek;
    setComparisonLoading(true);
    const rows = await Promise.all(marketOptions.map(async (item, index): Promise<MarketComparisonRow> => {
      const base = { marketId: item.id, label: item.name, color: item.colorHex || marketComparisonColors[index % marketComparisonColors.length], updatedAt: "" };
      if (item.id === marketId && data.jiraMode === "manual") return { ...base, source: "manual", count: openTicketCount(data.jira), updatedAt: data.meetingDate };
      const records = item.id === marketId ? archive : await fetchPointRecords(item.id, item).catch(() => []);
      const saved = records.find((record) => record.year === year && record.week === week);
      if (item.id !== marketId && saved?.data.jiraMode === "manual") return { ...base, source: "manual", count: openTicketCount(saved.data.jira), updatedAt: saved.meetingDate };
      try {
        const payload = await fetchJiraWeek(year, week, item.id, true);
        if (payload.snapshot) return { ...base, source: "import", count: openTicketCount(jiraTicketsFromSummary(payload.snapshot.summary, payload.assignments[item.id] ?? [], item.id)), updatedAt: payload.snapshot.updatedAt };
      } catch { /* A saved point remains usable when the import is unavailable. */ }
      return saved ? { ...base, source: "saved", count: openTicketCount(saved.data.jira), updatedAt: saved.meetingDate } : { ...base, source: "unavailable", count: null };
    }));
    if (requestId === comparisonRequest.current) {
      if (comparisonContext.current === context) setData((current) => ({ ...current, marketComparison: { metric: "open-jira", year, week, measuredAt: new Date().toISOString(), rows } }));
      setComparisonLoading(false);
    }
  };
  const setComparisonVisible = (visible: boolean) => setData((current) => ({ ...current, preferences: { ...current.preferences, readModules: { ...current.preferences.readModules, comparison: visible }, mailModules: { ...current.preferences.mailModules, comparison: visible }, htmlModules: { ...current.preferences.htmlModules, comparison: visible } } }));
  const editDuringMeeting = () => { if (!session.user) { chooseView("edit"); return; } setView("read"); setMeetingEditing(true); };
  const openPresentation = async () => {
    setMeetingEditing(false);
    try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen(); }
    catch { setToast("Le plein écran est bloqué par ce navigateur."); }
  };
  const useManualImport = (source: "jira" | "planner") => { setData((current) => ({ ...current, [`${source}Mode`]: "manual" })); setView("read"); setMeetingEditing(true); };
  useEffect(() => {
    if (!session.user || !ready || comparisonLoading || preparedData.marketComparison || !(comparisonOpen || data.preferences.readModules.comparison || (view === "mail" && (data.preferences.mailModules.comparison || data.preferences.htmlModules.comparison)))) return;
    const timer = window.setTimeout(() => { void loadMarketComparison(); }, 0);
    // Refresh explicitly after the first snapshot so saved comparisons remain stable.
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comparisonOpen, comparisonLoading, ready, session.user, preparedData.marketComparison, data.preferences.readModules.comparison, data.preferences.mailModules.comparison, data.preferences.htmlModules.comparison, view]);
  const download = (name: string, content: string, type: string) => { const url = URL.createObjectURL(new Blob([content], { type })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 500); };
  const exportJson = (record?: PointRecord) => {
    const exportMarket = record?.marketId ?? marketId; const exportData = record?.data ?? data; const week = record?.week ?? isoWeek(exportData.meetingDate); const year = record?.year ?? isoWeekYear(exportData.meetingDate); const saved = Boolean(record || activeRecordId);
    const exportMarketInfo = marketOptions.find((item) => item.id === exportMarket);
    download(`point-marche-${exportMarket}-${year}-S${String(week).padStart(2, "0")}-${saved ? "enregistre" : "brouillon"}.json`, JSON.stringify({ schemaVersion: 6, marketId: exportMarket, market: exportMarketInfo ? { name: exportMarketInfo.name, shortCode: exportMarketInfo.short, tone: exportMarketInfo.tone, colorHex: exportMarketInfo.colorHex } : undefined, year, week, data: exportData }, null, 2), "application/json");
  };
  const importJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || archiveLoading) return;
    const selection = archiveRequest.current;
    try {
      if (file.size > 2_000_000) throw new Error("Ce fichier de point dépasse la taille acceptée (2 Mo).");
      const payload = JSON.parse(await file.text()) as { marketId?: unknown; data?: unknown };
      if (selection !== archiveRequest.current) return;
      if (!isRecord(payload) || !isRecord(payload.data) || typeof payload.data.meetingDate !== "string" || !isIsoDate(payload.data.meetingDate)) throw new Error("Le fichier doit contenir un point JSON avec une date valide.");
      for (const key of ["dossiers", "operations", "simulations", "promotions", "tariffs", "jira"]) {
        const rows = payload.data[key];
        if (rows !== undefined && (!Array.isArray(rows) || rows.some((row) => !isRecord(row)))) throw new Error(`La liste « ${key} » est incorrecte. Le point actuel est conservé.`);
      }
      const importedMarketInfo = payload.marketId ? marketOptions.find((item) => item.id === payload.marketId) : market;
      if (!importedMarketInfo) throw new Error("Le marché de ce fichier est absent de l’application. Ajoute-le avant d’importer ce point.");
      if (session.user && isDirty && !await requestConfirmation({ title: "Importer ce point ?", detail: "Le fichier remplacera le point affiché. Enregistre d’abord tes modifications si tu souhaites les garder.", confirmLabel: "Importer le point", destructive: true })) return;
      if (selection !== archiveRequest.current) return;
      const importedData = normalizePointData(payload.data, importedMarketInfo.id, importedMarketInfo);
      setMarketId(importedMarketInfo.id); setData(importedData); setCalendarMonth(monthStart(importedData.meetingDate)); setActiveRecordId(null); setSavedAt(null); setLastSavedSignature("");
      writeLocalDraft({ scope: "market", ownerId: importedMarketInfo.id, data: importedData });
      await loadMarket(importedMarketInfo.id, false, importedMarketInfo);
      setToast("JSON importé comme nouveau brouillon.");
    } catch (error) { setToast(error instanceof Error ? error.message : "Fichier non reconnu. Le point actuel est conservé."); }
  };
  const resetPoint = async () => { if (archiveLoading) return; if (!await requestConfirmation({ title: "Réinitialiser cette semaine ?", detail: "Le contenu de cette semaine sera effacé et sauvegardé automatiquement. Les autres semaines restent disponibles dans l’historique.", confirmLabel: "Créer un brouillon vide", destructive: true })) return; ++archiveRequest.current; const fresh = initialData(marketId, market); fresh.meetingDate = data.meetingDate; fresh.dossiers = []; fresh.operations = []; fresh.promotions = []; fresh.tariffs = []; fresh.jira = []; fresh.mail = data.mail; fresh.themeColor = data.themeColor; fresh.customColor = data.customColor; fresh.preferences = copyPreferences(data.preferences); setData(fresh); setCalendarMonth(monthStart(fresh.meetingDate)); setActiveRecordId(null); setSavedAt(null); setLastSavedSignature(""); setToast("Nouveau brouillon créé."); };
  const loadRecord = async (record: PointRecord, nextView: View = view, skipConfirm = false) => {
    if (archiveLoading) return;
    if (session.user) writeLocalDraft({ scope: "market", ownerId: marketId, data });
    ++archiveRequest.current;
    const recordMarket = marketOptions.find((item) => item.id === record.marketId) ?? market;
    const nextData = normalizePointData(record.data, record.marketId, recordMarket);
    setMarketId(record.marketId); setData(nextData); setCalendarMonth(monthStart(nextData.meetingDate)); setActiveRecordId(record.id); setSavedAt(new Date(record.createdAt.replace(" ", "T") + (record.createdAt.includes("Z") ? "" : "Z"))); setLastSavedSignature(pointSignature(record.marketId, nextData)); setSection("general"); setView(nextView); setToast(`${record.year} · S${String(record.week).padStart(2, "0")} chargée.`);
  };
  const chooseWeek = async (value: string) => {
    if (archiveLoading || !/^\d{4}-W\d{2}$/.test(value)) return;
    const meetingDate = dateFromWeekInput(value);
    if (weekInputValue(meetingDate) !== value) return;
    const year = isoWeekYear(meetingDate); const week = isoWeek(meetingDate);
    if (year === currentWeekYear && week === currentWeek) { setCalendarMonth(monthStart(meetingDate)); setCalendarExpanded(false); return; }
    if (session.user) writeLocalDraft({ scope: "market", ownerId: marketId, data });
    if (isDirty && !saving && !autoSaveError) void savePoint(true);
    setCalendarMonth(monthStart(meetingDate));
    const latest = archive.find((record) => record.year === year && record.week === week);
    const draftRequest = ++archiveRequest.current;
    setArchiveLoading(true);
    let draft;
    try { draft = await loadPointDraft("market", marketId, meetingDate); }
    catch (error) { if (draftRequest === archiveRequest.current) { setArchiveLoading(false); setToast(error instanceof Error ? error.message : "Brouillon indisponible."); } return; }
    if (draftRequest !== archiveRequest.current) return;
    setArchiveLoading(false);
    if (draft) {
      ++archiveRequest.current;
      const nextData = normalizePointData(draft.data, marketId, market);
      resumedDrafts.current.add(`${marketId}:${year}:${week}`);
      setData(nextData); setCalendarMonth(monthStart(nextData.meetingDate)); setCalendarExpanded(false);
      setActiveRecordId(latest?.id ?? null); setSavedAt(latest ? new Date(latest.createdAt) : null);
      setLastSavedSignature(latest ? pointSignature(marketId, latest.data) : "");
      setToast(`${year} · S${String(week).padStart(2, "0")} · brouillon repris.`);
      return;
    }
    if (latest) { await loadRecord(latest, view, true); setCalendarExpanded(false); return; }
    const fresh = initialData(marketId, market);
    fresh.dossiers = []; fresh.operations = []; fresh.promotions = []; fresh.tariffs = []; fresh.jira = []; fresh.mail = data.mail;
    fresh.themeColor = data.themeColor; fresh.customColor = data.customColor; fresh.preferences = copyPreferences(data.preferences); fresh.meetingDate = meetingDate;
    const selection = ++archiveRequest.current;
    setArchiveLoading(true);
    const nextData = await applyJiraWeek(fresh, marketId);
    if (selection !== archiveRequest.current) return;
    setArchiveLoading(false);
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
  const failedAutoSave = useRef("");
  const [autoSaveError, setAutoSaveError] = useState("");
  const savePoint = async (automatic = false) => {
    if (saving || !ready || archiveLoading) return;
    if (!session.user) { setToast("L’espace partagé est en cours de chargement. Réessaie dans un instant."); return; }
    if (data.customColor && !validHex(data.customColor)) { setToast("La couleur personnalisée doit suivre le format #RRGGBB."); return; }
    setSaving(true); setAutoSaveError("");
    const selection = archiveRequest.current, context = comparisonContext.current;
    writeLocalDraft({ scope: "market", ownerId: marketId, data });
    const submittedDraft = { scope: "market" as const, ownerId: marketId, data: preparedData };
    try {
      const concurrency = await preparePointSave(submittedDraft);
      const response = await fetch("/api/points", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ marketId, marketName: market.name, data: preparedData, ...concurrency }) });
      const payload = await response.json() as { point?: PointRecord; draft?: StoredPointDraft; error?: string };
      if (!response.ok || !payload.point) { finishPointSave(submittedDraft, undefined, response.status === 409); throw new Error(payload.error || "Échec de la sauvegarde."); }
      const latestDraft = readLocalDraft("market", marketId, data.meetingDate);
      const newerEdits = latestDraft && pointSignature(marketId, latestDraft.data as PointData) !== pointSignature(marketId, preparedData);
      finishPointSave(submittedDraft, { point: payload.point, draft: payload.draft });
      const savedData = normalizePointData(payload.point.data, marketId, market); const saved = { ...payload.point, data: savedData };
      markPointSaved({ scope: "market", ownerId: marketId, data: savedData }, saved);
      if ((selection !== archiveRequest.current || context !== comparisonContext.current)) return;
      setData((current) => current === data ? savedData : current);
      if (!newerEdits) writeLocalDraft({ scope: "market", ownerId: marketId, data: savedData });
      setArchive((current) => [saved, ...current.filter((item) => !(item.year === saved.year && item.week === saved.week))].sort((a, b) => b.year - a.year || b.week - a.week)); setActiveRecordId(saved.id); setSavedAt(new Date()); setLastSavedSignature(pointSignature(marketId, savedData)); setArchiveError("");
      if (automatic) return;
      if (isLocalWorkspace()) {
        const onDisk = await saveLocalFile();
        setToast(`${saved.year} · S${String(saved.week).padStart(2, "0")} ${onDisk ? "enregistrée dans le fichier." : "conservée dans la session. Le fichier reste à enregistrer."}`);
      } else setToast(`${saved.year} · S${String(saved.week).padStart(2, "0")} enregistrée en ligne.${newerEdits ? " Les nouvelles modifications restent à enregistrer." : ""}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Échec de la sauvegarde.";
      failedAutoSave.current = pointSignature(marketId, data);
      if (selection === archiveRequest.current && context === comparisonContext.current) {
        setAutoSaveError(message);
        if (!automatic) setToast(message);
      }
    }
    finally { finishPointSave(submittedDraft); setSaving(false); }

  };
  useEffect(() => {
    if (!ready || archiveLoading || saving || !session.user || !isDirty) return;
    if (failedAutoSave.current === pointSignature(marketId, data)) return;
    if (hostedPointDrafts.state("market", marketId, data.meetingDate).status === "conflict") return;
    const timer = window.setTimeout(() => { void savePoint(true); }, 1200);
    return () => window.clearTimeout(timer);
  }, [data, marketId, preparedData, ready, archiveLoading, saving, session.user, isDirty]);
  useEffect(() => {
    const retryWhenOnline = () => {
      failedAutoSave.current = "";
      if (isDirty && !saving && !archiveLoading && ready) void savePoint(true);
    };
    window.addEventListener("online", retryWhenOnline);
    return () => window.removeEventListener("online", retryWhenOnline);
  }, [isDirty, saving, archiveLoading, ready, data, marketId]);
  useEffect(() => { failedAutoSave.current = ""; setAutoSaveError(""); }, [comparisonContextValue]);
  useEffect(() => {
    const handleSaveShortcut = (event: KeyboardEvent) => {
      const command = event.ctrlKey || event.metaKey;
      const key = event.key.toLocaleLowerCase("fr-FR");
      if (command && event.shiftKey && key === "e" && session.user && (view === "read" || view === "edit")) {
        event.preventDefault(); setView("read"); setMeetingEditing(true); return;
      }
      if (command && session.user && view === "read" && (key === "z" || key === "y") && !(event.target instanceof HTMLElement && event.target.closest("input, textarea, [contenteditable=true]"))) {
        event.preventDefault();
        if (key === "y" || (key === "z" && event.shiftKey)) redoPoint(); else undoPoint();
        return;
      }
      if (command && key === "s" && (view === "read" || view === "edit" || view === "settings") && session.user) {
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
    const operationSources = new Set(data.operations.map(operationIdentity));
    const promotionSources = new Set(data.promotions.map((item) => item.sourceId ?? item.id));
    const selection: Record<string, boolean> = {};
    previousPoint.data.dossiers.forEach((item) => {
      const available = !dossierSources.has(item.sourceId ?? item.id);
      selection[`dossier:${item.id}`] = available && preset !== "none" && (preset === "all" || !isClosed(item.status));
    });
    previousPoint.data.operations.forEach((item) => {
      const available = !operationSources.has(operationIdentity(item));
      selection[`operation:${item.id}`] = available && preset !== "none" && (preset === "all" || !isOperationClosed(item));
    });
    previousPoint.data.promotions.forEach((item) => {
      const available = !promotionSources.has(item.sourceId ?? item.id);
      selection[`promotion:${item.id}`] = available && preset !== "none" && (preset === "all" || !isPromotionClosed(item));
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
    const operationSources = new Set(data.operations.map(operationIdentity));
    const promotionSources = new Set(data.promotions.map((item) => item.sourceId ?? item.id));
    const dossiers = previousPoint.data.dossiers.filter((item) => carryoverSelection[`dossier:${item.id}`] && !dossierSources.has(item.sourceId ?? item.id)).map((item) => ({ ...item, id: uid(), sourceId: item.sourceId ?? item.id, carriedFromYear: previousPoint.year, carriedFromWeek: previousPoint.week }));
    const operations = previousPoint.data.operations.filter((item) => carryoverSelection[`operation:${item.id}`] && !operationSources.has(operationIdentity(item))).map((item) => ({ ...item, id: uid(), sourceId: item.sourceId ?? item.id, carriedFromYear: previousPoint.year, carriedFromWeek: previousPoint.week, steps: item.steps.map(([label, state]) => [label, state] as [string, string]) }));
    const promotions = previousPoint.data.promotions.filter((item) => carryoverSelection[`promotion:${item.id}`] && !promotionSources.has(item.sourceId ?? item.id)).map((item) => ({ ...item, id: uid(), sourceId: item.sourceId ?? item.id, carriedFromYear: previousPoint.year, carriedFromWeek: previousPoint.week }));
    setData((current) => ({ ...current, dossiers: [...current.dossiers, ...dossiers], operations: [...current.operations, ...operations], promotions: [...current.promotions, ...promotions] }));
    setCarryoverOpen(false);
    const count = dossiers.length + operations.length + promotions.length;
    setToast(count ? `${count} élément${count > 1 ? "s" : ""} repris du point ${previousPoint.year} · S${String(previousPoint.week).padStart(2, "0")}.` : "Aucun nouvel élément à reprendre.");
  };
  const copyMail = async () => {
    try {
      if (navigator.clipboard && typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([mailHtml], { type: "text/html" }), "text/plain": new Blob([mailPlainText(mailHtml)], { type: "text/plain" }) })]);
      } else {
        const holder = document.createElement("div"); holder.innerHTML = mailHtml; holder.contentEditable = "true"; holder.style.position = "fixed"; holder.style.left = "-9999px"; document.body.appendChild(holder);
        const selection = window.getSelection(); const range = document.createRange(); range.selectNodeContents(holder); selection?.removeAllRanges(); selection?.addRange(range);
        if (!document.execCommand("copy")) throw new Error("copy"); holder.remove(); selection?.removeAllRanges();
      }
      setToast("Corps du mail copié.");
    } catch { setToast("Copie bloquée : utilise l’aperçu ou le téléchargement HTML."); }
  };
  const downloadMailDraft = () => {
    download(htmlAttachmentName.replace(/\.html$/, ".eml"), buildMailDraft({ ...data.mail, html: mailHtml, attachment: { name: htmlAttachmentName, html: interactiveHtml } }), "message/rfc822");
    setToast("Mail préparé avec sa page jointe. Ouvre le fichier .eml dans Outlook pour vérifier et envoyer.");
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
    { label: "Diffusion", items: [{ id: "mail", label: "Paramètres du mail", icon: "mail" }, { id: "saved", label: "Historique des points", icon: "download" }] },
  ] : [
    { label: "Contenu du point", items: [{ id: "general", label: "Cadre du point", icon: "spark" }, { id: "dossiers", label: "Dossiers en cours", icon: "folder" }, { id: "operations", label: "Simulations", icon: "trend" }, { id: "promotions", label: "Promotions", icon: "spark" }, { id: "jira", label: "Tickets Jira", icon: "ticket" }] },
    { label: "Vérifier et diffuser", items: [{ id: "mail", label: "Paramètres du mail", icon: "mail" }, { id: "saved", label: "Historique des points", icon: "download" }] },
  ];

  const periodNavigator = <section className="period-navigator read-period" aria-label="Marché et période du point">
    <div className="period-head">
      <div className="period-title"><strong>Marché et semaine</strong></div>
      <div className="direct-week-navigation"><button type="button" aria-label="Semaine précédente" onClick={() => { const date = new Date(`${data.meetingDate}T12:00:00Z`); date.setUTCDate(date.getUTCDate() - 7); void chooseWeek(weekInputValue(date.toISOString().slice(0,10))); }}>‹</button><label><span className="sr-only">Semaine du point</span><input type="week" aria-label="Semaine du point" value={weekInputValue(data.meetingDate)} onChange={(event) => { void chooseWeek(event.target.value); }}/></label><button type="button" aria-label="Semaine suivante" onClick={() => { const date = new Date(`${data.meetingDate}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + 7); void chooseWeek(weekInputValue(date.toISOString().slice(0,10))); }}>›</button></div>
      <label className="period-market"><span>Marché</span><select value={marketId} onChange={(event) => { void chooseMarket(event.target.value); }}>{marketOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <div className="period-state"><span>{currentWeekYear} · S{String(currentWeek).padStart(2, "0")}</span><strong>{autoSaveError ? "Sauvegarde interrompue" : isDirty ? "Synchronisation en cours" : activeRecordId ? "Point enregistré" : "Nouvelle semaine"}</strong><small>{currentWeekPoint ? `Point du ${dateLabel(currentWeekPoint.meetingDate)}` : "Aucun point enregistré"}</small></div>
      <button type="button" className={`period-calendar-toggle ${calendarExpanded ? "is-open" : ""}`} aria-expanded={calendarExpanded} onClick={() => setCalendarExpanded((current) => !current)}><Icon name="calendar" size={16}/><span>{calendarExpanded ? "Masquer le calendrier" : "Choisir une semaine"}</span><Icon name="chevron" size={15}/></button>
    </div>
    {calendarExpanded && <div className="visual-week-picker">
      <div className="week-picker-toolbar">
        <div className="month-navigation"><button type="button" aria-label="Mois précédent" onClick={() => setCalendarMonth((current) => shiftMonth(current, -1))}><Icon name="chevron" size={16}/></button><label className="sr-only" htmlFor="market-calendar-month">Mois du calendrier</label><select id="market-calendar-month" value={calendarMonth.slice(5, 7)} onChange={(event) => setCalendarMonth(`${calendarMonth.slice(0, 4)}-${event.target.value}-01`)}>{Array.from({ length: 12 }, (_, index) => <option key={index} value={String(index + 1).padStart(2, "0")}>{new Intl.DateTimeFormat("fr-FR", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, index, 1)))}</option>)}</select><label className="sr-only" htmlFor="market-calendar-year">Année du calendrier</label><select id="market-calendar-year" value={calendarMonth.slice(0, 4)} onChange={(event) => setCalendarMonth(`${event.target.value}-${calendarMonth.slice(5, 7)}-01`)}>{Array.from({ length: 181 }, (_, index) => <option key={2020 + index} value={2020 + index}>{2020 + index}</option>)}</select><button type="button" aria-label="Mois suivant" onClick={() => setCalendarMonth((current) => shiftMonth(current, 1))}><Icon name="chevron" size={16}/></button></div>
        <div className="week-quick-actions"><button type="button" onClick={() => { void chooseCurrentWeek(); }}><Icon name="calendar" size={14}/> Cette semaine</button><button type="button" disabled={!archive.length} onClick={() => { void chooseLatestPublished(); }}><Icon name="check" size={14}/> Dernière publiée</button>{meetingEditing && <button type="button" disabled={!previousPoint} onClick={openCarryover}><Icon name="copy" size={14}/> Reprendre le précédent</button>}</div>
      </div>
      <div className="week-card-strip">{calendarWeeks.map((weekChoice) => { const savedPoint = archive.find((record) => record.year === weekChoice.year && record.week === weekChoice.week); const selected = weekChoice.year === currentWeekYear && weekChoice.week === currentWeek; const today = weekChoice.value === weekInputValue(isoToday()); return <button type="button" className={`week-choice ${selected ? "selected" : ""} ${savedPoint ? "published" : "empty"} ${selected && isDirty ? "draft" : ""}`} aria-pressed={selected} key={weekChoice.value} onClick={() => { void chooseWeek(weekChoice.value); }}><span><i/>{today ? "Cette semaine" : `${weekChoice.year}`}</span><strong>S{String(weekChoice.week).padStart(2, "0")}</strong><small>{weekChoice.range}</small><b>{savedPoint ? "Point enregistré" : "À renseigner"}</b></button>; })}</div>
    </div>}
  </section>;

  const renderEditor = () => <div className={`editor-layout ${view === "settings" ? "settings-layout" : ""}`}><aside className="editor-nav"><div className="editor-nav-title"><span>{view === "settings" ? "Paramètres" : "Préparation"}</span><small>{view === "settings" ? "Réglages durables et affichage du point" : "Complète puis vérifie ton point"}</small></div>{(meetingEditing ? navGroups.slice(0, 1) : navGroups).map((group) => <div className="editor-nav-group" key={group.label}><span>{group.label}</span>{group.items.map((item) => <button key={item.id} className={section === item.id ? "active" : ""} onClick={() => setSection(item.id)}><Icon name={item.icon}/><span>{item.label}</span>{item.count !== undefined && <b>{item.count}</b>}<Icon name="chevron" size={15}/></button>)}</div>)}<div className={`autosave-card ${isDirty ? "is-dirty" : ""}`}><span><Icon name={isDirty ? "edit" : "check"} size={14}/> {autoSaveError ? "Sauvegarde interrompue" : isDirty ? "Synchronisation en cours" : activeRecordId ? "Point enregistré" : "Brouillon prêt"}</span><small>{archiveLoading ? "Chargement de l’historique…" : activeRecordId ? `Dernière sauvegarde${savedAt ? ` · ${savedAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : ""}` : "Les modifications sont sauvegardées automatiquement"}</small></div></aside><main className="editor-content">
    {section === "general" && <section className="editor-section">
      <SectionTitle eyebrow="Cadre" title="Préparer le point" detail="Le marché et la semaine se choisissent dans le calendrier général ci-dessus."/>
      <div className="surface form-grid general-grid">
        <div className="point-context-summary field-wide"><span><Icon name="calendar" size={16}/> Point sélectionné</span><strong>{market.name}</strong><b>{currentWeekYear} · S{String(currentWeek).padStart(2, "0")} · {dateLabel(data.meetingDate)}</b></div>
        <div className="field field-wide theme-field"><span>Couleur de ce point</span><div className="theme-picker">{themes.map((option) => <button key={option.id} type="button" className={!data.customColor && data.themeColor === option.id ? "active" : ""} style={{ "--swatch": option.accent } as CSSProperties} onClick={() => setData((current) => ({ ...current, themeColor: option.id, customColor: "" }))}><i/><b>{option.label}</b></button>)}</div><div className="hex-color-control"><input type="color" value={accent} aria-label="Sélecteur de couleur personnalisée" onChange={(event) => setData((current) => ({ ...current, customColor: event.target.value.toUpperCase() }))}/><label><span>Hexadécimal personnalisé</span><input value={data.customColor} maxLength={7} placeholder={theme.accent.toUpperCase()} onChange={(event) => setData((current) => ({ ...current, customColor: event.target.value.toUpperCase() }))}/></label><small className={data.customColor && !validHex(data.customColor) ? "invalid" : ""}>{data.customColor && !validHex(data.customColor) ? "Format attendu : #RRGGBB" : `Couleur active : ${accent.toUpperCase()}`}</small></div></div>
        <label className="field field-wide"><span>Priorité de la semaine</span><textarea value={data.priority} onChange={(event) => setData((current) => ({ ...current, priority: event.target.value }))} placeholder="L’action principale ou le message clé à retenir…"/></label>
      </div>
      <div className="comparison-settings-shortcut"><button type="button" className="secondary-button" onClick={() => setComparisonOpen(true)}><Icon name="trend"/> Comparer les marchés</button><label><input type="checkbox" checked={data.preferences.readModules.comparison} onChange={(event) => setComparisonVisible(event.target.checked)}/> Afficher le camembert dans le point et ses exports</label></div>
      <div className="guidance-grid"><article><span>01</span><strong>Choisis le bon marché</strong><p>Les noms et codes sont administrables dans « Gérer les marchés ».</p></article><article><span>02</span><strong>Reprends les suivis utiles</strong><p>Les dossiers et opérations non terminés du dernier point peuvent être reconduits sans doublon.</p></article><article><span>03</span><strong>Complète et diffuse</strong><p>Les destinataires et tickets Jira sont préparés depuis l’annuaire GLOBAL.</p></article></div>
    </section>}

    {section === "personalization" && <section className="editor-section">
      <AppearanceSettings/>
      <SectionTitle eyebrow="Paramètres du point actif" title="Personnaliser l’affichage" detail="Ici, règle le confort de lecture et les contenus diffusés. L’ordre et la largeur des blocs se modifient directement dans le point."/>
      <div className="surface personalization-card">
        <div className="personalization-choice"><div><strong>Taille du texte</strong><span>Réglage libre de 85 à 130 %, enregistré avec le point.</span></div><div className="font-scale-control"><button type="button" onClick={() => updateFontScalePercent(data.preferences.fontScalePercent - 5)} aria-label="Réduire le texte">A−</button><input type="range" min="85" max="130" step="5" value={data.preferences.fontScalePercent} aria-label="Taille du texte" onChange={(event) => updateFontScalePercent(Number(event.target.value))}/><output>{data.preferences.fontScalePercent}%</output><button type="button" onClick={() => updateFontScalePercent(data.preferences.fontScalePercent + 5)} aria-label="Agrandir le texte">A+</button><button type="button" onClick={() => updateFontScalePercent(100)}>100%</button></div></div>
        <div className="personalization-choice"><div><strong>Densité</strong><span>Ajuste les espaces sans modifier le contenu.</span></div><div className="segmented-control">{(["compact", "comfortable", "airy"] as Density[]).map((value) => <button type="button" key={value} className={data.preferences.density === value ? "active" : ""} onClick={() => setData((current) => ({ ...current, preferences: { ...current.preferences, density: value } }))}>{value === "compact" ? "Compacte" : value === "airy" ? "Aérée" : "Normale"}</button>)}</div></div>
      </div>
      <div className="module-settings-grid">
        {(["readModules"] as const).map((destination) => <article className="surface module-settings-card" key={destination}><header><span>{destination === "readModules" ? "Lecture" : destination === "mailModules" ? "Mail blanc" : "HTML interactif"}</span><strong>Modules visibles</strong></header><div>{pointModules.map((module) => <label key={module.id}><input type="checkbox" checked={data.preferences[destination][module.id]} onChange={(event) => updateModuleVisibility(destination, module.id, event.target.checked)}/><span><strong>{module.label}</strong><small>{module.detail}</small></span></label>)}</div></article>)}
      </div>
      <div className="settings-point-note"><Icon name="spark" size={17}/><div><strong>Les informations de la semaine se modifient directement dans le point</strong><span>Clic droit ou menu ••• sur un bloc pour modifier son contenu ou la structure.</span></div><button type="button" className="secondary-button" onClick={() => { setView("read"); setMeetingEditing(true); }}>Ouvrir le point</button></div>
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
      <SectionTitle eyebrow="État métier" title="Simulations" detail={`L’import synchronise les simulations de ${market.name}. Le point n’affiche que l’état final utile à la réunion.`} action={<div className="title-actions"><PlannerImportDialog markets={marketOptions} onImport={importPlannerData}/><button className="secondary-button" type="button" disabled={!plannerReady || data.plannerMode === "manual"} onClick={() => synchronizePlannerPoint()}><Icon name="spark"/> {plannerReady ? "Synchroniser le point" : "Chargement…"}</button>{previousPoint && <button className="secondary-button" onClick={openCarryover}><Icon name="copy"/> Reprendre le précédent</button>}<button className="primary-button" onClick={() => addOperation()}><Icon name="plus"/> Ajouter une simulation</button></div>}/>
      <SourceModeControl label="Simulations Planner" mode={data.plannerMode} onChange={(mode) => { void setSourceMode("planner", mode); }} busy={sourceChanging !== null}/>
      <div className={`planner-market-note ${market.plannerTags.length ? "" : "warning"}`}><Icon name={market.plannerTags.length ? "check" : "alert"}/><div><strong>{market.plannerTags.length ? `Tags reconnus : ${market.plannerTags.join(" · ")}` : "Aucun tag Planner paramétré"}</strong><span>{market.plannerTags.length ? `Période du point : ${calendarMonthLabel(monthStart(data.meetingDate))} et mois suivant.` : "Ajoute les étiquettes de ce marché dans Paramètres → Marchés avant la synchronisation."}</span></div></div>
      {data.operations.length ? <div className="record-stack">{data.operations.map((item) => <article className="surface record-card" key={item.id}><div className="record-header"><div><strong>{item.name || "Nouvelle simulation"}</strong><small>{item.month || "Mois à définir"}{carriedFromLabel(item) ? ` · ${carriedFromLabel(item)}` : ""}</small></div><button className="icon-button danger" aria-label="Retirer du point" onClick={() => setData((current) => ({ ...current, operations: current.operations.filter((row) => row.id !== item.id) }))}><Icon name="trash"/></button></div><div className="form-grid"><TextField label="Nom" value={item.name} onChange={(name) => updateOperation(item.id, { name })}/><TextField label="Mois affiché" value={item.month} onChange={(month) => updateOperation(item.id, { month })} placeholder="Septembre 2026"/><label className="field field-wide"><span>État final dans le point</span><select value={item.state} onChange={(event) => updateOperation(item.id, { state: event.target.value })}>{[...new Set([item.state, ...MARKET_SIMULATION_STATES])].map((state) => <option key={state}>{state}</option>)}</select></label>{hasMarketSimulationOverride(item.plannerOverride) && <div className="point-override-actions field-wide"><span>Valeur corrigée pour ce point</span><button type="button" onClick={() => resetOperationOverride(item.id)}>Reprendre la valeur importée</button></div>}</div></article>)}</div> : <EmptyState label="une simulation" onAdd={addOperation}/>}</section>}

    {section === "promotions" && <section className="editor-section"><SectionTitle eyebrow="Suivi commercial" title="Promotions" detail="Bloc manuel distinct des simulations, reportable d’un point au suivant." action={<div className="title-actions">{previousPoint && <button className="secondary-button" onClick={openCarryover}><Icon name="copy"/> Reprendre le précédent</button>}<button className="primary-button" onClick={addPromotion}><Icon name="plus"/> Ajouter une promotion</button></div>}/>{data.promotions.length ? <div className="record-stack">{data.promotions.map((item) => <article className="surface record-card" key={item.id}><div className="record-header"><div><strong>{item.name || "Nouvelle promotion"}</strong><small>{item.period || "Période à définir"}{carriedFromLabel(item) ? ` · ${carriedFromLabel(item)}` : ""}</small></div><button className="icon-button danger" aria-label="Retirer la promotion" onClick={() => setData((current) => ({ ...current, promotions: current.promotions.filter((row) => row.id !== item.id) }))}><Icon name="trash"/></button></div><div className="form-grid"><TextField label="Nom" value={item.name} onChange={(name) => updatePromotion(item.id, { name })}/><TextField label="Période" value={item.period} onChange={(period) => updatePromotion(item.id, { period })}/><TextField label="État vente" value={item.salesState} onChange={(salesState) => updatePromotion(item.id, { salesState })} wide/><TextField label="Promotion achat" value={item.purchaseNote} onChange={(purchaseNote) => updatePromotion(item.id, { purchaseNote })} wide/><TextField label="Action" value={item.action} onChange={(action) => updatePromotion(item.id, { action })} wide/><TextField label="Commentaire" value={item.comment} onChange={(comment) => updatePromotion(item.id, { comment })} wide/></div></article>)}</div> : <EmptyState label="une promotion" onAdd={addPromotion}/>}</section>}

    {section === "jira" && <section className="editor-section">
      <SectionTitle eyebrow="Activité Jira" title="Tickets ouverts du marché" detail={`Les tickets sont récupérés automatiquement depuis le centre d’import global pour les chefs de produit et chefs de marché de ${market.name}. Seules les personnes ayant des tickets apparaissent.`} action={<button className="primary-button" onClick={addJira}><Icon name="plus"/> Ajouter une synthèse</button>}/>
      <SourceModeControl label="Tickets Jira" mode={data.jiraMode} onChange={(mode) => { void setSourceMode("jira", mode); }} busy={sourceChanging !== null}/>
      <div className="jira-import-note"><Icon name={data.jiraMode === "manual" ? "edit" : "check"}/><div><strong>{data.jiraMode === "manual" ? "Saisie manuelle pour ce point" : "Alimenté par le centre d’import global"}</strong><span>{data.jiraMode === "manual" ? "Modifie les totaux par personne et statut ci-dessous. Ils restent propres à ce point, même après un nouvel import." : "Un seul import Jira met à jour tous les points marché. Le rattachement utilise le USERCODE, le marché et le rôle enregistrés dans l’annuaire."}</span></div></div>
      <JiraVolumePulse data={data} archive={archive} market={market}/>
      <div className="surface jira-alert-settings"><div><span><Icon name="alert" size={16}/> Alertes sur la dernière modification</span><strong>Seuils propres à {market.name}</strong><small>Ces repères signalent une absence d’activité ; ils ne mesurent pas le temps de résolution.</small></div><label><span>À surveiller après</span><div><input type="number" min="1" max="364" value={market.jiraWarningDays} onChange={(event) => { const warning = Math.max(1, Math.min(364, Number(event.target.value) || 1)); updateMarketDraft(marketId, { jiraWarningDays: warning, jiraCriticalDays: Math.max(warning + 1, market.jiraCriticalDays) }); }}/><b>jours</b></div></label><label><span>Critique après</span><div><input type="number" min={market.jiraWarningDays + 1} max="365" value={market.jiraCriticalDays} onChange={(event) => updateMarketDraft(marketId, { jiraCriticalDays: Math.max(market.jiraWarningDays + 1, Math.min(365, Number(event.target.value) || market.jiraWarningDays + 1)) })}/><b>jours</b></div></label><button className="secondary-button" disabled={Boolean(marketSavingId)} onClick={() => saveMarket(marketId)}><Icon name="check" size={15}/> {marketSavingId === marketId ? "Enregistrement…" : "Enregistrer les seuils"}</button></div>
      <div className="surface data-table-wrap jira-summary-wrap"><table className="data-table jira-person-table"><thead><tr><th>Personne</th>{JIRA_SUMMARY_STATUSES.map((status) => <th key={status}>{status}</th>)}<th>Total</th><th/></tr></thead><tbody>{jiraPeople.map((person) => <tr key={person.assignee}><th scope="row"><input disabled={data.jiraMode !== "manual"} value={person.assignee} aria-label={`Personne ${person.assignee}`} onChange={(event) => renameJiraPerson(person.assignee, event.target.value)}/></th>{JIRA_SUMMARY_STATUSES.map((status) => { const statusItems = person.items.filter((item) => item.status === status); const count = statusItems.reduce((sum, item) => sum + jiraItemCount(item), 0); const link = statusItems.find((item) => item.link)?.link; return <td key={status}><div className="jira-count-cell"><input disabled={data.jiraMode !== "manual"} type="number" min="0" value={count} aria-label={`${status} pour ${person.assignee}`} onChange={(event) => setJiraPersonCount(person.assignee, status, Number(event.target.value))}/>{link && <a href={link} target="_blank" rel="noreferrer" title={`Ouvrir le filtre « ${status} »`} aria-label={`Ouvrir le filtre ${status} de ${person.assignee}`}>↗</a>}</div></td>; })}<td className="jira-person-total"><strong>{person.total}</strong><small>{jiraStatusSummary(person.items)}</small></td><td><button disabled={data.jiraMode !== "manual"} className="icon-button subtle" aria-label={`Supprimer ${person.assignee}`} onClick={() => removeJiraPerson(person.assignee)}><Icon name="trash" size={15}/></button></td></tr>)}</tbody></table>{!jiraPeople.length && <div className="table-empty">Aucun ticket Jira dans le registre global pour ce marché. Tu peux ajouter une synthèse manuelle si nécessaire.</div>}</div>
      {jiraActivityRows.length > 0 && <div className="surface data-table-wrap jira-ticket-detail-wrap"><div className="jira-detail-heading"><div><span>Détail des tickets</span><strong>Priorité visuelle par dernière modification</strong></div><small>Création affichée à titre de contexte uniquement.</small></div><table className="data-table jira-ticket-table"><thead><tr><th>Ticket</th><th>État</th><th>Résumé</th><th>Personne</th><th>Création</th><th>Dernière modification</th><th>Signal</th></tr></thead><tbody>{jiraActivityRows.map(({ item, inactivity }) => { const signal = inactivity === null ? "neutral" : inactivity >= market.jiraCriticalDays ? "critical" : inactivity >= market.jiraWarningDays ? "warning" : "fresh"; return <tr id={`jira-${item.id}`} className={`jira-ticket-${signal}`} key={item.id}><td>{item.link ? <a href={item.link} target="_blank" rel="noreferrer">{item.key} ↗</a> : <strong>{item.key}</strong>}{item.internalId && <small>ID {item.internalId}</small>}</td><td><span className={`report-pill tone-${toneForStatus(item.status)}`}>{item.status}</span></td><td><strong>{item.summary || "Sans résumé"}</strong></td><td><strong>{item.assignee || "Non assigné"}</strong>{item.assigneeUserCode && <small>{item.assigneeUserCode}</small>}</td><td>{item.createdAt ? dateLabel(item.createdAt.slice(0, 10)) : "—"}</td><td>{item.lastActivity ? dateLabel(item.lastActivity.slice(0, 10)) : "—"}</td><td><span className={`jira-activity-signal ${signal}`}>{inactivity === null ? "Non daté" : inactivity === 0 ? "Aujourd’hui" : `${inactivity} j sans activité`}</span></td></tr>; })}</tbody></table></div>}
    </section>}

    {section === "saved" && <section className="editor-section"><SectionTitle eyebrow="Historique" title="Points enregistrés" detail="Un seul point est conservé par marché et par semaine. Chaque modification de la semaine active est sauvegardée automatiquement."/><div className="surface version-summary"><div className="version-week"><span>Semaine active</span><strong>{currentWeekYear} · S{String(currentWeek).padStart(2, "0")}</strong><small>{currentWeekPoint ? `Point enregistré le ${new Date(currentWeekPoint.createdAt.replace(" ", "T") + (currentWeekPoint.createdAt.includes("Z") ? "" : "Z")).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}` : "Aucun point enregistré pour cette semaine"}</small></div><div className="version-next"><span>Sauvegarde</span><strong>{currentWeekPoint ? "Mise à jour" : "Création"}</strong><small>{currentWeekPoint ? "La sauvegarde remplace le contenu enregistré pour cette semaine." : "La première sauvegarde créera le point de cette semaine."} · Raccourci Ctrl/Cmd + S.</small></div><div className="version-actions"><button className="secondary-button" onClick={() => fileInput.current?.click()}><Icon name="upload"/> Importer JSON</button><button className="secondary-button" onClick={() => exportJson()}><Icon name="download"/> Exporter le brouillon</button></div></div>{archiveError && <div className="archive-message error"><Icon name="alert"/><span>{archiveError}</span></div>}{archiveLoading ? <div className="archive-message"><span>Chargement des points enregistrés…</span></div> : archive.length ? <div className="archive-list">{archive.map((record) => <article className={`surface archive-row ${activeRecordId === record.id && !isDirty ? "active" : ""}`} key={record.id}><div className="archive-version"><span>{record.year}</span><strong>S{String(record.week).padStart(2, "0")}</strong><small>ISO</small></div><div className="archive-copy"><span>{market.name}</span><strong>{dateLabel(record.meetingDate)}</strong><small>Enregistré le {new Date(record.createdAt.replace(" ", "T") + (record.createdAt.includes("Z") ? "" : "Z")).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</small></div><div className="archive-actions"><button className="secondary-button" onClick={() => exportJson(record)}><Icon name="download"/> JSON</button><button className="primary-button" onClick={() => loadRecord(record)}><Icon name="upload"/> Charger</button></div></article>)}</div> : !archiveError && <div className="surface archive-empty"><Icon name="download" size={28}/><strong>Aucun point enregistré</strong><span>Complète une semaine pour la retrouver ici.</span></div>}</section>}

    {section === "mail" && <section className="editor-section">
      <SectionTitle eyebrow="Diffusion" title="Paramètres du mail" detail="L’annuaire prépare les destinataires ; tu peux conserver des adresses manuelles en complément." action={<button className="secondary-button" onClick={() => setData((current) => applyDirectoryMail(current, marketId, directoryUsers))}><Icon name="user"/> Actualiser depuis l’annuaire</button>}/>
      <div className="mail-automation-grid">
        <article><span><Icon name="mail" size={15}/> Équipe du marché</span><strong>{automaticMarketMailUsers.length ? automaticMarketMailUsers.map((user) => user.name).join(" · ") : "Aucun destinataire configuré"}</strong><small>Chefs et analystes rattachés à {market.name}.</small></article>
        <article><span><Icon name="user" size={15}/> Manager Tarif</span><strong>{automaticTariffManager?.name ?? "Manager Tarif non renseigné"}</strong><small>Ajouté comme destinataire principal pour tous les marchés, et non imposé en copie.</small></article>
      </div>
      <div className="surface form-grid mail-settings"><TextField label="Destinataires" value={data.mail.to} onChange={(to) => setData((current) => ({ ...current, mail: { ...current.mail, to } }))} wide/><TextField label="Copie" value={data.mail.cc} onChange={(cc) => setData((current) => ({ ...current, mail: { ...current.mail, cc } }))} wide/><TextField label="Objet" value={data.mail.subject} onChange={(subject) => setData((current) => ({ ...current, mail: { ...current.mail, subject } }))} wide/><label className="field field-wide"><span>Introduction</span><textarea value={data.mail.intro} onChange={(event) => setData((current) => ({ ...current, mail: { ...current.mail, intro: event.target.value } }))}/></label></div><button className="primary-button mail-next" onClick={() => setView("mail")}><Icon name="mail"/> Vérifier le mail</button>
    </section>}
  </main></div>;

  const canvasActions: PointCanvasActions = {
    updatePriority: (priority) => setData((current) => ({ ...current, priority })),
    updateDossier,
    moveDossier: (id, before) => setData((current) => { const item = current.dossiers.find((row) => row.id === id); if (!item || id === before) return current; const rows = current.dossiers.filter((row) => row.id !== id); const at = before ? rows.findIndex((row) => row.id === before) : rows.length; rows.splice(at < 0 ? rows.length : at, 0, item); return { ...current, dossiers: rows }; }),
    updatePURCHASES: (configs) => setData(current => ({...current, purchaseDataConfigs: configs})),
    updateComparison: (config, snapshot) => setData((current) => ({ ...current, simulationComparisonConfig: config, simulationComparisonSnapshot: snapshot })),
    updateJiraRules: (rules) => setData((current) => ({ ...current, jiraAlertRules: normalizeJiraRules(rules) })),
    addDossier,
    removeDossier: (id) => setData((current) => ({ ...current, dossiers: current.dossiers.filter((item) => item.id !== id) })),
    updateOperation,
    resetOperation: resetOperationOverride,
    addOperation,
    removeOperation: (id) => setData((current) => ({ ...current, operations: current.operations.filter((item) => item.id !== id) })),
    updatePromotion,
    addPromotion,
    removePromotion: (id) => setData((current) => ({ ...current, promotions: current.promotions.filter((item) => item.id !== id) })),
    updateJira,
    resetJira: resetJiraOverride,
    addJira,
    setSourceMode: (source, mode) => { void setSourceMode(source, mode); },
    insertModule: insertCanvasModule,
    hideModule: hideCanvasModule,
    moveModule: moveCanvasModule,
    updateModuleWidth,
    updateFreeLayout: (freeLayout) => setData((current) => ({ ...current, preferences: { ...current.preferences, freeLayout } })),
    resetLayout: resetCanvasLayout,
  };

  const restoreConflict = (draft: PointDraft, snapshot: DraftSnapshot) => {
    failedAutoSave.current = ""; setAutoSaveError("");
    ++archiveRequest.current;
    const next = normalizePointData(draft.data, marketId, market);
    setData(next); setCalendarMonth(monthStart(next.meetingDate));
    const shared = snapshot.point;
    setActiveRecordId(shared?.id ?? null);
    setLastSavedSignature(shared ? pointSignature(marketId, normalizePointData(shared.data, marketId, market)) : "");
    if (shared) setArchive((current) => [{ ...shared, marketId, year: isoWeekYear(next.meetingDate), week: isoWeek(next.meetingDate), meetingDate: String(shared.data.meetingDate), pointName: "Point marché", themeColor: next.themeColor, data: normalizePointData(shared.data, marketId, market) }, ...current.filter((row) => row.year !== isoWeekYear(next.meetingDate) || row.week !== isoWeek(next.meetingDate))].sort((a, b) => b.year - a.year || b.week - a.week));
    setToast("Brouillon sauvegardé. Tu peux poursuivre le point.");
  };

  return <div className={`app-shell font-${data.preferences.fontScale} density-${data.preferences.density}`} style={themeStyle}>
    <a className="skip-link" href="#workspace-content">Aller au contenu</a>
    <WorkspaceNavigation view={view} userName={session.user?.displayName ?? null} onSelect={chooseView}/>
    <header className="app-header">
      <WorkspaceHelp/><div className="workspace-location"><span>Espace de travail</span><strong>{workspaceTitles[view]} <small className="app-version">{APP_VERSION}</small></strong></div>
      <div className="header-actions">
        {session.user && <DraftQueueStatus/>}
        <AppearanceControl/>
        <input ref={fileInput} className="sr-only" type="file" accept="application/json" onChange={importJson}/>
        {session.user && (view === "read" || view === "edit" || view === "settings") && <>
          <div className="point-history-controls"><button type="button" disabled={!historyAvailability.undo} onClick={undoPoint} title="Annuler (Ctrl+Z)">↶</button><button type="button" disabled={!historyAvailability.redo} onClick={redoPoint} title="Rétablir (Ctrl+Y)">↷</button></div><ActionMenu><button type="button" onClick={() => fileInput.current?.click()}><Icon name="upload"/> Importer un JSON</button><button type="button" onClick={() => exportJson()}><Icon name="download"/> Exporter le brouillon</button><button type="button" className="danger" onClick={() => { void resetPoint(); }}><Icon name="plus"/> Réinitialiser la semaine</button></ActionMenu>
          <span className="point-autosave-indicator" role="status">{saving ? "Sauvegarde…" : autoSaveError ? "Sauvegarde interrompue" : isDirty ? "Synchronisation…" : "À jour"}</span>
          {autoSaveError && <button type="button" className="secondary-button" onClick={() => { failedAutoSave.current = ""; void savePoint(); }}>Réessayer</button>}
        </>}
      </div>
    </header>
    {sessionReady && !session.user && <div className="archive-message error" role="alert"><span>L’espace partagé est indisponible. Les données affichées sont conservées.</span><button type="button" className="secondary-button" onClick={retryWorkspace}>Réessayer</button></div>}
    {archiveLoading && <div className="point-loading-status" role="status">Chargement du point…</div>}
    <div id="workspace-content" className="workspace-content" tabIndex={-1} inert={archiveLoading} aria-busy={archiveLoading}>
    <div id="top" className="workspace-context">
      <span>{view === "read" || view === "edit" || view === "mail" ? market.name : view === "analyst" ? "Jira · Simulations · Dossiers" : view === "stats" ? "Activité analystes et variations fournisseurs" : view === "imports" ? "Registres Jira et Planner" : "Application et points"}</span>
      {(view === "read" || view === "edit" || view === "mail") && <span className="workspace-week">S{String(currentWeek).padStart(2, "0")} · {currentWeekYear}</span>}
      {session.user && (view === "read" || view === "edit" || view === "mail") && <span className={`workspace-draft ${isDirty ? "is-dirty" : ""}`}>{autoSaveError ? "Sauvegarde interrompue" : isDirty ? "Synchronisation en cours" : activeRecordId ? "Point enregistré" : "Nouveau point"}</span>}
    </div>
    {session.user && (view === "read" || view === "edit" || view === "mail") && <PointSyncStatus key={comparisonContextValue} scope="market" ownerId={marketId} date={data.meetingDate} onRestore={restoreConflict} onReconnect={retryWorkspace}/>}
    {(view === "read" || view === "edit" || view === "mail") && (activeRecordId || session.user) && <PointSourceStatus sources={data.sourceFreshness} jiraMode={data.jiraMode} plannerMode={data.plannerMode} corrections={data.jira.filter((item) => hasJiraOverride(item.pointOverride)).length + data.operations.filter((item) => hasMarketSimulationOverride(item.plannerOverride)).length} additions={data.jira.filter((item) => !item.importedBase).length + data.operations.filter((item) => !item.plannerSource).length}/>}
    {archiveError && <div className="archive-message error" role="alert"><span>{archiveError}</span><button type="button" className="secondary-button" onClick={() => { void loadMarket(marketId, true, market); }}>Réessayer</button></div>}
    {view === "read" && periodNavigator}
    {view === "settings" && session.user && renderEditor()}
    {view === "read" && <main className="preview-page"><div className={`preview-toolbar ${meetingEditing ? "editing" : ""}`}><div><span>{"Point marché"}</span><strong>{session.user ? "Clic droit ou ••• pour modifier les blocs. Les changements sont sauvegardés automatiquement." : "Choisis le marché et la semaine dans le calendrier ci-dessus."}</strong></div><div className="meeting-toolbar-actions">{session.user && <><button type="button" className="secondary-button" disabled={!previousPoint} onClick={openCarryover}><Icon name="copy"/> Reprendre le point précédent</button><button type="button" className="secondary-button" disabled={refreshingImports} onClick={() => { void refreshImports(); }}><Icon name="spark"/> {refreshingImports ? "Actualisation…" : "Actualiser les imports"}</button><button type="button" className="secondary-button" onClick={() => setComparisonOpen(true)}><Icon name="trend"/> Comparer les marchés</button></>}</div></div>{session.user && <details className="point-display-settings"><summary>Réglages d’affichage</summary><div className="point-layout-toolbar" role="toolbar" aria-label="Affichage du point"><button type="button" onClick={() => updateFontScalePercent(data.preferences.fontScalePercent - 5)}>A−</button><output>{data.preferences.fontScalePercent}%</output><button type="button" onClick={() => updateFontScalePercent(data.preferences.fontScalePercent + 5)}>A+</button>{(["compact", "comfortable", "airy"] as Density[]).map((density) => <button type="button" key={density} onClick={() => setData((current) => ({ ...current, preferences: { ...current.preferences, density } }))}>{density === "compact" ? "Compacte" : density === "airy" ? "Aérée" : "Normale"}</button>)}<label>Couleur<input type="color" value={accent} onChange={(event) => setData((current) => ({ ...current, customColor: event.target.value.toUpperCase() }))}/></label><button type="button" onClick={resetCanvasLayout}>Structure initiale</button></div></details>}{!activeRecordId && <div className="reader-empty-banner"><Icon name="calendar"/><div><strong>Aucun point enregistré pour cette sélection</strong><span>{session.user ? "Complète ce point : les modifications sont sauvegardées automatiquement." : "Aucun brouillon n’est affiché publiquement. L’espace partagé est en cours de chargement."}</span></div></div>}{(activeRecordId || session.user) ? <PreviewDashboard tasks={plannerTasks} markets={marketOptions} plannerUpdatedAt={plannerUpdatedAt} data={preparedData} market={market} archive={archive} editing={false} actions={session.user ? canvasActions : undefined}/> : <div className="surface reader-empty-state"><span className="login-emblem"><Icon name="calendar" size={24}/></span><strong>Cette semaine n’a pas encore de point publié</strong><p>Sélectionne une autre semaine enregistrée ou complète ce point dans l’espace partagé.</p></div>}</main>}
    {view === "stats" && session.user && (plannerReady && directoryReady ? <AnalystStatsDashboard tasks={plannerTasks} users={directoryUsers} markets={marketOptions.map((item) => ({ id: item.id, name: item.name, plannerTags: item.plannerTags }))} registry={plannerRegistry} updatedAt={plannerUpdatedAt} onImport={importPlannerData}/> : <main className="analyst-stats-page"><div className="surface stats-loading"><span>Chargement de la source Planner et de l’annuaire GLOBAL…</span></div></main>)}
    {view === "analyst" && session.user && (plannerReady && directoryReady ? <AnalystPointDashboard onReconnect={retryWorkspace} tasks={plannerTasks} users={directoryUsers} markets={marketOptions.map((item) => ({ id: item.id, name: item.name, plannerTags: item.plannerTags }))} plannerUpdatedAt={plannerUpdatedAt} onPlannerImport={importPlannerData}/> : <main className="analyst-point-page"><div className="surface stats-loading"><span>Chargement du point analyste, de Planner et de l’annuaire GLOBAL…</span></div></main>)}
    {view === "imports" && session.user && (plannerReady && directoryReady ? <ImportCenter users={directoryUsers} markets={marketOptions.map((item) => ({ id: item.id, name: item.name, plannerTags: item.plannerTags }))} plannerTasks={plannerTasks} plannerRegistry={plannerRegistry} plannerUpdatedAt={plannerUpdatedAt} onPlannerImport={importPlannerData} onJiraImported={refreshJiraFromRegistry} onManual={useManualImport}/> : <main className="import-center-page"><div className="surface stats-loading"><span>Chargement des registres et de l’annuaire GLOBAL…</span></div></main>)}
    {view === "mail" && <main className="mail-page">
      <div className="mail-toolbar"><div><span>Kit Outlook</span><strong>Le mail reste lisible seul, la pièce jointe conserve les interactions.</strong><small>{data.mail.to ? `À : ${data.mail.to}` : "Destinataires à compléter dans Paramètres du mail"}</small></div><div><button className="secondary-button" onClick={() => { setSection("mail"); setView("settings"); }}><Icon name={session.user ? "edit" : "lock"}/> Paramètres</button><button className="secondary-button" onClick={copyMail}><Icon name="copy"/> Copier le corps du mail</button><button className="primary-button" onClick={downloadMailDraft}><Icon name="mail"/> Préparer le mail + la page</button></div></div>
      <section className="mail-kit-panel" aria-label="Préparation de l’envoi Outlook"><div className="mail-kit-intro"><span>Mail prêt à ouvrir</span><strong>Le point mis en forme et la page HTML jointe</strong><p>« Préparer le mail + la page » télécharge un fichier .eml avec les destinataires, l’objet, le corps mis en forme et la page jointe. Ouvre-le dans Outlook pour vérifier et envoyer. Les deux éléments restent disponibles séparément ci-dessous.</p></div><div className="mail-kit-steps"><article><span>1</span><div><strong>Version mail</strong><small>Synthèse compatible Outlook, sans script.</small></div><div className="attachment-actions"><button type="button" className="secondary-button" onClick={copyMail}><Icon name="copy" size={15}/> Copier</button><button type="button" className="secondary-button" onClick={() => download(htmlAttachmentName.replace(/\.html$/, "-mail.html"), mailHtml, "text/html;charset=utf-8")}><Icon name="download" size={15}/> Version mail</button></div></article><article className="html-attachment-card" draggable onDragStart={dragInteractiveHtml} title="Faire glisser cette pièce jointe vers Outlook"><span>2</span><div className="html-file-icon">HTML</div><div><strong>{htmlAttachmentName}</strong><small>Graphiques, filtres Jira et personnes dépliables · aucune modification possible</small></div><div className="attachment-actions"><span><Icon name="upload" size={14}/> Glisser dans Outlook</span><button type="button" className="secondary-button" onClick={downloadInteractiveHtml}><Icon name="download" size={15}/> Télécharger</button></div></article></div><div className="mail-security-note"><Icon name="alert" size={15}/><span>La version statique reste complète si la sécurité de l’entreprise bloque l’ouverture d’une pièce jointe HTML.</span></div></section>
      <div className="mail-frame-label"><span>Aperçu de la version intégrée au mail</span><strong>La pièce jointe interactive reprend le même point avec les filtres Jira.</strong></div><div className="mail-frame-wrap"><iframe title="Aperçu du mail Outlook" srcDoc={mailHtml}/></div>
    </main>}
    <AppDialog open={comparisonOpen && Boolean(session.user)} onClose={() => setComparisonOpen(false)} labelledBy="comparison-title" className="market-comparison-dialog">
      <div className="dialog-heading"><div><span>Vue transversale</span><h2 id="comparison-title">Comparer les marchés</h2><p>Consulte le graphique ici ou ajoute-le au point.</p></div></div>
      <MarketComparisonChart snapshot={preparedData.marketComparison} loading={comparisonLoading}/>
      <div className="comparison-dialog-actions"><label><input type="checkbox" checked={data.preferences.readModules.comparison} onChange={(event) => setComparisonVisible(event.target.checked)}/> Afficher dans le point et ses exports</label><button type="button" className="secondary-button" disabled={comparisonLoading} onClick={() => { void loadMarketComparison(); }}>{comparisonLoading ? "Actualisation…" : "Actualiser les marchés"}</button><button type="button" className="primary-button" onClick={() => setComparisonOpen(false)}>Terminer</button></div>
    </AppDialog>
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
        <div className="carryover-group"><div className="carryover-group-title"><span>Simulations</span><b>{previousPoint.data.operations.length}</b></div>{previousPoint.data.operations.length ? previousPoint.data.operations.map((item) => { const alreadyCarried = data.operations.some((current) => operationIdentity(current) === operationIdentity(item)); return <label className={`carryover-row ${alreadyCarried ? "is-disabled" : ""}`} key={`operation:${item.id}`}><input type="checkbox" disabled={alreadyCarried} checked={!alreadyCarried && Boolean(carryoverSelection[`operation:${item.id}`])} onChange={(event) => setCarryoverSelection((current) => ({ ...current, [`operation:${item.id}`]: event.target.checked }))}/><span><strong>{item.name || "Simulation sans titre"}</strong><small>{item.month || "Mois à définir"}</small></span><b className={`tone-text-${toneForStatus(item.state)}`}>{alreadyCarried ? "Déjà reportée" : item.state}</b></label>; }) : <div className="carryover-empty">Aucune simulation dans ce point.</div>}</div>
        <div className="carryover-group"><div className="carryover-group-title"><span>Promotions</span><b>{previousPoint.data.promotions.length}</b></div>{previousPoint.data.promotions.length ? previousPoint.data.promotions.map((item) => { const alreadyCarried = data.promotions.some((current) => (current.sourceId ?? current.id) === (item.sourceId ?? item.id)); return <label className={`carryover-row ${alreadyCarried ? "is-disabled" : ""}`} key={`promotion:${item.id}`}><input type="checkbox" disabled={alreadyCarried} checked={!alreadyCarried && Boolean(carryoverSelection[`promotion:${item.id}`])} onChange={(event) => setCarryoverSelection((current) => ({ ...current, [`promotion:${item.id}`]: event.target.checked }))}/><span><strong>{item.name || "Promotion sans titre"}</strong><small>{item.period || "Période à définir"}</small></span><b className={`tone-text-${toneForStatus(item.salesState)}`}>{alreadyCarried ? "Déjà reportée" : item.salesState}</b></label>; }) : <div className="carryover-empty">Aucune promotion dans ce point.</div>}</div>
      </div>
      <div className="carryover-footer"><span>Le point précédent reste intact. Chaque élément repris garde son origine.</span><button className="primary-button" type="button" disabled={!carryoverSelectedCount} onClick={applyCarryover}><Icon name="copy"/> Reporter {carryoverSelectedCount || ""} élément{carryoverSelectedCount > 1 ? "s" : ""}</button></div>
    </AppDialog>}

    {confirmRequest && <AppDialog open onClose={() => settleConfirmation(false)} labelledBy="confirm-dialog-title" className="confirm-dialog"><span className={`confirm-emblem ${confirmRequest.destructive ? "danger" : ""}`}><Icon name={confirmRequest.destructive ? "alert" : "check"} size={22}/></span><div className="login-heading"><span>Confirmation</span><h2 id="confirm-dialog-title">{confirmRequest.title}</h2><p>{confirmRequest.detail}</p></div><div className="confirm-actions"><button className="secondary-button" type="button" onClick={() => settleConfirmation(false)}>Annuler</button><button className={`primary-button ${confirmRequest.destructive ? "danger-button-solid" : ""}`} type="button" onClick={() => settleConfirmation(true)}>{confirmRequest.confirmLabel}</button></div></AppDialog>}
    {toast && <div className="toast"><Icon name="check"/>{toast}</div>}
  </div></div>;
}
