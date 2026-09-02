"use client";

import { useId, useMemo, useState, type KeyboardEvent, type PointerEvent } from "react";
import { AppDialog } from "@/components/app-dialog";
import { SafeDateInput } from "@/components/safe-date-input";
import { TablePagination, useTablePage } from "@/components/table-pagination";
import { averageVariation, buildSupplierVariations, type SupplierVariationPoint } from "@/lib/supplier-variations";
import type { PlannerTask } from "@/lib/planner-import";
import type { PlannerRegistrySummary } from "@/lib/planner-registry";
import { compareSupplierTurnover, formatSupplierTurnover, supplierTurnoverLabel, supplierTurnoverSource } from "@/lib/supplier-turnover";

type Market = { id: string; name: string; plannerTags: string[] };
type SeriesKey = "globalVariation" | "weightedVariation";

function percent(value: number | null) {
  return value === null ? "—" : `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(value)} %`;
}

function monthLabel(period: string) {
  const date = new Date(`${period}-01T12:00:00Z`);
  return new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit", timeZone: "UTC" }).format(date).replace(".", "");
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function monthsAgo(amount: number) {
  const date = new Date();
  date.setUTCMonth(date.getUTCMonth() - amount, 1);
  return date.toISOString().slice(0, 10);
}

function pathSegments(points: SupplierVariationPoint[], key: SeriesKey, x: (index: number) => number, y: (value: number) => number) {
  const segments: string[] = [];
  let current: string[] = [];
  points.forEach((point, index) => {
    const value = point[key];
    if (value === null) {
      if (current.length) segments.push(current.join(" "));
      current = [];
      return;
    }
    current.push(`${current.length ? "L" : "M"} ${x(index)} ${y(value)}`);
  });
  if (current.length) segments.push(current.join(" "));
  return segments;
}

export function SupplierVariationChart({ points, compact = false }: { points: SupplierVariationPoint[]; compact?: boolean }) {
  const helpId = useId();
  const [showGlobal, setShowGlobal] = useState(true);
  const [showWeighted, setShowWeighted] = useState(true);
  const [selection, setSelection] = useState<{ points: SupplierVariationPoint[]; index: number | null }>({ points, index: null });
  const activeIndex = points.length ? Math.max(0, Math.min(points.length - 1, selection.points === points ? selection.index ?? points.length - 1 : points.length - 1)) : null;
  const setActiveIndex = (index: number | null) => setSelection({ points, index });
  const width = compact ? 460 : 760;
  const height = compact ? 180 : 300;
  const padding = compact ? 26 : 58;
  const values = points.flatMap((point) => [showGlobal ? point.globalVariation : null, showWeighted ? point.weightedVariation : null]).filter((value): value is number => value !== null);
  const rawMin = values.length ? Math.min(...values) : 0;
  const rawMax = values.length ? Math.max(...values) : 1;
  const span = Math.max(1, rawMax - rawMin);
  const min = rawMin - span * .18;
  const max = rawMax + span * .18;
  const x = (index: number) => padding + (points.length <= 1 ? (width - padding * 2) / 2 : index / (points.length - 1) * (width - padding * 2));
  const y = (value: number) => height - padding - (value - min) / Math.max(.01, max - min) * (height - padding * 2);
  const pointer = (event: PointerEvent<SVGSVGElement>) => {
    if (!points.length) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - bounds.left) / bounds.width * width;
    const index = points.length <= 1 ? 0 : Math.round((px - padding) / (width - padding * 2) * (points.length - 1));
    setActiveIndex(Math.max(0, Math.min(points.length - 1, index)));
  };
  const active = activeIndex === null ? null : points[activeIndex];
  const handleKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    if (compact || !points.length) return;
    const current = activeIndex ?? points.length - 1;
    const next = event.key === "ArrowLeft" ? Math.max(0, current - 1) : event.key === "ArrowRight" ? Math.min(points.length - 1, current + 1) : event.key === "Home" ? 0 : event.key === "End" ? points.length - 1 : null;
    if (next !== null) { event.preventDefault(); setActiveIndex(next); }
  };
  const monthIndexes = points.flatMap((point, index) => !index || point.period !== points[index - 1].period ? [index] : []);
  const labelStride = Math.max(1, Math.ceil(monthIndexes.length / 6));
  const labelledIndexes = new Set(monthIndexes.filter((_, index) => index % labelStride === 0 || index === monthIndexes.length - 1));
  const globalPaths = pathSegments(points, "globalVariation", x, y);
  const weightedPaths = pathSegments(points, "weightedVariation", x, y);
  return <div className={`supplier-line-chart ${compact ? "compact" : ""}`}>
    {!compact && <div className="supplier-chart-toggles"><button type="button" className={showGlobal ? "active global" : ""} aria-pressed={showGlobal} onClick={() => setShowGlobal((current) => !current)}><i/>Variation GLOBAL</button><button type="button" className={showWeighted ? "active weighted" : ""} aria-pressed={showWeighted} onClick={() => setShowWeighted((current) => !current)}><i/>Variation pondérée</button></div>}
    {!compact && <p className="sr-only" id={helpId}>Utilise les flèches gauche et droite pour parcourir les observations ; Début et Fin pour rejoindre les extrémités.</p>}
    <div className="supplier-chart-stage">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" tabIndex={compact ? undefined : 0} aria-describedby={compact ? undefined : helpId} aria-label={`Évolution des variations fournisseur${!compact && active ? ` · ${monthLabel(active.period)} · GLOBAL ${percent(active.globalVariation)} · Pondérée ${percent(active.weightedVariation)}` : ""}`} onKeyDown={handleKeyDown} onPointerMove={pointer} onPointerLeave={() => setActiveIndex(null)}>
        {[0, .25, .5, .75, 1].map((ratio) => { const value = max - (max - min) * ratio; const position = padding + (height - padding * 2) * ratio; return <g key={ratio}><line x1={padding} y1={position} x2={width - padding} y2={position} className="supplier-chart-grid"/>{!compact && <text x={padding - 7} y={position + 4} textAnchor="end">{percent(value)}</text>}</g>; })}
        {showGlobal && globalPaths.map((path, index) => <path key={`global-${index}`} d={path} className="supplier-chart-line global"/>)}
        {showWeighted && weightedPaths.map((path, index) => <path key={`weighted-${index}`} d={path} className="supplier-chart-line weighted"/>)}
        {points.map((point, index) => <g key={`${point.taskId}-${index}`}>
          {showGlobal && point.globalVariation !== null && <circle cx={x(index)} cy={y(point.globalVariation)} r={activeIndex === index ? 5 : 3} className="supplier-chart-dot global"/>}
          {showWeighted && point.weightedVariation !== null && <circle cx={x(index)} cy={y(point.weightedVariation)} r={activeIndex === index ? 5 : 3} className="supplier-chart-dot weighted"/>}
          {!compact && labelledIndexes.has(index) && <text x={x(index)} y={height - 10} textAnchor="middle">{monthLabel(point.period)}</text>}
        </g>)}
        {active && <line x1={x(activeIndex ?? 0)} y1={padding} x2={x(activeIndex ?? 0)} y2={height - padding} className="supplier-chart-cursor"/>}
      </svg>
      {active && !compact && <div className="supplier-chart-tooltip" style={{ left: `${Math.max(18, Math.min(82, x(activeIndex ?? 0) / width * 100))}%` }}><strong>{monthLabel(active.period)}</strong><span><i className="global"/>GLOBAL <b>{percent(active.globalVariation)}</b></span><span><i className="weighted"/>Pondérée <b>{percent(active.weightedVariation)}</b></span>{active.purchases12m !== undefined && <span className="supplier-chart-turnover" title={supplierTurnoverSource}>CA · 12 mG <b>{formatSupplierTurnover(active.purchases12m)}</b></span>}</div>}
      {!points.length && <div className="supplier-chart-empty">Aucune variation exploitable.</div>}
    </div>
  </div>;
}

