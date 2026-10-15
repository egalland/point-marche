"use client";

import { useId, useMemo, useState, type KeyboardEvent, type PointerEvent } from "react";
import { AppDialog } from "@/components/app-dialog";
import { SafeDateInput } from "@/components/safe-date-input";
import { TablePagination, useTablePage } from "@/components/table-pagination";
import { SupplierMiniChart } from "./supplier-mini-chart";
import { supplierMiniTrend } from "@/lib/supplier-mini-trend";
import { aggregateMonthlyVariations, averageVariation, buildSupplierVariations, variationColumnScale, type SupplierVariationPoint } from "@/lib/supplier-variations";
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

export function SupplierVariationChart({ points, compact = false }: { points: SupplierVariationPoint[]; compact?: boolean }) {
  return compact ? <SupplierMiniChart points={points}/> : <SupplierDetailChart points={points}/>;
}

function SupplierDetailChart({ points }: { points: SupplierVariationPoint[] }) {
  const helpId = useId();
  const [showGlobal, setShowGlobal] = useState(true);
  const [showWeighted, setShowWeighted] = useState(true);
  const [selection, setSelection] = useState<{ points: SupplierVariationPoint[]; index: number | null }>({ points, index: null });
  const activeIndex = points.length ? Math.max(0, Math.min(points.length - 1, selection.points === points ? selection.index ?? points.length - 1 : points.length - 1)) : null;
  const setActiveIndex = (index: number) => setSelection({ points, index });
  const series: { key: SeriesKey; label: string; css: string; visible: boolean }[] = [
    { key: "globalVariation", label: "GLOBAL", css: "global", visible: showGlobal },
    { key: "weightedVariation", label: "Pondérée", css: "weighted", visible: showWeighted },
  ].filter((item) => item.visible) as { key: SeriesKey; label: string; css: string; visible: boolean }[];
  const values = points.flatMap((point) => series.map((item) => point[item.key])).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const { min, max, ticks } = variationColumnScale(values);
  const width = Math.max(680, points.length * 92 + 76);
  const height = 340;
  const left = 58, right = 18, top = 34, bottom = 54;
  const slot = (width - left - right) / Math.max(1, points.length);
  const barWidth = Math.min(26, slot * .27);
  const x = (index: number) => left + slot * (index + .5);
  const y = (value: number) => top + (max - value) / (max - min) * (height - top - bottom);
  const active = activeIndex === null ? null : points[activeIndex];
  const pointer = (event: PointerEvent<SVGSVGElement>) => {
    if (!points.length) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - bounds.left) / bounds.width * width;
    setActiveIndex(Math.max(0, Math.min(points.length - 1, Math.floor((px - left) / slot))));
  };
  const handleKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    if (!points.length) return;
    const current = activeIndex ?? points.length - 1;
    const next = event.key === "ArrowLeft" ? Math.max(0, current - 1) : event.key === "ArrowRight" ? Math.min(points.length - 1, current + 1) : event.key === "Home" ? 0 : event.key === "End" ? points.length - 1 : null;
    if (next !== null) { event.preventDefault(); setActiveIndex(next); }
  };
  return <div className="supplier-line-chart supplier-column-chart">
    <div className="supplier-chart-toggles">
      <button type="button" className={showGlobal ? "active global" : ""} aria-pressed={showGlobal} onClick={() => setShowGlobal((current) => !current)}><i/>Variation GLOBAL</button>
      <button type="button" className={showWeighted ? "active weighted" : ""} aria-pressed={showWeighted} onClick={() => setShowWeighted((current) => !current)}><i/>Variation pondérée</button>
    </div>
    <p id={helpId} className="editor-hint">Colonnes côte à côte · ligne de référence à 0 %. Les mois sans données restent vides. Faites défiler le graphique si nécessaire ; les flèches du clavier permettent de parcourir les mois.</p>
    <div className="supplier-column-scroll">
      <div className="supplier-chart-stage" style={{ minWidth: width }}>
        <svg viewBox={`0 0 ${width} ${height}`} role="img" tabIndex={0} aria-describedby={helpId} aria-label={`Variations en colonnes${active ? ` · ${monthLabel(active.period)} · GLOBAL ${percent(active.globalVariation)} · Pondérée ${percent(active.weightedVariation)}` : ""}`} onKeyDown={handleKeyDown} onPointerMove={pointer} onPointerDown={pointer}>
          {ticks.map((value) => <g key={value}>
            <line x1={left} y1={y(value)} x2={width - right} y2={y(value)} className={value === 0 ? "supplier-chart-zero" : "supplier-chart-grid"}/>
            <text x={left - 8} y={y(value) + 4} textAnchor="end">{percent(Math.abs(value) < 1e-9 ? 0 : value)}</text>
          </g>)}
          {points.map((point, index) => <g key={`${point.taskId}-${index}`}>
            {activeIndex === index && <rect x={left + slot * index + 2} y={top} width={slot - 4} height={height - top - bottom} className="supplier-column-highlight"/>}
            {series.map((item, seriesIndex) => {
              const value = point[item.key];
              if (typeof value !== "number" || !Number.isFinite(value)) return null;
              const bx = x(index) + (seriesIndex - (series.length - 1) / 2) * (barWidth + 20) - barWidth / 2;
              return <g key={item.key}>
                <rect x={bx} y={value === 0 ? y(0) - .75 : Math.min(y(value), y(0))} width={barWidth} height={value === 0 ? 1.5 : Math.abs(y(value) - y(0))} rx={2} className={`supplier-chart-bar ${item.css}`}><title>{`${monthLabel(point.period)} · ${item.label} : ${percent(value)}`}</title></rect>
                <text x={bx + barWidth / 2} y={value >= 0 ? y(value) - 8 : y(value) + 16} textAnchor="middle" className={`supplier-column-value ${item.css}`}>{percent(value)}</text>
              </g>;
            })}
            <text x={x(index)} y={height - 23} textAnchor="middle">{monthLabel(point.period)}</text>
            {series.length > 0 && !series.some((item) => typeof point[item.key] === "number" && Number.isFinite(point[item.key])) && <text x={x(index)} y={height - 7} textAnchor="middle" className="supplier-column-missing">Non renseigné</text>}
          </g>)}
        </svg>
      </div>
    </div>
    {active && <div className="supplier-chart-tooltip supplier-column-summary" aria-live="polite"><strong>{monthLabel(active.period)}</strong>{series.map((item) => <span key={item.key}><i className={item.css}/>{item.label}<b>{percent(active[item.key])}</b></span>)}{active.purchases12m !== undefined && <span className="supplier-chart-turnover" title={supplierTurnoverSource}>CA · 12 mG <b>{formatSupplierTurnover(active.purchases12m)}</b></span>}</div>}
    {!values.length && <p className="editor-hint" role="status">{series.length ? "Aucune variation exploitable sur cette période." : "Active une série pour afficher ses variations."}</p>}
  </div>;
}

