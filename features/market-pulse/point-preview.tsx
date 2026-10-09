"use client";
import { GRID_WIDTHS, moduleColumns, resizeMovesOtherBlocks } from "@/lib/point-grid";
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode, type PointerEvent as ReactPointerEvent } from "react";
import { DossierBoard } from "./dossier-board";
import { SimulationComparison } from "./simulation-comparison";
import { JiraRulesEditor } from "./jira-rules-editor";
import { jiraRuleFor, type JiraAlertRule } from "@/lib/jira-alert-rules";
import { normalizeComparison, type ComparisonConfig, type ComparisonSnapshot } from "@/lib/simulation-comparison";
import { AppIcon as Icon } from "@/components/app-icon";
import type { ModuleWidth } from "@/components/module-layout-editor";
import { JIRA_SUMMARY_STATUSES } from "@/lib/jira-import";
import { type PlannerTask } from "@/lib/planner-import";
import { MarketComparisonChart } from "./market-comparison";
import { type PointSourceMode } from "@/lib/point-source-mode";
import { MARKET_SIMULATION_STATES, hasMarketSimulationOverride } from "@/lib/market-simulation";
import { PointModule, Dossier, CommercialOperation, Promotion, JiraPointFields, JiraTicket, PointData, Market, PointRecord, JiraPersonGroup, JiraAttentionLevel, JiraDashboardScope, pointModules, isoWeek, isoWeekYear, monthStart, shiftMonth, calendarMonthLabel, dateLabel, jiraItemCount, jiraStatusSummary, groupJiraPeople, jiraAttention, jiraDashboardStats, hasJiraOverride, toneForStatus, buildAlerts } from "./point-model";

export function JiraVolumePulse({ data, archive, market }: { data: PointData; archive: PointRecord[]; market: Market }) {
  const { activeTickets, currentVolume, points, delta, warningCount, criticalCount, statusTotals } = jiraDashboardStats(data, market, archive);
  const maxVolume = Math.max(1, ...points.map((point) => point.value));
  const warningDays = Math.max(1, market.jiraWarningDays || 10);
  const criticalDays = Math.max(warningDays + 1, market.jiraCriticalDays || 20);
  return <section className="jira-volume-pulse">
    <div className="jira-volume-heading"><div><span>Volume de tickets ouverts</span><strong>Évolution sur les quatre derniers points</strong></div><div className={`jira-volume-delta ${delta === null ? "neutral" : delta > 0 ? "up" : delta < 0 ? "down" : "neutral"}`}><small>Écart vs dernier point</small><strong>{delta === null ? "—" : `${delta > 0 ? "+" : ""}${delta}`}</strong></div></div>
    <div className="jira-volume-content"><div className="jira-volume-bars" aria-label="Évolution du volume de tickets Jira">{points.map((point, index) => <div className={`jira-volume-bar ${index === points.length - 1 ? "current" : ""}`} key={`${point.label}-${index}`}><span><i style={{ height: `${(point.value / maxVolume) * 100}%` }}/></span><b>{point.value}</b><small>{point.label}</small></div>)}</div><div className="jira-volume-stats"><article><span>Total actuel</span><strong>{currentVolume}</strong><small>{activeTickets.length} ligne{activeTickets.length > 1 ? "s" : ""} détaillée{activeTickets.length > 1 ? "s" : ""}</small></article><article className="warning"><span>À surveiller</span><strong>{warningCount}</strong><small>{warningDays} à {criticalDays - 1} j sans activité</small></article><article className="critical"><span>Critiques</span><strong>{criticalCount}</strong><small>{criticalDays} j ou plus sans activité</small></article></div></div>
    <div className="jira-status-visual"><div>{statusTotals.length ? statusTotals.map((item, index) => <i key={item.status} title={`${item.status} : ${item.value}`} className={`segment segment-${index % 6}`} style={{ width: `${(item.value / Math.max(1, currentVolume)) * 100}%` }}/>) : <i className="segment empty"/>}</div><p>{statusTotals.length ? statusTotals.map((item) => <span key={item.status}><i className={`segment-${statusTotals.indexOf(item) % 6}`}/>{item.status} <b>{item.value}</b></span>) : <span>Aucun ticket actif</span>}</p></div>
  </section>;
}

