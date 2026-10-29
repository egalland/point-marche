"use client";
import {JiraWeeklyCompleted,JiraCategorySummary} from "./jira-point-activity";

import {SimulationCompactCard} from "./simulation-compact-card";
import {normalizeSimulationPresentation,simulationMetricLabels,type SimulationPresentation,type SimulationMetric} from "@/lib/simulation-presentation";
import {SimulationAverageCards,SimulationHistoryMini} from "./simulation-point-metrics";
import {ManualSimulationRemove} from "./manual-simulation-remove";
import { PromotionBoard } from "./promotion-board";

import { JiraPointSummary } from "./jira-point-summary";
import { JiraResolutionKpis } from "./jira-resolution-kpis";
import { marketSpecialties } from "@/lib/jira-market-scope";
import { SimulationDetails } from "./simulation-details";
import {PURCHASESPoint} from "./purchaseData-dashboard";
import type {PURCHASESConfig} from "@/lib/purchaseData";
import { FreePointCanvas } from "./free-point-canvas";
import type { FreeLayout } from "@/lib/free-point-layout";
import { useEffect, useMemo, useState, type ReactNode } from "react";
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
  const content = <><span>{item.key || "Synthèse"}</span><div><strong>{item.summary || "Synthèse de la file Jira"}</strong><small>{[item.category, item.subcategory].filter(Boolean).join(" / ")}{item.category || item.subcategory ? " · " : ""}{jiraRuleFor(item, data.jiraAlertRules ?? [])?.priority === "high" ? "Prioritaire · " : ""}{jiraRuleFor(item,data.jiraAlertRules??[])?.implication ? `${jiraRuleFor(item,data.jiraAlertRules??[])?.implication} · ` : ""}{item.status} · {signal.inactivity === null ? "activité non datée" : signal.inactivity === 0 ? "mise à jour aujourd’hui" : `dernière modification il y a ${signal.inactivity} j`}</small></div><b>{jiraItemCount(item) > 1 ? jiraItemCount(item) : signal.level === "critical" ? `Critique · ${signal.inactivity} j` : signal.level === "warning" ? `À surveiller · ${signal.inactivity} j` : "À jour"}</b></>;
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
  const [category,setCategory]=useState("all");
  const [subcategory, setSubcategory] = useState("all");
  const [expandedPerson, setExpandedPerson] = useState("");
  const attentionRank: Record<JiraAttentionLevel, number> = { critical: 0, warning: 1, undated: 2, fresh: 3 };
  const filteredRows = stats.rows.filter((row) => {
    const scopeMatches = scope === "all" || (scope === "attention" ? row.level === "warning" || row.level === "critical" : row.level === "critical");
    return scopeMatches && (category === "all" || (row.item.category||"Non renseignée") === category) && (status === "all" || row.item.status === status) && (subcategory === "all" || row.item.subcategory === subcategory);
  }).sort((left, right) => Number(jiraRuleFor(right.item, data.jiraAlertRules ?? [])?.priority === "high") - Number(jiraRuleFor(left.item, data.jiraAlertRules ?? [])?.priority === "high") || attentionRank[left.level] - attentionRank[right.level] || (right.inactivity ?? -1) - (left.inactivity ?? -1) || left.item.key.localeCompare(right.item.key, "fr", { numeric: true }));
  const people = groupJiraPeople(filteredRows.map((row) => row.item)).sort((left, right) => {
    const strongest = (person: JiraPersonGroup) => Math.min(...person.items.map((item) => attentionRank[jiraAttention(item, data.meetingDate, market, data.jiraAlertRules).level]));
    return strongest(left) - strongest(right) || right.total - left.total || left.assignee.localeCompare(right.assignee, "fr");
  });
  const filteredVolume = filteredRows.reduce((sum, row) => sum + jiraItemCount(row.item), 0);
  const maxVolume = Math.max(1, ...stats.points.map((point) => point.value));
  const activeFilter = scope !== "all" || status !== "all" || category !== "all" || subcategory !== "all";
  const scopeLabel = scope === "attention" ? "sans activité" : scope === "critical" ? "critiques" : "tous les tickets";
  return <section className="jira-command-center" aria-labelledby="jira-command-title">
    <header className="jira-command-header"><div><span>Radar Jira</span><h2 id="jira-command-title">Tickets · {market.name}</h2><p>Spécialités {marketSpecialties(market).join(" / ") || market.name} · tous les rôles. Les tickets sans spécialité reconnue sont rattachés par l’annuaire du marché. Le marché se choisit dans la barre supérieure.</p></div><div className="jira-command-delta"><small>Depuis le dernier point</small><strong>{stats.delta === null ? "—" : `${stats.delta > 0 ? "+" : ""}${stats.delta}`}</strong><span>{stats.delta === null ? "Première mesure" : stats.delta === 0 ? "Volume stable" : "Évolution du stock"}</span></div></header>
    {editing && onRules && <JiraRulesEditor rules={data.jiraAlertRules ?? []} tickets={data.jira} onChange={onRules}/>}
    <label className="jira-subcategory-filter">Catégorie<select value={category} onChange={e=>{setCategory(e.target.value);setSubcategory("all");}}><option value="all">Toutes les catégories</option>{[...new Set(data.jira.map(t=>t.category||"Non renseignée"))].sort().map(c=><option key={c}>{c}</option>)}</select></label><label className="jira-subcategory-filter">Sous-catégorie<select value={subcategory} onChange={(e) => setSubcategory(e.target.value)}><option value="all">Toutes les sous-catégories</option>{[...new Set(data.jira.map((t) => t.subcategory).filter(Boolean))].map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
    <div className="jira-command-kpis" role="group" aria-label="Filtres d’attention Jira">
      <button type="button" className={scope === "all" ? "active" : ""} aria-pressed={scope === "all"} onClick={() => setScope("all")}><span>Tickets ouverts</span><strong>{stats.currentVolume}</strong><small>Stock actuel du marché</small><i className="tone-aqua"/></button>
      <button type="button" className={scope === "attention" ? "active warning" : "warning"} aria-pressed={scope === "attention"} onClick={() => setScope("attention")}><span>Sans activité</span><strong>{stats.attentionCount}</strong><small>Seuils du marché ou de la catégorie</small><i className="tone-peach"/></button>
      <button type="button" className={scope === "critical" ? "active critical" : "critical"} aria-pressed={scope === "critical"} onClick={() => setScope("critical")}><span>Attention forte</span><strong>{stats.criticalCount}</strong><small>Seuils du marché ou de la catégorie</small><i className="tone-red"/></button>
    </div>
    <JiraWeeklyCompleted data={data}/><JiraCategorySummary data={data}/><JiraResolutionKpis tickets={data.jira} date={data.meetingDate} snapshot={data.jiraMode === "automatic" ? data.jiraResolution : undefined}/>
    <div className="jira-command-visuals">
      <article className="jira-trend-panel"><div><span>Évolution du volume</span><strong>Quatre derniers points</strong></div><div className="jira-trend-columns" aria-label="Historique du volume Jira">{stats.points.map((point, index) => <div key={`${point.label}-${index}`} className={index === stats.points.length - 1 ? "current" : ""}><b>{point.value}</b><span><i style={{ height: `${Math.max(7, (point.value / maxVolume) * 100)}%` }}/></span><small>{point.label}</small></div>)}</div></article>
      <article className="jira-status-panel"><div><span>Répartition</span><strong>Filtrer par statut</strong></div><div className="jira-interactive-bar">{stats.statusTotals.length ? stats.statusTotals.map((item, index) => <button key={item.status} type="button" className={`segment-${index % 6} ${status === item.status ? "active" : ""}`} style={{ width: `${(item.value / Math.max(1, stats.currentVolume)) * 100}%` }} aria-label={`${item.status} : ${item.value}`} aria-pressed={status === item.status} onClick={() => setStatus((current) => current === item.status ? "all" : item.status)}/>) : <i/>}</div><div className="jira-status-buttons"><button type="button" className={status === "all" ? "active" : ""} onClick={() => setStatus("all")}>Tous</button>{stats.statusTotals.map((item, index) => <button key={item.status} type="button" className={status === item.status ? "active" : ""} onClick={() => setStatus((current) => current === item.status ? "all" : item.status)}><i className={`segment-${index % 6}`}/>{item.status}<b>{item.value}</b></button>)}</div></article>
    </div>
    <div className="jira-command-filter"><div><Icon name="filter" size={15}/><span><strong>{filteredVolume}</strong> ticket{filteredVolume > 1 ? "s" : ""} · {scopeLabel}{status !== "all" ? ` · ${status}` : ""}</span></div>{activeFilter && <button type="button" onClick={() => { setScope("all"); setStatus("all"); setCategory("all"); setSubcategory("all"); }}>Réinitialiser</button>}</div>
    {people.length ? <div className="jira-command-people">{people.map((person) => {
      const open = expandedPerson === person.assignee;
      const attention = stats.rows.filter((row) => (row.item.assignee.trim() || "Non assigné") === person.assignee && (row.level === "warning" || row.level === "critical")).reduce((sum, row) => sum + jiraItemCount(row.item), 0);
      return <article key={person.assignee} className={open ? "open" : ""}><button type="button" className="jira-person-toggle" aria-expanded={open} onClick={() => setExpandedPerson((current) => current === person.assignee ? "" : person.assignee)}><span className="jira-person-avatar">{person.assignee.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span><span><strong>{person.assignee}</strong><small>{jiraStatusSummary(person.items)}</small></span>{attention > 0 && <b className="jira-person-alert">{attention} à regarder</b>}<em>{person.total}</em><Icon name="chevron" size={16}/></button>{open && <div className="jira-person-tickets">{person.items.slice().sort((left, right) => attentionRank[jiraAttention(left, data.meetingDate, market, data.jiraAlertRules).level] - attentionRank[jiraAttention(right, data.meetingDate, market, data.jiraAlertRules).level] || (jiraAttention(right, data.meetingDate, market, data.jiraAlertRules).inactivity ?? -1) - (jiraAttention(left, data.meetingDate, market, data.jiraAlertRules).inactivity ?? -1)).map((item) => <JiraReadTicket key={item.id} item={item} data={data} market={market} editing={editing} onUpdate={onUpdate} onReset={onReset}/>)}</div>}</article>;
    })}</div> : <div className="jira-command-empty"><Icon name="ticket" size={24}/><strong>{stats.currentVolume ? "Aucun ticket dans ce filtre" : "Aucun ticket actif"}</strong><span>{stats.currentVolume ? "Réinitialise les filtres pour retrouver l’ensemble du stock." : "Le prochain import Jira alimentera automatiquement ce tableau de bord."}</span></div>}
    {editing && onAdd && <button type="button" className="canvas-inline-add" onClick={onAdd}><Icon name="plus" size={15}/> Ajouter une synthèse Jira</button>}
  </section>;
}

export type PointCanvasActions = {
  updateFreeLayout?: (layout: FreeLayout) => void;
  updatePriority: (value: string) => void;
  updateDossier: (id: string, patch: Partial<Dossier>) => void;
  addDossier: () => string;
  removeDossier: (id: string) => void;
  moveDossier: (id: string, before: string | null) => void;
  updatePURCHASES: (configs: PURCHASESConfig[]) => void;
  updateComparison: (config: ComparisonConfig, snapshot: ComparisonSnapshot) => void;
  updateJiraRules: (rules: JiraAlertRule[]) => void;
  setSimulationPresentation?: (presentation:SimulationPresentation)=>void;
  setSimulationPeriods?: (periods:string[])=>void;
  refreshSimulations?:()=>void;
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
  resetPoint?: () => void;
  openPointSettings?: () => void;
};

export function PreviewDashboard({ data, market, archive, editing = false, actions, tasks = [], markets = [], plannerUpdatedAt = "", snapshotOnly = false }: { snapshotOnly?: boolean; data: PointData; market: Market; archive: PointRecord[]; editing?: boolean; actions?: PointCanvasActions; tasks?: PlannerTask[]; markets?: Market[]; plannerUpdatedAt?: string }) {

  const canManage = Boolean(actions);
  const [activeDossier, setActiveDossier] = useState<string | null>(null);
  const [editingModule, setEditingModule] = useState<PointModule | null>(null);
  const alerts = useMemo(() => buildAlerts(data, market), [data, market]);
  const [alertFilter, setAlertFilter] = useState<"all" | "danger">("all");
  const visibleAlerts = alerts.filter((item) => alertFilter === "all" || item.severity === "danger");
  const currentMonth = calendarMonthLabel(monthStart(data.meetingDate));
  const followingMonth = calendarMonthLabel(shiftMonth(monthStart(data.meetingDate), 1));
  const presentation=normalizeSimulationPresentation(data.preferences.simulationPresentation);
  const periods=data.preferences.simulationPeriods??[monthStart(data.meetingDate).slice(0,7),shiftMonth(monthStart(data.meetingDate),1).slice(0,7)];
  const operationGroups=periods.map(period=>{const month=calendarMonthLabel(period+'-01');return {month,period,items:data.operations.filter(item=>item.month===month||item.month===period)};});
  if(!data.preferences.simulationPeriods){const extras=data.operations.filter(item=>!operationGroups.some(g=>g.items.includes(item)));if(extras.length)operationGroups.push({month:'Autres périodes',period:'',items:extras});}
  const isModuleEditing = (id: PointModule) => canManage && editingModule === id;
  const createDossier = () => { const id = actions?.addDossier(); if (id) { setActiveDossier(id); setEditingModule("dossiers"); } return id; };
  const content: Record<PointModule, ReactNode> = {
    purchaseData: <PURCHASESPoint snapshotOnly={snapshotOnly} configs={data.purchaseDataConfigs} meetingDate={data.meetingDate} onChange={isModuleEditing("purchaseData") ? actions?.updatePURCHASES : undefined}/>,
    simulationComparison: <SimulationComparison snapshotOnly={snapshotOnly} tasks={tasks} markets={markets} config={data.simulationComparisonConfig ?? normalizeComparison(null, market.id)} snapshot={data.simulationComparisonSnapshot} editing={isModuleEditing("simulationComparison")} updatedAt={plannerUpdatedAt} onChange={actions?.updateComparison}/>,
    comparison: <MarketComparisonChart snapshot={data.marketComparison}/>,
    jira: isModuleEditing("jira") ? <JiraCommandCenter key={`${market.id}-${data.meetingDate}`} data={data} archive={archive} market={market} editing onUpdate={actions?.updateJira} onReset={actions?.resetJira} onAdd={actions?.addJira} onRules={actions?.updateJiraRules}/> : <JiraPointSummary data={data} archive={archive} market={market}/>,
    dossiers: <DossierBoard items={data.dossiers} editing={isModuleEditing("dossiers")} onUpdate={actions?.updateDossier} onAdd={actions ? createDossier : undefined} onRemove={actions?.removeDossier} onMove={actions?.moveDossier} activeId={editingModule === "dossiers" ? activeDossier : null} onActivate={(id) => { setActiveDossier(id); setEditingModule("dossiers"); }} onDeactivate={() => { setActiveDossier(null); setEditingModule(null); }}/>,
    operations: <article className="report-focus report-standalone canvas-simulations"><div className="report-heading"><div><small>État au moment du point</small><h2>Simulations</h2></div></div>{actions?.setSimulationPeriods&&<details className="simulation-period-controls"><summary>Présentation et périodes</summary>{actions.setSimulationPresentation&&<div className="simulation-format-settings"><label>Placement des mois<select value={presentation.months} onChange={e=>actions.setSimulationPresentation?.({...presentation,months:e.target.value as SimulationPresentation['months']})}><option value="columns">Mois en colonnes</option><option value="stacked">Mois empilés</option></select></label><label>Format des simulations<select value={presentation.items} onChange={e=>actions.setSimulationPresentation?.({...presentation,items:e.target.value as SimulationPresentation['items']})}><option value="cards">Cartes détaillées</option><option value="rows">Ligne par ligne</option></select></label><fieldset><legend>Moyennes à afficher</legend>{Object.entries(simulationMetricLabels).map(([key,label])=><label key={key}><input type="checkbox" checked={presentation.averages.includes(key as SimulationMetric)} onChange={e=>actions.setSimulationPresentation?.({...presentation,averages:e.target.checked?[...presentation.averages,key as SimulationMetric]:presentation.averages.filter(k=>k!==key)})}/>{label}</label>)}</fieldset><label><input type="checkbox" checked={presentation.history} onChange={e=>actions.setSimulationPresentation?.({...presentation,history:e.target.checked})}/> Mini historique des évolutions</label></div>}{periods.map((period,index)=><label key={index}>Période <input type="month" value={period} onChange={e=>{if(e.target.value)actions.setSimulationPeriods?.(periods.map((p,i)=>i===index?e.target.value:p));}}/><button type="button" aria-label={`Retirer la période ${period}`} onClick={()=>actions.setSimulationPeriods?.(periods.filter((_,i)=>i!==index))}>×</button></label>)}<button type="button" onClick={()=>actions.setSimulationPeriods?.([...periods,shiftMonth((periods.at(-1)??monthStart(data.meetingDate).slice(0,7))+'-01',1).slice(0,7)])}>＋ Ajouter une période</button><button type="button" onClick={actions.refreshSimulations}>Actualiser les simulations</button></details>}<div className={`simulation-month-grid months-${presentation.months} items-${presentation.items}`}>{operationGroups.map((group) => <section className="simulation-month" key={group.month}><header><span>{group.month}</span><b>{group.items.length}</b></header><SimulationAverageCards items={group.items} metrics={presentation.averages}/><div>{group.items.map((item) => <SimulationCompactCard key={item.id} item={item} months={operationGroups.map(g=>g.month)} history={presentation.history} actions={actions}/>)}</div>{isModuleEditing("operations") && actions && <button type="button" className="canvas-inline-add month-add" onClick={() => actions.addOperation(group.month)}><Icon name="plus" size={15}/> Ajouter une simulation</button>}</section>)}</div>{!data.operations.length && !isModuleEditing("operations") && <div className="report-empty">Aucune simulation renseignée</div>}</article>,
    promotions: <PromotionBoard items={data.promotions} editing={isModuleEditing("promotions")} onUpdate={actions?.updatePromotion} onAdd={actions?.addPromotion} onRemove={actions?.removePromotion}/>,
    alerts: <article className="report-alert-card"><div className="alert-heading"><h2>Vigilances du point</h2></div><p className="vigilance-explanation">Synthèse automatique : tickets Jira sans activité, dossiers en retard et vigilances PURCHASES enregistrées avec les spécialités du point. Ouvre une alerte pour consulter sa source ; les corrections se font dans le ticket ou le dossier.</p>{alerts.length > 0 && <div className="alert-filters"><button type="button" className={alertFilter === "all" ? "active" : ""} onClick={() => setAlertFilter("all")}>Toutes</button><button type="button" className={alertFilter === "danger" ? "active" : ""} onClick={() => setAlertFilter("danger")}>Critiques</button></div>}{visibleAlerts.length ? visibleAlerts.map((item, index) => <a className="alert-line alert-line-clean" key={`${item.title}-${index}`} href={item.link || (item.targetId ? `#${item.targetId}` : "#top")}><div><strong>{item.title}</strong><small><b>{item.category}</b> · {item.detail}</small></div><Icon name="chevron" size={14}/></a>) : <div className="report-empty light-empty">{alerts.length ? "Aucune vigilance dans ce filtre" : "Aucune vigilance détectée"}</div>}</article>,
  };
  return <div className="report-canvas"><div className="report-ambient report-ambient-one"/><div className="report-ambient report-ambient-two"/>
    <FreePointCanvas data={data} content={content} details={{jira:<JiraCommandCenter data={data} archive={archive} market={market}/>}} actions={actions ? { ...actions, addDossier: () => createDossier()! } : undefined} editingModule={editingModule} onEdit={(module,itemId) => { setEditingModule(module); if (module === "dossiers") setActiveDossier(itemId??data.dossiers[0]?.id??null); }}/>
    <footer className="report-footer"><span>Market Plus · {market.name}</span><span>Point marché · {isoWeekYear(data.meetingDate)} · S{String(isoWeek(data.meetingDate)).padStart(2, "0")}</span></footer>
  </div>;
}