export function SupplierSparkline({ points, label }: { points: SupplierVariationPoint[]; label: string }) {
  const [open, setOpen] = useState(false);
  const dialogId = useId();
  const last = points.at(-1);
  const trend = supplierMiniTrend(points);
  const change = trend.delta === null ? `${points.length} observation${points.length > 1 ? "s" : ""}` : `${trend.delta > 0 ? "+" : ""}${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(trend.delta)} pt${Math.abs(trend.delta) > 1 ? "s" : ""} vs ${monthLabel(trend.previousPeriod)}`;
  if (!points.length) return null;
  return <>
    <button type="button" className="supplier-sparkline" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open} aria-label={`${label} · Variation ${trend.label} ${percent(trend.value)}. Ouvrir l’historique fournisseur.`}>
      <span className="supplier-mini-summary"><span>Variation {trend.label}</span><strong>{percent(trend.value)}</strong><small>{change}</small></span>
      <SupplierMiniChart points={points}/><span className="supplier-mini-open" aria-hidden="true">↗</span>
    </button>
    {open && <AppDialog open onClose={() => setOpen(false)} labelledBy={dialogId} className="supplier-variation-dialog"><div className="supplier-dialog-heading"><span>Historique fournisseur</span><h2 id={dialogId}>{label}</h2><p>{last?.supplierCode ? `Code ${last.supplierCode} · ` : ""}{points.length} observation{points.length > 1 ? "s" : ""}. Survole ou touche les colonnes pour lire les valeurs.</p></div><SupplierVariationChart points={points}/><div className="supplier-dialog-stats"><article><span>Dernière GLOBAL</span><strong>{percent(last?.globalVariation ?? null)}</strong></article><article><span>Dernière pondérée</span><strong>{percent(last?.weightedVariation ?? null)}</strong></article><article><span>Moyenne GLOBAL</span><strong>{percent(averageVariation(points, "globalVariation"))}</strong></article><article><span>Moyenne pondérée</span><strong>{percent(averageVariation(points, "weightedVariation"))}</strong></article></div></AppDialog>}
  </>;
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
  const series = useMemo(() => aggregateMonthlyVariations(filtered, from, to), [filtered, from, to]);
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
    <div className="surface supplier-dashboard-filters"><div className="stats-period-presets"><span>Période rapide</span><div><button type="button" onClick={() => applyPreset(1)}>1 mois</button><button type="button" onClick={() => applyPreset(3)}>3 mois</button><button type="button" onClick={() => applyPreset(6)}>6 mois</button><button type="button" onClick={() => applyPreset(12)} title="Les 12 derniers mois, mois en cours inclus, à partir de la date du jour">Année glissante</button><button type="button" onClick={() => applyPreset("year")}>Cette année</button></div></div><label><span>Du</span><SafeDateInput value={from} onCommit={setFrom} max={to}/></label><label><span>Au</span><SafeDateInput value={to} onCommit={setTo} min={from}/></label><label><span>Marché</span><select value={marketId} onChange={(event) => setMarketId(event.target.value)}><option value="all">Tous les marchés</option>{markets.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label><span>Fournisseur</span><select value={supplierKey} onChange={(event) => setSupplierKey(event.target.value)}><option value="all">Tous les fournisseurs</option>{suppliers.map((item) => <option value={item.key} key={item.key}>{item.label}{item.code ? ` · ${item.code}` : ""}</option>)}</select></label></div>
    <div className="stats-kpis supplier-kpis"><article><span>Observations</span><strong>{filtered.length}</strong><small>{new Set(filtered.map((point) => point.supplierKey)).size} fournisseur{new Set(filtered.map((point) => point.supplierKey)).size > 1 ? "s" : ""}</small></article><article><span>Moyenne GLOBAL</span><strong>{percent(averageVariation(filtered, "globalVariation"))}</strong><small>Valeurs renseignées uniquement</small></article><article><span>Moyenne pondérée</span><strong>{percent(averageVariation(filtered, "weightedVariation"))}</strong><small>Valeurs renseignées uniquement</small></article><article><span>Données doubles</span><strong>{filtered.filter((point) => point.globalVariation !== null && point.weightedVariation !== null).length}</strong><small>GLOBAL et pondérée disponibles</small></article></div>
    <article className="surface supplier-overall-chart"><header><div><span>Lecture consolidée</span><strong>Variation moyenne par mois</strong></div><p>Chaque paire de colonnes compare les moyennes GLOBAL et pondérée des fournisseurs visibles. Les valeurs absentes restent non renseignées.</p></header><SupplierVariationChart points={series}/></article>
    <article className="surface stats-detail supplier-detail"><header><div><span>Détail fournisseur</span><strong>{rows.length} observation{rows.length > 1 ? "s" : ""}</strong></div><small>Clique sur une ligne pour ouvrir son historique.</small></header><div className="data-table-wrap"><table><thead><tr><th aria-sort={sort.key === "period" ? sort.direction === "asc" ? "ascending" : "descending" : "none"}><button type="button" onClick={() => toggleSort("period")}>Mois{mark("period")}</button></th><th aria-sort={sort.key === "supplier" ? sort.direction === "asc" ? "ascending" : "descending" : "none"}><button type="button" onClick={() => toggleSort("supplier")}>Fournisseur{mark("supplier")}</button></th><th>Code</th><th className="supplier-turnover-cell" title={supplierTurnoverSource} aria-sort={sort.key === "ca" ? sort.direction === "asc" ? "ascending" : "descending" : "none"}><button type="button" onClick={() => toggleSort("ca")}>{supplierTurnoverLabel}{mark("ca")}</button></th><th aria-sort={sort.key === "global" ? sort.direction === "asc" ? "ascending" : "descending" : "none"}><button type="button" onClick={() => toggleSort("global")}>GLOBAL{mark("global")}</button></th><th aria-sort={sort.key === "weighted" ? sort.direction === "asc" ? "ascending" : "descending" : "none"}><button type="button" onClick={() => toggleSort("weighted")}>Pondérée{mark("weighted")}</button></th><th aria-sort={sort.key === "delta" ? sort.direction === "asc" ? "ascending" : "descending" : "none"}><button type="button" onClick={() => toggleSort("delta")}>Écart précédent{mark("delta")}</button></th><th>Marchés / tags</th></tr></thead><tbody>{detailPage.rows.map(({ point, delta }) => <tr key={point.taskId} onClick={() => setSelected(allPoints.filter((candidate) => candidate.supplierKey === point.supplierKey))}><td>{monthLabel(point.period)}</td><td><button type="button" className="table-link" aria-haspopup="dialog" aria-label={`Voir l’historique de ${point.supplierLabel}`} onClick={(event) => { event.stopPropagation(); setSelected(allPoints.filter((candidate) => candidate.supplierKey === point.supplierKey)); }}>{point.supplierLabel}</button></td><td>{point.supplierCode || "—"}</td><td className="supplier-turnover-cell" title={supplierTurnoverSource}>{formatSupplierTurnover(point.purchases12m)}</td><td>{percent(point.globalVariation)}</td><td>{percent(point.weightedVariation)}</td><td className={delta !== null && delta > 0 ? "variation-up" : delta !== null && delta < 0 ? "variation-down" : ""}>{delta === null ? "—" : `${delta > 0 ? "+" : ""}${percent(delta)}`}</td><td>{point.labels.join(" · ") || "Non rattaché"}</td></tr>)}</tbody></table>{!rows.length && <div className="table-empty">Aucune variation ne correspond à ces filtres.</div>}</div><TablePagination {...detailPage} label="Pagination des variations fournisseurs"/></article>
    {selected && <AppDialog open onClose={() => setSelected(null)} labelledBy="supplier-dashboard-dialog-title" className="supplier-variation-dialog"><div className="supplier-dialog-heading"><span>Historique fournisseur</span><h2 id="supplier-dashboard-dialog-title">{selected[0]?.supplierLabel}</h2><p>{selected[0]?.supplierCode ? `Code ${selected[0].supplierCode} · ` : ""}{selected.length} observation{selected.length > 1 ? "s" : ""}</p></div><SupplierVariationChart points={selected}/></AppDialog>}
  </section>;
}
