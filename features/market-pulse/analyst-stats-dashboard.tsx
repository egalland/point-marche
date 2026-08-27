"use client";

import { useMemo, useState } from "react";
import { buildAnalystStats, type AnalystStatsMarket } from "@/lib/analyst-stats";
import type { GlobalDirectoryUser } from "@/lib/global-directory";
import type { PlannerSpecialty, PlannerTask } from "@/lib/planner-import";

type Props = {
  tasks: PlannerTask[];
  users: GlobalDirectoryUser[];
  markets: AnalystStatsMarket[];
  updatedAt: string;
};

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

function percent(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 0 }).format(value);
}

function movementLabel(value: number | null) {
  if (value === null) return "Nouvelle activité sur la période";
  if (!value) return "Stable vs période précédente";
  return `${value > 0 ? "+" : ""}${new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 0 }).format(value)} vs période précédente`;
}

export function AnalystStatsDashboard({ tasks, users, markets, updatedAt }: Props) {
  const analysts = useMemo(() => users.filter((user) => user.role === "analyste-tarif-referentiel").sort((left, right) => left.name.localeCompare(right.name, "fr")), [users]);
  const [from, setFrom] = useState(() => monthsAgo(5));
  const [to, setTo] = useState(today);
  const [marketId, setMarketId] = useState("all");
  const [specialty, setSpecialty] = useState<PlannerSpecialty | "all">("all");
  const [analystIds, setAnalystIds] = useState<string[]>([]);
  const stats = useMemo(() => buildAnalystStats(tasks, users, markets, { from, to, marketId, specialty, analystIds }), [analystIds, from, marketId, markets, specialty, tasks, to, users]);
  const maxMonth = Math.max(1, ...stats.monthly.map((item) => item.total));
  const maxAnalyst = Math.max(1, ...stats.byAnalyst.map((item) => item.total));
  const selectAnalyst = (id: string) => setAnalystIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const applyPeriod = (period: "30d" | "3m" | "6m" | "year") => {
    setTo(today());
    setFrom(period === "30d" ? daysAgo(29) : period === "3m" ? monthsAgo(2) : period === "6m" ? monthsAgo(5) : `${new Date().getUTCFullYear()}-01-01`);
  };

  return <main className="analyst-stats-page">
    <header className="stats-hero">
      <div><span>Activité tarif et référentiel</span><h1>Statistiques analystes</h1><p>Lecture descriptive des simulations et contrôles identifiés dans l’export Planner, sans objectif individuel.</p></div>
      <div className="stats-freshness"><span>Dernier import</span><strong>{updatedAt ? new Date(updatedAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "Aucun import"}</strong><small>{tasks.length} tâche{tasks.length > 1 ? "s" : ""} Planner disponible{tasks.length > 1 ? "s" : ""}</small></div>
    </header>

    <section className="surface stats-filters" aria-label="Filtres des statistiques">
      <div className="stats-period-presets"><span>Période rapide</span><div><button type="button" onClick={() => applyPeriod("30d")}>30 jours</button><button type="button" onClick={() => applyPeriod("3m")}>3 mois</button><button type="button" onClick={() => applyPeriod("6m")}>6 mois</button><button type="button" onClick={() => applyPeriod("year")}>Cette année</button></div></div>
      <label><span>Du</span><input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)}/></label>
      <label><span>Au</span><input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)}/></label>
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

    <section className="stats-grid">
      <article className="surface stats-panel stats-trend"><header><span>Évolution du volume</span><strong>Simulation et contrôle par mois</strong></header><div className="stats-month-chart">{stats.monthly.map((item) => <div className="stats-month" key={item.period}><div className="stats-month-column" title={`${item.label} · ${item.total} activité${item.total > 1 ? "s" : ""}`}><i className="control" style={{ height: `${item.controls / maxMonth * 100}%` }}/><i className="simulation" style={{ height: `${item.simulations / maxMonth * 100}%` }}/></div><b>{item.total}</b><span>{item.label}</span></div>)}</div><footer><span><i className="simulation"/> Simulation</span><span><i className="control"/> Contrôle</span></footer></article>
      <article className="surface stats-panel stats-breakdown"><header><span>Répartition</span><strong>Volume par analyste sélectionné</strong></header><div>{stats.byAnalyst.length ? stats.byAnalyst.map((item) => <div className="stats-analyst-row" key={item.id}><span>{item.name}</span><div><i className="simulation" style={{ width: `${item.simulations / maxAnalyst * 100}%` }}/><i className="control" style={{ width: `${item.controls / maxAnalyst * 100}%` }}/></div><b>{item.total}</b></div>) : <p>Aucune activité pour cette sélection.</p>}</div></article>
    </section>

    {stats.unmatchedNames.length > 0 && <section className="stats-quality-note"><strong>Noms non rapprochés de l’annuaire</strong><span>{stats.unmatchedNames.join(" · ")}. Les anciennes simulations restent comptées dans le total, sans provoquer d’erreur.</span></section>}

    <section className="surface stats-detail"><header><div><span>Détail vérifiable</span><strong>{stats.contributions.length} activité{stats.contributions.length > 1 ? "s" : ""} dans la sélection</strong></div></header><div className="data-table-wrap"><table><thead><tr><th>Date</th><th>Analyste</th><th>Spécialité</th><th>Simulation</th><th>Marché</th><th>Étape</th></tr></thead><tbody>{stats.contributions.slice().sort((left, right) => right.date.localeCompare(left.date)).map((item, index) => <tr key={`${item.taskId}:${item.specialty}:${item.date}:${index}`}><td>{new Date(`${item.date}T12:00:00`).toLocaleDateString("fr-FR")}</td><td>{item.analystName}</td><td><span className={`stats-kind ${item.specialty}`}>{item.specialty === "simulation" ? "Simulation" : "Contrôle"}</span></td><td><strong>{item.taskName}</strong></td><td>{item.marketIds.map((id) => markets.find((market) => market.id === id)?.name).filter(Boolean).join(" · ") || item.marketTags.join(" · ") || "Non rattaché"}</td><td>{item.stepLabel || "Étape non renseignée"}</td></tr>)}</tbody></table>{!stats.contributions.length && <div className="table-empty">Aucune activité ne correspond à ces filtres.</div>}</div></section>
  </main>;
}