function JiraReadTicket({ item, data, market, editing = false, onUpdate, onReset }: { item: JiraTicket; data: PointData; market: Market; editing?: boolean; onUpdate?: (id: string, patch: Partial<JiraPointFields>) => void; onReset?: (id: string) => void }) {
  const signal = jiraAttention(item, data.meetingDate, market, data.jiraAlertRules);
  const content = <><span>{item.key || "Synthèse"}</span><div><strong>{item.summary || "Synthèse de la file Jira"}</strong><small>{[item.category, item.subcategory].filter(Boolean).join(" / ")}{item.category || item.subcategory ? " · " : ""}{jiraRuleFor(item, data.jiraAlertRules ?? [])?.priority === "high" ? "Prioritaire · " : ""}{item.status} · {signal.inactivity === null ? "activité non datée" : signal.inactivity === 0 ? "mise à jour aujourd’hui" : `dernière modification il y a ${signal.inactivity} j`}</small></div><b>{jiraItemCount(item) > 1 ? jiraItemCount(item) : signal.level === "critical" ? `Critique · ${signal.inactivity} j` : signal.level === "warning" ? `À surveiller · ${signal.inactivity} j` : "À jour"}</b></>;
  const className = `jira-read-ticket ${signal.level}`;
  if (editing && onUpdate) return <div className={`${className} canvas-jira-edit`}>
    <span>{item.key || "Synthèse"}</span>
    <div className="canvas-jira-fields">
      <input aria-label={`Résumé ${item.key || item.assignee}`} value={item.summary} placeholder="Résumé" onChange={(event) => onUpdate(item.id, { summary: event.target.value })}/>
      <div><select aria-label={`État ${item.key || item.assignee}`} value={item.status} onChange={(event) => onUpdate(item.id, { status: event.target.value })}>{[...new Set([item.status, ...JIRA_SUMMARY_STATUSES])].map((status) => <option key={status}>{status}</option>)}</select><input aria-label={`Personne ${item.key || item.assignee}`} value={item.assignee} placeholder="Personne" onChange={(event) => onUpdate(item.id, { assignee: event.target.value })}/><input type="date" aria-label={`Dernière modification ${item.key || item.assignee}`} value={item.lastActivity.slice(0, 10)} onChange={(event) => onUpdate(item.id, { lastActivity: event.target.value })}/>{jiraItemCount(item) > 1 && <input className="canvas-jira-count" type="number" min="0" aria-label={`Nombre de tickets ${item.assignee}`} value={jiraItemCount(item)} onChange={(event) => onUpdate(item.id, { count: Math.max(0, Number(event.target.value) || 0) })}/>}</div>
      <input aria-label={`Commentaire ${item.key || item.assignee}`} value={item.comment} placeholder="Commentaire du point" onChange={(event) => onUpdate(item.id, { comment: event.target.value })}/>
    </div>
    <div className="point-override-actions">{hasJiraOverride(item.pointOverride) && <><span>Modifié dans le point</span><button type="button" onClick={() => onReset?.(item.id)}>Valeur importée</button></>}</div>
  </div>;
  return item.link ? <a className={className} href={item.link} target="_blank" rel="noreferrer" title={`Ouvrir ${item.key || "le ticket"} dans Jira`}>{content}</a> : <div className={className}>{content}</div>;
}