export function SupplierSparkline({ points, label }: { points: SupplierVariationPoint[]; label: string }) {
  const [open, setOpen] = useState(false);
  const last = points.at(-1);
  const previous = points.at(-2);
  const delta = last?.globalVariation !== null && last?.globalVariation !== undefined && previous?.globalVariation !== null && previous?.globalVariation !== undefined ? last.globalVariation - previous.globalVariation : null;
  if (!points.length) return null;
  return <>
    <button type="button" className="supplier-sparkline" onClick={() => setOpen(true)} aria-haspopup="dialog"><div><span>Variation fournisseur</span><strong>{percent(last?.globalVariation ?? null)}</strong><small>{delta === null ? `${points.length} observation${points.length > 1 ? "s" : ""}` : `${delta > 0 ? "+" : ""}${percent(delta)} vs précédente`}</small></div><SupplierVariationChart points={points} compact/><b>Ouvrir ↗</b></button>
    <AppDialog open={open} onClose={() => setOpen(false)} labelledBy={`supplier-dialog-${last?.taskId ?? "series"}`} className="supplier-variation-dialog"><div className="supplier-dialog-heading"><span>Historique fournisseur</span><h2 id={`supplier-dialog-${last?.taskId ?? "series"}`}>{label}</h2><p>{last?.supplierCode ? `Code ${last.supplierCode} · ` : ""}{points.length} observation{points.length > 1 ? "s" : ""}. Survole la courbe pour lire les valeurs.</p></div><SupplierVariationChart points={points}/><div className="supplier-dialog-stats"><article><span>Dernière GLOBAL</span><strong>{percent(last?.globalVariation ?? null)}</strong></article><article><span>Dernière pondérée</span><strong>{percent(last?.weightedVariation ?? null)}</strong></article><article><span>Moyenne GLOBAL</span><strong>{percent(averageVariation(points, "globalVariation"))}</strong></article><article><span>Moyenne pondérée</span><strong>{percent(averageVariation(points, "weightedVariation"))}</strong></article></div></AppDialog>
  </>;
}

