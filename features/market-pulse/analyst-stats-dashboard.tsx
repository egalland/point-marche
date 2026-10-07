"use client";

import { useMemo, useState } from "react";
import { TablePagination, useTablePage } from "@/components/table-pagination";
import { buildAnalystStats, type AnalystStatsMarket, type PlannerDelaySummary } from "@/lib/analyst-stats";
import type { GlobalDirectoryUser } from "@/lib/global-directory";
import type { PlannerSpecialty, PlannerTask } from "@/lib/planner-import";
import type { PlannerRegistrySummary } from "@/lib/planner-registry";
import { compareSupplierTurnover, formatSupplierTurnover, supplierTurnoverLabel, supplierTurnoverSource } from "@/lib/supplier-turnover";
import { PlannerImportDialog } from "./planner-import-dialog";
import { SupplierVariationDashboard } from "./supplier-variation-dashboard";

type Props = {
  tasks: PlannerTask[];
  users: GlobalDirectoryUser[];
  markets: AnalystStatsMarket[];
  registry: PlannerRegistrySummary;
  updatedAt: string;
  onImport: (rawText: string) => Promise<{ imported: number; message: string }>;
};

type DetailSort = "date" | "analyst" | "specialty" | "task" | "ca" | "market" | "step";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function monthsAgo(amount: number) {
  const date = new Date();
  date.setUTCMonth(date.getUTCMonth() - amount, 1);
  return date.toISOString().slice(0, 10);
}

function daysAgo(amount: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - amount);
  return date.toISOString().slice(0, 10);
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function previousWeekRange() {
  const current = new Date(`${today()}T12:00:00Z`);
  const monday = new Date(current);
  monday.setUTCDate(current.getUTCDate() - ((current.getUTCDay() + 6) % 7) - 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { from: isoDate(monday), to: isoDate(sunday) };
}

function lastCompletedCycle20() {
  const current = new Date(`${today()}T12:00:00Z`);
  const end = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 20, 12));
  if (current < end) end.setUTCMonth(end.getUTCMonth() - 1);
  const start = new Date(end);
  start.setUTCMonth(start.getUTCMonth() - 1);
  return { from: isoDate(start), to: isoDate(end) };
}

function percent(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 0 }).format(value);
}

function movementLabel(value: number | null) {
  if (value === null) return "Nouvelle activité sur la période";
  if (!value) return "Stable vs période précédente";
  return `${value > 0 ? "+" : ""}${new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 0 }).format(value)} vs période précédente`;
}

function daysLabel(value: number | null) {
  return value === null ? "—" : `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value)} j`;
}

function delayMovementLabel(summary: PlannerDelaySummary) {
  if (summary.average === null) return "Aucune paire de dates exploitable";
  if (summary.previousAverage === null) return "Pas de comparaison précédente";
  if (!summary.movement) return "Stable vs période précédente";
  return `${summary.movement > 0 ? "+" : ""}${daysLabel(summary.movement)} vs période précédente`;
}