function JiraCommandCenter({ data, archive, market, editing = false, onUpdate, onReset, onAdd, onRules }: { data: PointData; archive: PointRecord[]; market: Market; editing?: boolean; onUpdate?: (id: string, patch: Partial<JiraPointFields>) => void; onReset?: (id: string) => void; onAdd?: () => void; onRules?: (rules: JiraAlertRule[]) => void }) {
  const stats = useMemo(() => jiraDashboardStats(data, market, archive), [archive, data, market]);
  const [scope, setScope] = useState<JiraDashboardScope>("all");
  const [status, setStatus] = useState("all");
  const [subcategory, setSubcategory] = useState("all");
  const [expandedPerson, setExpandedPerson] = useState("");
  const attentionRank: Record<JiraAttentionLevel, number> = { critical: 0, warning: 1, undated: 2, fresh: 3 };
  const filteredRows = stats.rows.filter((row) => {
    const scopeMatches = scope === "all" || (scope === "attention" ? row.level === "warning" || row.level === "critical" : row.level === "critical");
    return scopeMatches && (status === "all" || row.item.status === status) && (subcategory === "all" || row.item.subcategory === subcategory);
  }).sort((left, right) => Number(jiraRuleFor(right.item, data.jiraAlertRules ?? [])?.priority === "high") - Number(jiraRuleFor(left.item, data.jiraAlertRules ?? [])?.priority === "high") || attentionRank[left.level] - attentionRank[right.level] || (right.inactivity ?? -1) - (left.inactivity ?? -1) || left.item.key.localeCompare(right.item.key, "fr", { numeric: true }));
  const people = groupJiraPeople(filteredRows.map((row) => row.item)).sort((left, right) => {
    const strongest = (person: JiraPersonGroup) => Math.min(...person.items.map((item) => attentionRank[jiraAttention(item, data.meetingDate, market, data.jiraAlertRules).level]));
    return strongest(left) - strongest(right) || right.total - left.total || left.assignee.localeCompare(right.assignee, "fr");
  });
  const filteredVolume = filteredRows.reduce((sum, row) => sum + jiraItemCount(row.item), 0);
  const maxVolume = Math.max(1, ...stats.points.map((point) => point.value));
  const activeFilter = scope !== "all" || status !== "all" || subcategory !== "all";
  const scopeLabel = scope === "attention" ? "sans activité" : scope === "critical" ? "critiques" : "tous les tickets";
  return <section className="jira-command-center" aria-labelledby="jira-command-title">
    <header className="jira-command-header"><div><span>Radar Jira</span><h2 id="jira-command-title">Tickets ouverts du marché</h2><p>Les tickets qui dépassent un seuil remontent automatiquement en premier. Ouvre une personne puis clique sur un ticket pour accéder à Jira.</p></div><div className="jira-command-delta"><small>Depuis le dernier point</small><strong>{stats.delta === null ? "—" : `${stats.delta > 0 ? "+" : ""}${stats.delta}`}</strong><span>{stats.delta === null ? "Première mesure" : stats.delta === 0 ? "Volume stable" : "Évolution du stock"}</span></div></header>
    {editing && onRules && <JiraRulesEditor rules={data.jiraAlertRules ?? []} tickets={data.jira} onChange={onRules}/>}
    <label className="jira-subcategory-filter">Sous-catégorie<select value={subcategory} onChange={(e) => setSubcategory(e.target.value)}><option value="all">Toutes les sous-catégories</option>{[...new Set(data.jira.map((t) => t.subcategory).filter(Boolean))].map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
    <div className="jira-command-kpis" role="group" aria-label="Filtres d’attention Jira">
      <button type="button" className={scope === "all" ? "active" : ""} aria-pressed={scope === "all"} onClick={() => setScope("all")}><span>Tickets ouverts</span><strong>{stats.currentVolume}</strong><small>Stock actuel du marché</small><i className="tone-aqua"/></button>
      <button type="button" className={scope === "attention" ? "active warning" : "warning"} aria-pressed={scope === "attention"} onClick={() => setScope("attention")}><span>Sans activité</span><strong>{stats.attentionCount}</strong><small>Seuils du marché ou de la catégorie</small><i className="tone-peach"/></button>
      <button type="button" className={scope === "critical" ? "active critical" : "critical"} aria-pressed={scope === "critical"} onClick={() => setScope("critical")}><span>Attention forte</span><strong>{stats.criticalCount}</strong><small>Seuils du marché ou de la catégorie</small><i className="tone-red"/></button>
    </div>
    <div className="jira-command-visuals">
      <article className="jira-trend-panel"><div><span>Évolution du volume</span><strong>Quatre derniers points</strong></div><div className="jira-trend-columns" aria-label="Historique du volume Jira">{stats.points.map((point, index) => <div key={`${point.label}-${index}`} className={index === stats.points.length - 1 ? "current" : ""}><b>{point.value}</b><span><i style={{ height: `${Math.max(7, (point.value / maxVolume) * 100)}%` }}/></span><small>{point.label}</small></div>)}</div></article>
      <article className="jira-status-panel"><div><span>Répartition</span><strong>Filtrer par statut</strong></div><div className="jira-interactive-bar">{stats.statusTotals.length ? stats.statusTotals.map((item, index) => <button key={item.status} type="button" className={`segment-${index % 6} ${status === item.status ? "active" : ""}`} style={{ width: `${(item.value / Math.max(1, stats.currentVolume)) * 100}%` }} aria-label={`${item.status} : ${item.value}`} aria-pressed={status === item.status} onClick={() => setStatus((current) => current === item.status ? "all" : item.status)}/>) : <i/>}</div><div className="jira-status-buttons"><button type="button" className={status === "all" ? "active" : ""} onClick={() => setStatus("all")}>Tous</button>{stats.statusTotals.map((item, index) => <button key={item.status} type="button" className={status === item.status ? "active" : ""} onClick={() => setStatus((current) => current === item.status ? "all" : item.status)}><i className={`segment-${index % 6}`}/>{item.status}<b>{item.value}</b></button>)}</div></article>
    </div>
    <div className="jira-command-filter"><div><Icon name="filter" size={15}/><span><strong>{filteredVolume}</strong> ticket{filteredVolume > 1 ? "s" : ""} · {scopeLabel}{status !== "all" ? ` · ${status}` : ""}</span></div>{activeFilter && <button type="button" onClick={() => { setScope("all"); setStatus("all"); setSubcategory("all"); }}>Réinitialiser</button>}</div>
    {people.length ? <div className="jira-command-people">{people.map((person) => {
      const open = expandedPerson === person.assignee;
      const attention = stats.rows.filter((row) => (row.item.assignee.trim() || "Non assigné") === person.assignee && (row.level === "warning" || row.level === "critical")).reduce((sum, row) => sum + jiraItemCount(row.item), 0);
      return <article key={person.assignee} className={open ? "open" : ""}><button type="button" className="jira-person-toggle" aria-expanded={open} onClick={() => setExpandedPerson((current) => current === person.assignee ? "" : person.assignee)}><span className="jira-person-avatar">{person.assignee.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span><span><strong>{person.assignee}</strong><small>{jiraStatusSummary(person.items)}</small></span>{attention > 0 && <b className="jira-person-alert">{attention} à regarder</b>}<em>{person.total}</em><Icon name="chevron" size={16}/></button>{open && <div className="jira-person-tickets">{person.items.slice().sort((left, right) => attentionRank[jiraAttention(left, data.meetingDate, market, data.jiraAlertRules).level] - attentionRank[jiraAttention(right, data.meetingDate, market, data.jiraAlertRules).level] || (jiraAttention(right, data.meetingDate, market, data.jiraAlertRules).inactivity ?? -1) - (jiraAttention(left, data.meetingDate, market, data.jiraAlertRules).inactivity ?? -1)).map((item) => <JiraReadTicket key={item.id} item={item} data={data} market={market} editing={editing} onUpdate={onUpdate} onReset={onReset}/>)}</div>}</article>;
    })}</div> : <div className="jira-command-empty"><Icon name="ticket" size={24}/><strong>{stats.currentVolume ? "Aucun ticket dans ce filtre" : "Aucun ticket actif"}</strong><span>{stats.currentVolume ? "Réinitialise les filtres pour retrouver l’ensemble du stock." : "Le prochain import Jira alimentera automatiquement ce tableau de bord."}</span></div>}
    {editing && onAdd && <button type="button" className="canvas-inline-add" onClick={onAdd}><Icon name="plus" size={15}/> Ajouter une synthèse Jira</button>}
  </section>;
}

export type PointCanvasActions = {
  updatePriority: (value: string) => void;
  updateDossier: (id: string, patch: Partial<Dossier>) => void;
  addDossier: () => void;
  removeDossier: (id: string) => void;
  moveDossier: (id: string, before: string | null) => void;
  updateComparison: (config: ComparisonConfig, snapshot: ComparisonSnapshot) => void;
  updateJiraRules: (rules: JiraAlertRule[]) => void;
  updateOperation: (id: string, patch: Partial<CommercialOperation>) => void;
  resetOperation: (id: string) => void;
  addOperation: (month: string) => void;
  removeOperation: (id: string) => void;
  updatePromotion: (id: string, patch: Partial<Promotion>) => void;
  addPromotion: () => void;
  removePromotion: (id: string) => void;
  updateJira: (id: string, patch: Partial<JiraPointFields>) => void;
  resetJira: (id: string) => void;
  addJira: () => void;
  setSourceMode: (source: "jira" | "planner", mode: PointSourceMode) => void;
  insertModule: (module: PointModule, before: PointModule | null) => void;
  hideModule: (module: PointModule) => void;
  moveModule: (module: PointModule, amount: number) => void;
  updateModuleWidth: (module: PointModule, width: ModuleWidth) => void;
  resetLayout: () => void;
};

function ModuleInsertion({ hidden, before, onInsert }: { hidden: PointModule[]; before: PointModule | null; onInsert: (module: PointModule, before: PointModule | null) => void }) {
  const [open, setOpen] = useState(false);
  if (!hidden.length) return null;
  return <div className={`canvas-module-insertion ${open ? "is-open" : ""}`}><button type="button" aria-expanded={open} onClick={() => setOpen((current) => !current)}><Icon name="plus" size={15}/><span>Ajouter un bloc ici</span></button>{open && <div>{hidden.map((module) => <button type="button" key={module} onClick={() => { onInsert(module, before); setOpen(false); }}>{pointModules.find((item) => item.id === module)?.label ?? module}</button>)}</div>}</div>;
}

export function PreviewDashboard({ data, market, archive, editing = false, actions, tasks = [], markets = [], plannerUpdatedAt = "" }: { data: PointData; market: Market; archive: PointRecord[]; editing?: boolean; actions?: PointCanvasActions; tasks?: PlannerTask[]; markets?: Market[]; plannerUpdatedAt?: string }) {
  const modules = data.preferences.readModules;
  const canManage = Boolean(actions);
  const [priorityEditing, setPriorityEditing] = useState(false);
  const [dropAfter, setDropAfter] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [blockedResize, setBlockedResize] = useState<{ module: PointModule; width: ModuleWidth } | null>(null);
  const [activeDossier, setActiveDossier] = useState<string | null>(null);
  const [editingModule, setEditingModule] = useState<PointModule | null>(null);
  const alerts = useMemo(() => buildAlerts(data, market), [data, market]);
  const [alertFilter, setAlertFilter] = useState<"all" | "danger">("all");
  const [selectedModule, setSelectedModule] = useState<PointModule | null>(null);
  const [draggedModule, setDraggedModule] = useState<PointModule | null>(null);
  const [dropModule, setDropModule] = useState<PointModule | null>(null);
  const [contextMenu, setContextMenu] = useState<{ module: PointModule; x: number; y: number } | null>(null);
  const visibleAlerts = alerts.filter((item) => alertFilter === "all" || item.severity === "danger");
  const currentMonth = calendarMonthLabel(monthStart(data.meetingDate));
  const followingMonth = calendarMonthLabel(shiftMonth(monthStart(data.meetingDate), 1));
  const operationGroups = [currentMonth, followingMonth].map((month, index) => ({ month, items: data.operations.filter((item) => index === 1 ? item.month === followingMonth : item.month !== followingMonth) }));
  const blockContent = (editing: boolean): Record<PointModule, ReactNode> => ({
    simulationComparison: <SimulationComparison tasks={tasks} markets={markets} config={data.simulationComparisonConfig ?? normalizeComparison(null, market.id)} snapshot={data.simulationComparisonSnapshot} editing={editing} updatedAt={plannerUpdatedAt} onChange={actions?.updateComparison}/>,
    comparison: <MarketComparisonChart snapshot={data.marketComparison}/>,
    jira: <JiraCommandCenter key={`${market.id}-${data.meetingDate}`} data={data} archive={archive} market={market} editing={editing} onUpdate={actions?.updateJira} onReset={actions?.resetJira} onAdd={actions?.addJira} onRules={actions?.updateJiraRules}/>,
    dossiers: <DossierBoard items={data.dossiers} editing={canManage} onUpdate={actions?.updateDossier} onAdd={actions?.addDossier} onRemove={actions?.removeDossier} onMove={actions?.moveDossier} activeId={editingModule === "dossiers" ? activeDossier : null} onActivate={(id) => { setActiveDossier(id); setEditingModule("dossiers"); }} onDeactivate={() => { setActiveDossier(null); setEditingModule(null); }}/>,
    operations: <article className="report-focus report-standalone canvas-simulations"><div className="report-heading"><div><small>État au moment du point</small><h2>Simulations</h2></div></div><div className="simulation-month-grid">{operationGroups.map((group) => <section className="simulation-month" key={group.month}><header><span>{group.month}</span><b>{group.items.length}</b></header><div>{group.items.map((item) => <article className={`simulation-state-card ${item.plannerSource ? "is-imported" : "is-manual"}`} key={item.id}>{editing && actions ? <><input className="canvas-title-input" aria-label="Nom de la simulation" value={item.name} placeholder="Nom de la simulation" onChange={(event) => actions.updateOperation(item.id, { name: event.target.value })}/><select className={`simulation-state-select tone-${toneForStatus(item.state)}`} aria-label={`État ${item.name}`} value={item.state} onChange={(event) => actions.updateOperation(item.id, { state: event.target.value })}>{[...new Set([item.state, ...MARKET_SIMULATION_STATES])].map((state) => <option key={state}>{state}</option>)}</select><select className="simulation-month-select" aria-label={`Mois ${item.name}`} value={item.month === followingMonth ? followingMonth : currentMonth} onChange={(event) => actions.updateOperation(item.id, { month: event.target.value })}><option>{currentMonth}</option><option>{followingMonth}</option></select><div className="point-override-actions">{hasMarketSimulationOverride(item.plannerOverride) && <><span>Modifiée dans le point</span><button type="button" onClick={() => actions.resetOperation(item.id)}>Valeur importée</button></>}{!item.plannerSource && <button type="button" onClick={() => actions.removeOperation(item.id)}>Retirer</button>}</div></> : <><div><span className={`report-pill tone-${toneForStatus(item.state)}`}>{item.state}</span>{hasMarketSimulationOverride(item.plannerOverride) && <span className="point-override-badge">Modifiée dans le point</span>}</div><h3>{item.name || "Simulation sans titre"}</h3></>}</article>)}</div>{editing && actions && <button type="button" className="canvas-inline-add month-add" onClick={() => actions.addOperation(group.month)}><Icon name="plus" size={15}/> Ajouter une simulation</button>}</section>)}</div>{!data.operations.length && !editing && <div className="report-empty">Aucune simulation renseignée</div>}</article>,
    promotions: <article className="report-focus report-standalone canvas-promotions"><div className="report-heading"><div><small>Suivi commercial</small><h2>Promotions</h2></div></div>{data.promotions.length ? <div className="promotion-card-grid">{data.promotions.map((item) => <article className={`promotion-card ${editing ? "is-inline-editing" : ""}`} key={item.id}>{editing && actions ? <><input className="canvas-title-input" aria-label="Nom de la promotion" value={item.name} placeholder="Nom de la promotion" onChange={(event) => actions.updatePromotion(item.id, { name: event.target.value })}/><div className="promotion-edit-grid"><input aria-label={`Période ${item.name}`} value={item.period} placeholder="Période" onChange={(event) => actions.updatePromotion(item.id, { period: event.target.value })}/><input aria-label={`État vente ${item.name}`} value={item.salesState} placeholder="État vente" onChange={(event) => actions.updatePromotion(item.id, { salesState: event.target.value })}/></div><textarea aria-label={`Promotion achat ${item.name}`} value={item.purchaseNote} placeholder="Promotion achat" onChange={(event) => actions.updatePromotion(item.id, { purchaseNote: event.target.value })}/><textarea aria-label={`Action ${item.name}`} value={item.action} placeholder="Action / prochaine étape" onChange={(event) => actions.updatePromotion(item.id, { action: event.target.value })}/><textarea aria-label={`Commentaire ${item.name}`} value={item.comment} placeholder="Commentaire" onChange={(event) => actions.updatePromotion(item.id, { comment: event.target.value })}/><button type="button" className="canvas-remove promotion-remove" aria-label={`Retirer ${item.name}`} onClick={() => actions.removePromotion(item.id)}><Icon name="trash" size={14}/></button></> : <><header><div><strong>{item.name || "Promotion sans titre"}</strong><small>{item.period || "Période à définir"}</small></div><span className={`report-pill tone-${toneForStatus(item.salesState)}`}>{item.salesState || "À préparer"}</span></header>{item.purchaseNote && <p><b>Promotion achat</b>{item.purchaseNote}</p>}{item.action && <p><b>Action</b>{item.action}</p>}{item.comment && <small className="promotion-comment">{item.comment}</small>}</>}</article>)}</div> : !editing && <div className="report-empty">Aucune promotion renseignée</div>}{editing && actions && <button type="button" className="canvas-inline-add" onClick={actions.addPromotion}><Icon name="plus" size={15}/> Ajouter une promotion</button>}</article>,
    alerts: <article className="report-alert-card"><div className="alert-heading"><h2>Vigilances du point</h2></div>{alerts.length > 0 && <div className="alert-filters"><button type="button" className={alertFilter === "all" ? "active" : ""} onClick={() => setAlertFilter("all")}>Toutes</button><button type="button" className={alertFilter === "danger" ? "active" : ""} onClick={() => setAlertFilter("danger")}>Critiques</button></div>}{visibleAlerts.length ? visibleAlerts.map((item, index) => <a className="alert-line alert-line-clean" key={`${item.title}-${index}`} href={item.link || (item.targetId ? `#${item.targetId}` : "#top")}><div><strong>{item.title}</strong><small><b>{item.category}</b> · {item.detail}</small></div><Icon name="chevron" size={14}/></a>) : <div className="report-empty light-empty">{alerts.length ? "Aucune vigilance dans ce filtre" : "Aucune vigilance détectée"}</div>}</article>,
  });
  const content = blockContent(editing);
  if (editingModule && canManage) content[editingModule] = blockContent(true)[editingModule];
  const visibleModules = data.preferences.moduleOrder.filter((module) => modules[module]);
  const hiddenModules = data.preferences.moduleOrder.filter((module) => !modules[module]);
  useEffect(() => {
    if (canManage) return;
    const timer = window.setTimeout(() => { setSelectedModule(null); setContextMenu(null); }, 0);
    return () => window.clearTimeout(timer);
  }, [canManage]);
  useEffect(() => {
    if (!canManage || !actions) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true'], [role='dialog']")) return;
      if (event.key === "Escape") { setSelectedModule(null); setContextMenu(null); return; }
      if (!selectedModule) return;
      if ((event.key === "Delete" || event.key === "Backspace") && !event.altKey && !event.ctrlKey && !event.metaKey) {
        event.preventDefault(); actions.hideModule(selectedModule); setSelectedModule(null); return;
      }
      if (!event.altKey) return;
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault(); actions.moveModule(selectedModule, event.key === "ArrowUp" ? -1 : 1); return;
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const widths = GRID_WIDTHS;
        const current = widths.indexOf(data.preferences.moduleWidths[selectedModule]);
        const next = Math.max(0, Math.min(widths.length - 1, current + (event.key === "ArrowLeft" ? -1 : 1)));
        requestWidth(selectedModule, widths[next]);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [actions, data.preferences.moduleWidths, canManage, selectedModule]);
  const requestWidth = (module: PointModule, width: ModuleWidth) => {
    if (!actions) return;
    if (resizeMovesOtherBlocks(visibleModules, data.preferences.moduleWidths, module, width)) {
      setBlockedResize({ module, width }); return;
    }
    setBlockedResize(null); actions.updateModuleWidth(module, width);
  };
  const beginResize = (event: ReactPointerEvent<HTMLButtonElement>, module: PointModule) => {
    if (!actions) return;
    event.preventDefault(); event.stopPropagation(); touchCleanup.current?.();
    const grid = event.currentTarget.closest(".report-module-grid")?.getBoundingClientRect();
    if (!grid) return;
    const initialX = event.clientX, initial = moduleColumns(data.preferences.moduleWidths[module]);
    let width = data.preferences.moduleWidths[module];
    const move = (e: PointerEvent) => {
      const columns = Math.max(1, Math.min(4, initial + Math.round((e.clientX - initialX) / (grid.width / 4))));
      width = GRID_WIDTHS[columns - 1];
      setBlockedResize({ module, width });
    };
    const cleanup = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", finish); window.removeEventListener("pointercancel", cancel); touchCleanup.current = null; };
    const finish = () => { cleanup(); requestWidth(module, width); };
    const cancel = () => { cleanup(); setBlockedResize(null); };
    touchCleanup.current = cleanup;
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", finish, { once: true }); window.addEventListener("pointercancel", cancel, { once: true });
  };
  const moduleLabel = (module: PointModule) => pointModules.find((item) => item.id === module)?.label ?? module;
  const touchCleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => touchCleanup.current?.(), []);
  const beginTouchDrag = (event: ReactPointerEvent<HTMLButtonElement>, module: PointModule) => {
    if (event.pointerType === "mouse" || !actions) return;
    event.preventDefault(); event.stopPropagation(); touchCleanup.current?.();
    setDraggedModule(module); setSelectedModule(module); setContextMenu(null);
    let destination: PointModule | null = null, after = false;
    const move = (e: PointerEvent) => {
      e.preventDefault();
      const node = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-point-module]");
      const id = node?.dataset.pointModule as PointModule | undefined;
      if (node && id && id !== module) { const box = node.getBoundingClientRect(); destination = id; after = e.clientY > box.top + box.height / 2; setDropModule(id); setDropAfter(after); }
      if (e.clientY < 90) window.scrollBy(0, -16); else if (e.clientY > window.innerHeight - 90) window.scrollBy(0, 16);
    };
    const cleanup = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", finish); window.removeEventListener("pointercancel", cancel); setDraggedModule(null); setDropModule(null); touchCleanup.current = null; };
    const finish = () => { if (destination) { const before = after ? visibleModules[visibleModules.indexOf(destination) + 1] ?? null : destination; if (before !== module) actions.insertModule(module, before); } cleanup(); };
    const cancel = () => cleanup();
    touchCleanup.current = cleanup;
    window.addEventListener("pointermove", move, { passive: false }); window.addEventListener("pointerup", finish, { once: true }); window.addEventListener("pointercancel", cancel, { once: true });
  };
  const dropPreview = draggedModule ? <div className={`canvas-grid-slot report-module-item width-${data.preferences.moduleWidths[draggedModule]}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { if (!actions || !dropModule) return; event.preventDefault(); event.stopPropagation(); const before = dropAfter ? visibleModules[visibleModules.indexOf(dropModule) + 1] ?? null : dropModule; if (before !== draggedModule) actions.insertModule(draggedModule, before); setDraggedModule(null); setDropModule(null); }} aria-hidden="true">{moduleLabel(draggedModule)} · déposer {dropAfter ? "après" : "avant"}</div> : null;
  const moduleToolbar = (module: PointModule) => canManage && actions ? <div className="canvas-module-toolbar" aria-label={`Mise en page du bloc ${moduleLabel(module)}`}>
    <button type="button" className="canvas-drag-handle" onPointerDown={(event) => beginTouchDrag(event, module)} draggable title="Faire glisser le bloc" aria-label={`Déplacer ${moduleLabel(module)}`} onDragStart={(event) => { setDraggedModule(module); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", module); }} onDragEnd={() => { setDraggedModule(null); setDropModule(null); }}>⋮⋮</button>
    <span className="canvas-module-label">{moduleLabel(module)}</span>{editingModule === module && <button type="button" className="canvas-edit-done" onClick={() => { setEditingModule(null); setActiveDossier(null); }}>Revenir à la lecture</button>}
    <button type="button" className="canvas-module-options" aria-haspopup="menu" aria-expanded={contextMenu?.module === module} title="Ordre, largeur et visibilité" aria-label={`Options de mise en page pour ${moduleLabel(module)}`} onClick={(event) => { event.stopPropagation(); const rect = event.currentTarget.getBoundingClientRect(); setSelectedModule(module); setContextMenu((current) => current?.module === module ? null : { module, x: Math.max(8, Math.min(rect.right - 230, window.innerWidth - 238)), y: Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - 420)) }); }}>•••</button>
  </div> : null;
  return <div className={`report-canvas ${canManage && libraryOpen ? "has-block-library" : ""}`} onClick={() => setContextMenu(null)} onContextMenu={(event) => { if (!actions || (event.target as HTMLElement).closest("a,input,textarea,select,[contenteditable]")) return; event.preventDefault(); setLibraryOpen(true); }}><div className="report-ambient report-ambient-one"/><div className="report-ambient report-ambient-two"/>
    {canManage && actions && <><button type="button" className="block-library-toggle" aria-expanded={libraryOpen} onClick={() => setLibraryOpen(!libraryOpen)}>{libraryOpen ? "Fermer la structure" : "Structure du point"}</button>{libraryOpen && <aside className="block-library structure-dock" aria-label="Structure du point"><header><strong>Structure du point</strong><button type="button" aria-label="Fermer la structure" onClick={() => setLibraryOpen(false)}>×</button></header><p>Grille de 4 colonnes. Choisis la position et la largeur des blocs.</p><ol className="structure-tree">{visibleModules.map((module, index) => <li key={module} className={selectedModule === module ? "active" : ""} onDragOver={(event) => { if (draggedModule && draggedModule !== module) { event.preventDefault(); setDropModule(module); setDropAfter(false); } }} onDrop={(event) => { if (!draggedModule || draggedModule === module) return; event.preventDefault(); actions.insertModule(draggedModule, module); setDraggedModule(null); setDropModule(null); }}><div className="structure-row"><button type="button" draggable className="structure-drag" aria-label={`Déplacer ${moduleLabel(module)} dans la structure`} onDragStart={(event) => { setDraggedModule(module); event.dataTransfer.setData("text/plain", module); }} onDragEnd={() => { setDraggedModule(null); setDropModule(null); }}>⋮⋮</button><button type="button" className="structure-name" onClick={() => { setSelectedModule(module); document.querySelector(`[data-point-module="${module}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>{moduleLabel(module)}</button><button type="button" className="structure-edit" aria-label={`Modifier ${moduleLabel(module)}`} onClick={() => { setSelectedModule(module); setEditingModule(module); }}>•••</button></div><div className="structure-row-settings"><label>Position<select aria-label={`Position ${moduleLabel(module)}`} value={index} onChange={(event) => { const others = visibleModules.filter((id) => id !== module); actions.insertModule(module, others[Number(event.target.value)] ?? null); }}>{visibleModules.map((_, i) => <option key={i} value={i}>{i + 1}</option>)}</select></label><label>Largeur<select aria-label={`Largeur ${moduleLabel(module)}`} value={data.preferences.moduleWidths[module]} onChange={(event) => requestWidth(module, event.target.value as ModuleWidth)}><option value="full">Entière</option><option value="three-quarters">3/4</option><option value="half">1/2</option><option value="quarter">1/4</option></select></label></div></li>)}</ol><details className="structure-add"><summary>Ajouter un bloc</summary>{hiddenModules.map((module) => <button type="button" key={module} onClick={() => { actions.insertModule(module, null); setSelectedModule(module); }}>{moduleLabel(module)}</button>)}<button type="button" onClick={actions.addDossier}>Nouveau dossier</button></details></aside>}</>}

    {blockedResize && actions && <div className="canvas-resize-notice" role="status"><span>{moduleLabel(blockedResize.module)} · {moduleColumns(blockedResize.width)}/4 — les autres blocs restent en place.</span><button type="button" onClick={() => { actions.updateModuleWidth(blockedResize.module, blockedResize.width); setBlockedResize(null); }}>Appliquer et réorganiser</button><button type="button" onClick={() => setBlockedResize(null)}>Annuler</button></div>}
    <header className="report-hero"><div><div className="market-badge"><i/> MARKET PULSE <b>/</b> {market.short}</div><h1>Point marché</h1><p><strong>{market.name}</strong><span>Dossiers · simulations · promotions · Jira</span></p></div><div className="week-card"><strong><small>{isoWeekYear(data.meetingDate)} ·</small>S{String(isoWeek(data.meetingDate)).padStart(2, "0")}</strong><i/><div><b>{dateLabel(data.meetingDate)}</b><span>Année et semaine ISO</span></div></div></header>
    <section className={`report-priority ${priorityEditing ? "is-inline-editing" : ""}`} onContextMenu={(event) => { if (!actions) return; event.preventDefault(); event.stopPropagation(); setPriorityEditing(true); }}><span>Priorité de la semaine</span>{priorityEditing && actions ? <><textarea autoFocus aria-label="Priorité de la semaine" value={data.priority} onChange={(event) => actions.updatePriority(event.target.value)}/><button type="button" onClick={() => setPriorityEditing(false)}>Terminer</button></> : <><strong>{data.priority || "Aucune priorité renseignée."}</strong>{actions && <button type="button" className="canvas-priority-edit" onClick={() => setPriorityEditing(true)}>Modifier</button>}</>}</section>

    <div className={`report-module-grid ${canManage ? "is-inline-editing" : ""} ${draggedModule ? "is-grid-dragging" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { if (!actions || !draggedModule || dropModule) return; event.preventDefault(); actions.insertModule(draggedModule, null); setDraggedModule(null); }}>
      {visibleModules.map((module) => <Fragment key={module}>{dropModule === module && !dropAfter && draggedModule !== module && dropPreview}<div data-point-module={module} className={`report-module-item ${editingModule === module ? "is-block-editing" : ""} width-${data.preferences.moduleWidths[module]} ${selectedModule === module ? "is-selected" : ""} ${dropModule === module ? (dropAfter ? "is-drop-after" : "is-drop-target") : ""} ${draggedModule === module ? "is-drag-source" : ""}`} onClick={(event) => { if (canManage) { event.stopPropagation(); setSelectedModule(module); setContextMenu(null); } }} tabIndex={canManage ? 0 : undefined} onKeyDown={(event) => { if (canManage && actions && event.key === "F10" && event.shiftKey) { event.preventDefault(); const box = event.currentTarget.getBoundingClientRect(); setContextMenu({ module, x: Math.max(8, Math.min(box.left, window.innerWidth - 245)), y: Math.max(8, Math.min(box.top, window.innerHeight - 420)) }); } }} onContextMenu={(event) => { if (!canManage || !actions || (event.target as HTMLElement).closest("input,textarea,select,[contenteditable]")) return; event.preventDefault(); event.stopPropagation(); setSelectedModule(module); setContextMenu({ module, x: Math.max(8, Math.min(event.clientX, window.innerWidth - 245)), y: Math.max(8, Math.min(event.clientY, window.innerHeight - 420)) }); }} onDragEnter={(event) => { if (!canManage || !draggedModule || draggedModule === module) return; event.preventDefault(); setDropModule(module); }} onDragOver={(event) => { if (canManage && draggedModule) { event.preventDefault(); const box = event.currentTarget.getBoundingClientRect(); setDropModule(module); setDropAfter(event.clientY > box.top + box.height / 2); } }} onDragLeave={(event) => { if (!(event.relatedTarget instanceof HTMLElement && event.relatedTarget.closest(".canvas-grid-slot")) && !event.currentTarget.contains(event.relatedTarget as Node)) setDropModule((current) => current === module ? null : current); }} onDrop={(event) => { if (!actions || !draggedModule || draggedModule === module) return; event.preventDefault(); event.stopPropagation(); const index = visibleModules.indexOf(module); const before = dropAfter ? visibleModules[index + 1] ?? null : module; if (before !== draggedModule) actions.insertModule(draggedModule, before); setDraggedModule(null); setDropModule(null); }}><div className="canvas-module-shell">{moduleToolbar(module)}{editingModule === module && actions && (module === "jira" || module === "operations") && <div className="canvas-source-controls"><span>Source {module === "jira" ? "Jira" : "simulations"}</span><div>{(["automatic", "manual"] as const).map((mode) => <button type="button" key={mode} className={(module === "jira" ? data.jiraMode : data.plannerMode) === mode ? "active" : ""} onClick={() => actions.setSourceMode(module === "jira" ? "jira" : "planner", mode)}>{mode === "automatic" ? "Import" : "Manuel"}</button>)}</div></div>}{content[module]}{canManage && <button type="button" className="canvas-resize-handle" aria-label={`Redimensionner ${moduleLabel(module)}`} title="Glisser pour redimensionner sur la grille" onPointerDown={(event) => beginResize(event, module)} onClick={(event) => { event.stopPropagation(); const next = GRID_WIDTHS[Math.min(3, moduleColumns(data.preferences.moduleWidths[module]))]; requestWidth(module, next); }}>↔</button>}</div></div>{dropModule === module && dropAfter && draggedModule !== module && dropPreview}</Fragment>)}
    </div>
    {contextMenu && canManage && actions && <div className="canvas-context-menu" role="menu" aria-label={`Actions pour ${moduleLabel(contextMenu.module)}`} style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(event) => event.stopPropagation()}><strong>{moduleLabel(contextMenu.module)}</strong><button type="button" onClick={() => { setEditingModule(editingModule === contextMenu.module ? null : contextMenu.module); setActiveDossier(null); setContextMenu(null); }}>{editingModule === contextMenu.module ? "Revenir à la lecture" : "Modifier le bloc"}</button><button type="button" onClick={() => { actions.moveModule(contextMenu.module, -1); setContextMenu(null); }}>↑ Monter</button><button type="button" onClick={() => { actions.moveModule(contextMenu.module, 1); setContextMenu(null); }}>↓ Descendre</button><div className="canvas-context-width"><span>Largeur</span>{GRID_WIDTHS.map((width) => <button key={width} type="button" className={data.preferences.moduleWidths[contextMenu.module] === width ? "active" : ""} onClick={() => requestWidth(contextMenu.module, width)}>{`${moduleColumns(width)}/4`}</button>)}</div>{hiddenModules.length > 0 && <><label>Ajouter avant<select defaultValue="" onChange={(event) => { const moduleId = event.target.value as PointModule; if (moduleId) actions.insertModule(moduleId, contextMenu.module); setContextMenu(null); }}><option value="">Choisir…</option>{hiddenModules.map((module) => <option key={module} value={module}>{moduleLabel(module)}</option>)}</select></label><label>Ajouter après<select defaultValue="" onChange={(event) => { const moduleId = event.target.value as PointModule; if (moduleId) { const index = data.preferences.moduleOrder.indexOf(contextMenu.module); actions.insertModule(moduleId, data.preferences.moduleOrder[index + 1] ?? null); } setContextMenu(null); }}><option value="">Choisir…</option>{hiddenModules.map((module) => <option key={module} value={module}>{moduleLabel(module)}</option>)}</select></label></>}<button type="button" className="danger" onClick={() => { actions.hideModule(contextMenu.module); setSelectedModule(null); setContextMenu(null); }}>Supprimer du point</button><button type="button" onClick={() => { actions.resetLayout(); setContextMenu(null); }}>Réinitialiser la structure</button></div>}
    <footer className="report-footer"><span>Market Pulse · {market.name}</span><span>Point marché · {isoWeekYear(data.meetingDate)} · S{String(isoWeek(data.meetingDate)).padStart(2, "0")}</span></footer>
  </div>;
}