function aggregateMonthly(points: SupplierVariationPoint[]) {
  const periods = Array.from(new Set(points.map((point) => point.period))).sort();
  return periods.map((period) => {
    const rows = points.filter((point) => point.period === period);
    return {
      taskId: `average:${period}`,
      taskName: "Moyenne de la sélection",
      supplierKey: "selection-average",
      supplierLabel: "Moyenne de la sélection",
      supplierCode: "",
      period,
      globalVariation: averageVariation(rows, "globalVariation"),
      weightedVariation: averageVariation(rows, "weightedVariation"),
      labels: [],
    } satisfies SupplierVariationPoint;
  });
}

export function SupplierVariationDashboard({ tasks, markets, registry }: { tasks: PlannerTask[]; markets: Market[]; registry: PlannerRegistrySummary }) {
  const allPoints = useMemo(() => buildSupplierVariations(tasks), [tasks]);
  const [from, setFrom] = useState(() => monthsAgo(5));
  const [to, setTo] = useState(today);
  const [marketId, setMarketId] = useState("all");
  const [supplierKey, setSupplierKey] = useState("all");
  const [selected, setSelected] = useState<SupplierVariationPoint[] | null>(null);
  const [sort, setSort] = useState<{ key: "period" | "supplier" | "ca" | "global" | "weighted" | "delta"; direction: "asc" | "desc" }>({ key: "period", direction: "desc" });
  const market = markets.find((item) => item.id === marketId);
  const filtered = useMemo(() => allPoints.filter((point) => {
    if (point.period < from.slice(0, 7) || point.period > to.slice(0, 7)) return false;
    if (market && !market.plannerTags.some((tag) => point.labels.includes(tag.toUpperCase()))) return false;
    return supplierKey === "all" || point.supplierKey === supplierKey;
  }), [allPoints, from, market, supplierKey, to]);
  const suppliers = useMemo(() => Array.from(new Map(allPoints.map((point) => [point.supplierKey, { key: point.supplierKey, label: point.supplierLabel, code: point.supplierCode }])).values()).sort((left, right) => left.label.localeCompare(right.label, "fr")), [allPoints]);
  const series = useMemo(() => aggregateMonthly(filtered), [filtered]);
  const rows = useMemo(() => filtered.map((point) => {
    const previous = allPoints.filter((candidate) => candidate.supplierKey === point.supplierKey && candidate.period < point.period && candidate.globalVariation !== null).at(-1);
    return { point, delta: point.globalVariation !== null && previous?.globalVariation !== null && previous?.globalVariation !== undefined ? point.globalVariation - previous.globalVariation : null };
  }).sort((left, right) => {
    if (sort.key === "ca") return compareSupplierTurnover(left.point.purchases12m, right.point.purchases12m, sort.direction);
    const value = (row: typeof left) => sort.key === "period" ? row.point.period : sort.key === "supplier" ? row.point.supplierLabel : sort.key === "global" ? row.point.globalVariation ?? Number.NEGATIVE_INFINITY : sort.key === "weighted" ? row.point.weightedVariation ?? Number.NEGATIVE_INFINITY : row.delta ?? Number.NEGATIVE_INFINITY;
    const leftValue = value(left); const rightValue = value(right);
    const compared = typeof leftValue === "number" && typeof rightValue === "number" ? leftValue - rightValue : String(leftValue).localeCompare(String(rightValue), "fr", { numeric: true });
    return sort.direction === "asc" ? compared : -compared;
  }), [allPoints, filtered, sort]);
  const detailPage = useTablePage(rows, JSON.stringify([from, to, marketId, supplierKey, sort]));
  const applyPreset = (months: number | "year") => { setFrom(months === "year" ? `${new Date().getUTCFullYear()}-01-01` : monthsAgo(months - 1)); setTo(today()); };
  const toggleSort = (key: typeof sort.key) => setSort((current) => ({ key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc" }));
  const mark = (key: typeof sort.key) => sort.key === key ? sort.direction === "asc" ? " ↑" : " ↓" : "";
  return <section className="supplier-dashboard">
    <div className="surface supplier-source-note"><div><span>Source Planner consolidée</span><strong>Un seul registre pour les points et les statistiques</strong><small>Les simulations conservées dans les points marché complètent automatiquement l’import Planner, sans doublon grâce à l’ID de tâche.</small></div><div><span><b>{registry.imported}</b> importées</span><span className={registry.recovered ? "recovered" : ""}><b>{registry.recovered}</b> récupérées des points</span><span><b>{registry.usableVariations}</b> variations exploitables</span>{registry.enriched > 0 && <span className="recovered"><b>{registry.enriched}</b> complétées</span>}{registry.withoutVariation > 0 && <span className="muted"><b>{registry.withoutVariation}</b> sans variation</span>}{registry.withoutMonth > 0 && <span className="warning"><b>{registry.withoutMonth}</b> sans mois reconnu</span>}</div></div>
    <div className="surface supplier-dashboard-filters"><div className="stats-period-presets"><span>Période rapide</span><div><button type="button" onClick={() => applyPreset(1)}>1 mois</button><button type="button" onClick={() => applyPreset(3)}>3 mois</button><button type="button" onClick={() => applyPreset(6)}>6 mois</button><button type="button" onClick={() => applyPreset("year")}>Cette année</button></div></div><label><span>Du</span><SafeDateInput value={from} onCommit={setFrom} max={to}/></label><label><span>Au</span><SafeDateInput value={to} onCommit={setTo} min={from}/></label><label><span>Marché</span><select value={marketId} onChange={(event) => setMarketId(event.target.value)}><option value="all">Tous les marchés</option>{markets.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label><span>Fournisseur</span><select value={supplierKey} onChange={(event) => setSupplierKey(event.target.value)}><option value="all">Tous les fournisseurs</option>{suppliers.map((item) => <option value={item.key} key={item.key}>{item.label}{item.code ? ` · ${item.code}` : ""}</option>)}</select></label></div>
    <div className="stats-kpis supplier-kpis"><article><span>Observations</span><strong>{filtered.length}</strong><small>{new Set(filtered.map((point) => point.supplierKey)).size} fournisseur{new Set(filtered.map((point) => point.supplierKey)).size > 1 ? "s" : ""}</small></article><article><span>Moyenne GLOBAL</span><strong>{percent(averageVariation(filtered, "globalVariation"))}</strong><small>Valeurs renseignées uniquement</small></article><article><span>Moyenne pondérée</span><strong>{percent(averageVariation(filtered, "weightedVariation"))}</strong><small>Valeurs renseignées uniquement</small></article><article><span>Données doubles</span><strong>{filtered.filter((point) => point.globalVariation !== null && point.weightedVariation !== null).length}</strong><small>GLOBAL et pondérée disponibles</small></article></div>
    <article className="surface supplier-overall-chart"><header><div><span>Lecture consolidée</span><strong>Variation moyenne par mois</strong></div><p>Chaque point est la moyenne des fournisseurs visibles. Les valeurs absentes ne sont jamais remplacées par zéro.</p></header><SupplierVariationChart points={series}/></article>
    <article className="surface stats-detail supplier-detail"><header><div><span>Détail fournisseur</span><strong>{rows.length} observation{rows.length > 1 ? "s" : ""}</strong></div><small>Clique sur une ligne pour ouvrir son historique.</small></header><div className="data-table-wrap"><table><thead><tr><th aria-sort={sort.key === "period" ? sort.direction === "asc" ? "ascending" : "descending" : "none"}><button type="button" onClick={() => toggleSort("period")}>Mois{mark("period")}</button></th><th aria-sort={sort.key === "supplier" ? sort.direction === "asc" ? "ascending" : "descending" : "none"}><button type="button" onClick={() => toggleSort("supplier")}>Fournisseur{mark("supplier")}</button></th><th>Code</th><th className="supplier-turnover-cell" title={supplierTurnoverSource} aria-sort={sort.key === "ca" ? sort.direction === "asc" ? "ascending" : "descending" : "none"}><button type="button" onClick={() => toggleSort("ca")}>{supplierTurnoverLabel}{mark("ca")}</button></th><th aria-sort={sort.key === "global" ? sort.direction === "asc" ? "ascending" : "descending" : "none"}><button type="button" onClick={() => toggleSort("global")}>GLOBAL{mark("global")}</button></th><th aria-sort={sort.key === "weighted" ? sort.direction === "asc" ? "ascending" : "descending" : "none"}><button type="button" onClick={() => toggleSort("weighted")}>Pondérée{mark("weighted")}</button></th><th aria-sort={sort.key === "delta" ? sort.direction === "asc" ? "ascending" : "descending" : "none"}><button type="button" onClick={() => toggleSort("delta")}>Écart précédent{mark("delta")}</button></th><th>Marchés / tags</th></tr></thead><tbody>{detailPage.rows.map(({ point, delta }) => <tr key={point.taskId} onClick={() => setSelected(allPoints.filter((candidate) => candidate.supplierKey === point.supplierKey))}><td>{monthLabel(point.period)}</td><td><button type="button" className="table-link" aria-haspopup="dialog" aria-label={`Voir l’historique de ${point.supplierLabel}`} onClick={(event) => { event.stopPropagation(); setSelected(allPoints.filter((candidate) => candidate.supplierKey === point.supplierKey)); }}>{point.supplierLabel}</button></td><td>{point.supplierCode || "—"}</td><td className="supplier-turnover-cell" title={supplierTurnoverSource}>{formatSupplierTurnover(point.purchases12m)}</td><td>{percent(point.globalVariation)}</td><td>{percent(point.weightedVariation)}</td><td className={delta !== null && delta > 0 ? "variation-up" : delta !== null && delta < 0 ? "variation-down" : ""}>{delta === null ? "—" : `${delta > 0 ? "+" : ""}${percent(delta)}`}</td><td>{point.labels.join(" · ") || "Non rattaché"}</td></tr>)}</tbody></table>{!rows.length && <div className="table-empty">Aucune variation ne correspond à ces filtres.</div>}</div><TablePagination {...detailPage} label="Pagination des variations fournisseurs"/></article>
    {selected && <AppDialog open onClose={() => setSelected(null)} labelledBy="supplier-dashboard-dialog-title" className="supplier-variation-dialog"><div className="supplier-dialog-heading"><span>Historique fournisseur</span><h2 id="supplier-dashboard-dialog-title">{selected[0]?.supplierLabel}</h2><p>{selected[0]?.supplierCode ? `Code ${selected[0].supplierCode} · ` : ""}{selected.length} observation{selected.length > 1 ? "s" : ""}</p></div><SupplierVariationChart points={selected}/></AppDialog>}
  </section>;
}
