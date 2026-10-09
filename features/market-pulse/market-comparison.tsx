"use client";

import { useState, type PointerEvent as ReactPointerEvent } from "react";
import { comparisonSlices, comparisonTotals, type MarketComparison as Snapshot } from "@/lib/market-comparison";

export function MarketComparisonChart({ snapshot, loading = false }: { snapshot: Snapshot | null; loading?: boolean }) {
  const [active, setActive] = useState<{ marketId: string; x: number; y: number } | null>(null);
  if (loading && !snapshot) return <div className="report-empty" role="status">Chargement des marchés…</div>;
  if (!snapshot) return <div className="report-empty">Actualise la comparaison pour afficher les tickets ouverts par marché.</div>;
  const { total, missing, available } = comparisonTotals(snapshot.rows);
  const slices = comparisonSlices(snapshot.rows);
  const activeSlice = active ? slices.find((slice) => slice.marketId === active.marketId) : undefined;
  const pointSlice = (event: ReactPointerEvent<SVGPathElement>, marketId: string) => {
    const bounds = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
    setActive({ marketId, x: bounds ? event.clientX - bounds.left : 120, y: bounds ? event.clientY - bounds.top : 100 });
  };
  return <section className="report-focus market-comparison-card" aria-label="Comparaison des marchés">
    <div className="report-heading"><div><small>Répartition par marché</small><h2>Tickets Jira ouverts</h2></div><span className="report-pill">{snapshot.year} · S{String(snapshot.week).padStart(2, "0")}</span></div>
    <p className="comparison-caption">Dernier import ou saisie manuelle de chaque marché. Le volume ne mesure pas la difficulté des tickets.</p>
    <div className="market-comparison-grid">
      <figure><svg viewBox="0 0 240 240" role="img" aria-label={`${total} tickets ouverts sur ${available} marchés renseignés`} onPointerLeave={() => setActive(null)}>
        {slices.length ? slices.map((slice) => <path key={slice.marketId} className={active?.marketId === slice.marketId ? "is-active" : active ? "is-muted" : ""} d={slice.path} fill={slice.color} stroke="var(--surface, #fff)" strokeWidth="2" tabIndex={0} aria-label={`${slice.label} : ${slice.count} tickets, ${slice.percent.toFixed(1)} %`} onPointerEnter={(event) => pointSlice(event, slice.marketId)} onPointerMove={(event) => pointSlice(event, slice.marketId)} onFocus={() => setActive({ marketId: slice.marketId, x: 120, y: 90 })} onBlur={() => setActive(null)}><title>{`${slice.label} : ${slice.count} tickets (${slice.percent.toFixed(1)} %)`}</title></path>) : <circle cx="120" cy="120" r="104" fill="var(--line)"/>}
      </svg>{activeSlice && <div className="comparison-tooltip" style={{ left: active?.x, top: active?.y }} role="status"><strong>{activeSlice.label}</strong><span>{activeSlice.count ?? 0} ticket{Number(activeSlice.count ?? 0) > 1 ? "s" : ""} · {activeSlice.percent.toFixed(1)} %</span></div>}<figcaption><strong>{total}</strong> tickets ouverts{!total && <span>{available ? "Aucun ticket ouvert sur les marchés renseignés." : "Aucune donnée disponible."}</span>}</figcaption></figure>
      <div className="comparison-legend">{snapshot.rows.map((row) => <button type="button" key={row.marketId} className={active?.marketId === row.marketId ? "is-active" : active ? "is-muted" : ""} onPointerEnter={() => setActive({ marketId: row.marketId, x: 120, y: 90 })} onPointerLeave={() => setActive(null)} onFocus={() => setActive({ marketId: row.marketId, x: 120, y: 90 })} onBlur={() => setActive(null)}><i style={{ backgroundColor: row.color }}/><span><strong>{row.label}</strong><small>{row.source === "manual" ? "Saisie manuelle" : row.source === "saved" ? "Point enregistré" : row.source === "import" ? "Import Jira" : "Sans données"}{row.updatedAt ? ` · ${row.updatedAt.slice(0, 10).split("-").reverse().join("/")}` : ""}</small></span><b>{row.count ?? "—"}</b><em>{row.count !== null && total > 0 ? `${(row.count / total * 100).toFixed(1)} %` : "—"}</em></button>)}</div>
    </div>
    {missing > 0 && <p className="comparison-caption" role="status">{missing} marché{missing > 1 ? "s" : ""} sans données : les pourcentages portent uniquement sur les marchés renseignés.</p>}
    {loading && <p className="comparison-caption" role="status">Actualisation en cours…</p>}
  </section>;
}