export function AnalystStatsDashboard({ tasks, users, markets, registry, updatedAt, onImport }: Props) {
  const analysts = useMemo(() => users.filter((user) => user.role === "analyste-tarif-referentiel").sort((left, right) => left.name.localeCompare(right.name, "fr")), [users]);
  const initialFrom = useMemo(() => monthsAgo(5), []);
  const initialTo = useMemo(() => today(), []);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [appliedRange, setAppliedRange] = useState({ from: initialFrom, to: initialTo });
  const [marketId, setMarketId] = useState("all");
  const [specialty, setSpecialty] = useState<PlannerSpecialty | "all">("all");
  const [analystIds, setAnalystIds] = useState<string[]>([]);
  const [detailSort, setDetailSort] = useState<{ key: DetailSort; direction: "asc" | "desc" }>({ key: "date", direction: "desc" });
  const [statsView, setStatsView] = useState<"activity" | "suppliers" | "purchaseData">("activity");
  const stats = useMemo(() => buildAnalystStats(tasks, users, markets, { from: appliedRange.from, to: appliedRange.to, marketId, specialty, analystIds }), [analystIds, appliedRange, marketId, markets, specialty, tasks, users]);
  const maxMonth = Math.max(1, ...stats.monthly.map((item) => item.total));
  const maxAnalyst = Math.max(1, ...stats.byAnalyst.map((item) => item.total));
  const maxDelay = Math.max(1, ...stats.delaySummaries.flatMap((item) => [item.average ?? 0, item.previousAverage ?? 0]));
  const selectAnalyst = (id: string) => setAnalystIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const setRange = (range: { from: string; to: string }) => {
    setFrom(range.from);
    setTo(range.to);
    setAppliedRange(range);
  };
  const applyPeriod = (period: "30d" | "3m" | "6m" | "year" | "previousWeek" | "cycle20") => {
    const end = today();
    if (period === "previousWeek") return setRange(previousWeekRange());
    if (period === "cycle20") return setRange(lastCompletedCycle20());
    setRange({ from: period === "30d" ? daysAgo(29) : period === "3m" ? monthsAgo(2) : period === "6m" ? monthsAgo(5) : `${new Date().getUTCFullYear()}-01-01`, to: end });
  };
  const updateFrom = (value: string) => {
    setFrom(value);
    if (isIsoDate(value) && value <= appliedRange.to) setAppliedRange((current) => ({ ...current, from: value }));
  };
  const updateTo = (value: string) => {
    setTo(value);
    if (isIsoDate(value) && value >= appliedRange.from) setAppliedRange((current) => ({ ...current, to: value }));
  };
  const toggleDetailSort = (key: DetailSort) => setDetailSort((current) => ({ key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc" }));
  const sortMark = (key: DetailSort) => detailSort.key === key ? detailSort.direction === "asc" ? " ↑" : " ↓" : "";
  const sortedContributions = useMemo(() => stats.contributions.slice().sort((left, right) => {
    if (detailSort.key === "ca") return compareSupplierTurnover(left.purchases12m, right.purchases12m, detailSort.direction);
    const marketsFor = (ids: string[], tags: string[]) => ids.map((id) => markets.find((market) => market.id === id)?.name).filter(Boolean).join(" · ") || tags.join(" · ") || "Non rattaché";
    const leftValue = detailSort.key === "date" ? left.date : detailSort.key === "analyst" ? left.analystName : detailSort.key === "specialty" ? left.specialty : detailSort.key === "task" ? left.taskName : detailSort.key === "market" ? marketsFor(left.marketIds, left.marketTags) : left.stepLabel;
    const rightValue = detailSort.key === "date" ? right.date : detailSort.key === "analyst" ? right.analystName : detailSort.key === "specialty" ? right.specialty : detailSort.key === "task" ? right.taskName : detailSort.key === "market" ? marketsFor(right.marketIds, right.marketTags) : right.stepLabel;
    const compared = leftValue.localeCompare(rightValue, "fr", { numeric: true, sensitivity: "base" });
    return detailSort.direction === "asc" ? compared : -compared;
  }), [detailSort, markets, stats.contributions]);
  const detailPage = useTablePage(sortedContributions, JSON.stringify([appliedRange, marketId, specialty, analystIds, detailSort]));

  return <main className="analyst-stats-page">
    <header className="stats-hero">
      <div><span>Activité tarif et référentiel</span><h1>Statistiques analystes</h1><p>Lecture descriptive des simulations et contrôles identifiés dans l’export Planner, sans objectif individuel.</p></div>
      <div className="stats-hero-actions"><PlannerImportDialog markets={markets} onImport={onImport}/><div className="stats-freshness"><span>Source actualisée</span><strong>{updatedAt ? new Date(updatedAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "Aucun import"}</strong><small>{tasks.length} tâche{tasks.length > 1 ? "s" : ""} Planner disponible{tasks.length > 1 ? "s" : ""}</small></div><small>L’import actualise aussi les simulations du point actif.</small></div>
    </header>

    <nav className="stats-view-tabs" aria-label="Vue des statistiques"><button type="button" className={statsView === "activity" ? "active" : ""} onClick={() => setStatsView("activity")}>Activité analystes</button><button type="button" className={statsView === "suppliers" ? "active" : ""} onClick={() => setStatsView("suppliers")}>Variations fournisseurs</button><button type="button" className={statsView === "purchaseData" ? "active" : ""} onClick={() => setStatsView("purchaseData")}>PURCHASES</button></nav>

    {statsView === "purchaseData" ? <section className="surface purchaseData-stats-empty"><h2>PURCHASES</h2><p>Les indicateurs seront ajoutés après définition de la structure du fichier PURCHASES.</p></section> : statsView === "suppliers" ? <SupplierVariationDashboard tasks={tasks} markets={markets} registry={registry}/> : <>

    <section className="surface stats-filters" aria-label="Filtres des statistiques">
      <div className="stats-period-presets"><span>Période rapide</span><div><button type="button" onClick={() => applyPeriod("previousWeek")}>Semaine dernière</button><button type="button" onClick={() => applyPeriod("cycle20")}>Mois dernier · 20 au 20</button><button type="button" onClick={() => applyPeriod("30d")}>30 jours</button><button type="button" onClick={() => applyPeriod("3m")}>3 mois</button><button type="button" onClick={() => applyPeriod("6m")}>6 mois</button><button type="button" onClick={() => applyPeriod("year")}>Cette année</button></div></div>
      <label><span>Du</span><input type="date" value={from} max={isIsoDate(to) ? to : undefined} onChange={(event) => updateFrom(event.target.value)} onBlur={() => { if (!isIsoDate(from)) setFrom(appliedRange.from); }}/></label>
      <label><span>Au</span><input type="date" value={to} min={isIsoDate(from) ? from : undefined} onChange={(event) => updateTo(event.target.value)} onBlur={() => { if (!isIsoDate(to)) setTo(appliedRange.to); }}/></label>
      <label><span>Marché</span><select value={marketId} onChange={(event) => setMarketId(event.target.value)}><option value="all">Tous les marchés</option>{markets.map((market) => <option key={market.id} value={market.id}>{market.name}</option>)}</select></label>
      <div className="stats-specialty"><span>Spécialité</span><div>{(["all", "simulation", "control"] as const).map((value) => <button type="button" key={value} className={specialty === value ? "active" : ""} onClick={() => setSpecialty(value)}>{value === "all" ? "Tout" : value === "simulation" ? "Simulation" : "Contrôle"}</button>)}</div></div>
      <div className="stats-analysts"><div><span>Analystes</span><button type="button" onClick={() => setAnalystIds([])}>{analystIds.length ? "Revenir à tous" : "Tous actifs"}</button></div><div>{analysts.map((analyst) => <button type="button" key={analyst.id} className={!analystIds.length || analystIds.includes(analyst.id) ? "active" : ""} onClick={() => selectAnalyst(analyst.id)}>{analyst.name}</button>)}</div></div>
    </section>

    <section className="stats-kpis" aria-label="Indicateurs principaux">
      <article><span>Activités identifiées</span><strong>{stats.totalActivities}</strong><small>{movementLabel(stats.movement)}</small></article>
      <article><span>Tâches distinctes</span><strong>{stats.distinctTasks}</strong><small>Une tâche n’est comptée qu’une fois</small></article>
      <article><span>Étapes Simulation</span><strong>{stats.simulations}</strong><small>Dates trouvées dans les listes de contrôle</small></article>
      <article><span>Étapes Contrôle</span><strong>{stats.controls}</strong><small>Dates trouvées dans les listes de contrôle</small></article>
      <article className={stats.coverageRate < .8 ? "warning" : ""}><span>Couverture des noms</span><strong>{percent(stats.coverageRate)}</strong><small>{stats.unmatchedNames.length ? `${stats.unmatchedNames.length} nom${stats.unmatchedNames.length > 1 ? "s" : ""} à rapprocher` : "Tous les noms sont associés"}</small></article>
    </section>

    <section className="surface stats-delay-panel" aria-labelledby="stats-delay-title">
      <header><div><span>Cycle tarifaire</span><strong id="stats-delay-title">Délais observés sur les tâches Planner</strong></div><p>La période retient la date de fin de chaque étape. Une paire absente ou incohérente n’entre pas dans le calcul.</p></header>
      <div className="stats-delay-grid">{stats.delaySummaries.map((summary) => <article className={`stats-delay-card delay-${summary.kind}`} key={summary.kind}>
        <div className="stats-delay-heading"><span>{summary.label}</span><small>{summary.definition}</small></div>
        <div className="stats-delay-value"><strong>{daysLabel(summary.average)}</strong><span>Moyenne</span></div>
        <div className="stats-delay-visual" aria-label={`${summary.label}, moyenne ${daysLabel(summary.average)}, période précédente ${daysLabel(summary.previousAverage)}`}><div><i style={{ width: `${(summary.average ?? 0) / maxDelay * 100}%` }}/>{summary.previousAverage !== null && <b style={{ left: `${summary.previousAverage / maxDelay * 100}%` }}/>}</div><small>{delayMovementLabel(summary)}</small></div>
        <footer><span>Médiane <b>{daysLabel(summary.median)}</b></span><span><b>{summary.sampleCount}</b> dossier{summary.sampleCount > 1 ? "s" : ""}</span></footer>
      </article>)}</div>
      <div className="stats-delay-note"><span><i/>Période sélectionnée</span><span><b/>Période précédente équivalente</span><small>Le filtre « spécialité » pilote les volumes ; les délais conservent les quatre étapes du cycle pour les tâches correspondant aux autres filtres.</small></div>
    </section>

    <section className="stats-grid">
      <article className="surface stats-panel stats-trend"><header><span>Évolution du volume</span><strong>Simulation et contrôle par mois</strong></header><div className="stats-month-chart">{stats.monthly.map((item) => <div className="stats-month" key={item.period}><div className="stats-month-column" title={`${item.label} · ${item.total} activité${item.total > 1 ? "s" : ""}`}><i className="control" style={{ height: `${item.controls / maxMonth * 100}%` }}/><i className="simulation" style={{ height: `${item.simulations / maxMonth * 100}%` }}/></div><b>{item.total}</b><span>{item.label}</span></div>)}</div><footer><span><i className="simulation"/> Simulation</span><span><i className="control"/> Contrôle</span></footer></article>
      <article className="surface stats-panel stats-breakdown"><header><span>Répartition</span><strong>Volume par analyste sélectionné</strong></header><div>{stats.byAnalyst.length ? stats.byAnalyst.map((item) => <div className="stats-analyst-row" key={item.id}><span>{item.name}</span><div><i className="simulation" style={{ width: `${item.simulations / maxAnalyst * 100}%` }}/><i className="control" style={{ width: `${item.controls / maxAnalyst * 100}%` }}/></div><b>{item.total}</b></div>) : <p>Aucune activité pour cette sélection.</p>}</div></article>
    </section>

    {stats.unmatchedNames.length > 0 && <section className="stats-quality-note"><strong>Noms non rapprochés de l’annuaire</strong><span>{stats.unmatchedNames.join(" · ")}. Les anciennes simulations restent comptées dans le total, sans provoquer d’erreur.</span></section>}

    <section className="surface stats-detail"><header><div><span>Détail vérifiable</span><strong>{stats.contributions.length} activité{stats.contributions.length > 1 ? "s" : ""} dans la sélection</strong></div><small>Clique sur un en-tête pour trier.</small></header><div className="data-table-wrap"><table><thead><tr><th aria-sort={detailSort.key === "date" ? detailSort.direction === "asc" ? "ascending" : "descending" : "none"}><button type="button" onClick={() => toggleDetailSort("date")}>Date{sortMark("date")}</button></th><th aria-sort={detailSort.key === "analyst" ? detailSort.direction === "asc" ? "ascending" : "descending" : "none"}><button type="button" onClick={() => toggleDetailSort("analyst")}>Analyste{sortMark("analyst")}</button></th><th aria-sort={detailSort.key === "specialty" ? detailSort.direction === "asc" ? "ascending" : "descending" : "none"}><button type="button" onClick={() => toggleDetailSort("specialty")}>Spécialité{sortMark("specialty")}</button></th><th aria-sort={detailSort.key === "task" ? detailSort.direction === "asc" ? "ascending" : "descending" : "none"}><button type="button" onClick={() => toggleDetailSort("task")}>Simulation{sortMark("task")}</button></th><th className="supplier-turnover-cell" title={supplierTurnoverSource} aria-sort={detailSort.key === "ca" ? detailSort.direction === "asc" ? "ascending" : "descending" : "none"}><button type="button" onClick={() => toggleDetailSort("ca")}>{supplierTurnoverLabel}{sortMark("ca")}</button></th><th aria-sort={detailSort.key === "market" ? detailSort.direction === "asc" ? "ascending" : "descending" : "none"}><button type="button" onClick={() => toggleDetailSort("market")}>Marché{sortMark("market")}</button></th><th aria-sort={detailSort.key === "step" ? detailSort.direction === "asc" ? "ascending" : "descending" : "none"}><button type="button" onClick={() => toggleDetailSort("step")}>Étape{sortMark("step")}</button></th></tr></thead><tbody>{detailPage.rows.map((item, index) => <tr key={`${item.taskId}:${item.specialty}:${item.date}:${index}`}><td>{new Date(`${item.date}T12:00:00`).toLocaleDateString("fr-FR")}</td><td>{item.analystName}</td><td><span className={`stats-kind ${item.specialty}`}>{item.specialty === "simulation" ? "Simulation" : "Contrôle"}</span></td><td><strong>{item.taskName}</strong></td><td className="supplier-turnover-cell" title={supplierTurnoverSource}>{formatSupplierTurnover(item.purchases12m)}</td><td>{item.marketIds.map((id) => markets.find((market) => market.id === id)?.name).filter(Boolean).join(" · ") || item.marketTags.join(" · ") || "Non rattaché"}</td><td>{item.stepLabel || "Étape non renseignée"}</td></tr>)}</tbody></table>{!stats.contributions.length && <div className="table-empty">Aucune activité ne correspond à ces filtres.</div>}</div><TablePagination {...detailPage} label="Pagination des activités analystes"/></section>
    </>}
  </main>;
}
