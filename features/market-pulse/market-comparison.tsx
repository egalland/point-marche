import { comparisonSlices, comparisonTotals, type MarketComparison as Snapshot } from "@/lib/market-comparison";

export function MarketComparisonChart({ snapshot, loading = false }: { snapshot: Snapshot | null; loading?: boolean }) {
  if (loading && !snapshot) return <div className="report-empty" role="status">Chargement des marchés…</div>;
  if (!snapshot) return <div className="report-empty">Actualise la comparaison pour afficher les tickets ouverts par marché.</div>;
  const { total, missing, available } = comparisonTotals(snapshot.rows);
  const slices = comparisonSlices(snapshot.rows);
  return <section className="report-focus market-comparison-card" aria-label="Comparaison des marchés">
    <div className="report-heading"><div><small>Répartition par marché</small><h2>Tickets Jira ouverts</h2></div><span className="report-pill">{snapshot.year} · S{String(snapshot.week).padStart(2, "0")}</span></div>
    <p className="comparison-caption">Dernier import ou saisie manuelle de chaque marché. Le volume ne mesure pas la difficulté des tickets.</p>
    <div className="market-comparison-grid">
      <figure><svg viewBox="0 0 240 240" role="img" aria-label={`${total} tickets ouverts sur ${available} marchés renseignés`}>
        {slices.length ? slices.map((slice) => <path key={slice.marketId} d={slice.path} fill={slice.color} stroke="var(--surface, #fff)" strokeWidth="2"><title>{slice.label} : {slice.count} tickets ({slice.percent.toFixed(1)} %)</title></path>) : <circle cx="120" cy="120" r="104" fill="var(--line)"/>}
      </svg><figcaption><strong>{total}</strong> tickets ouverts{!total && <span>{available ? "Aucun ticket ouvert sur les marchés renseignés." : "Aucune donnée disponible."}</span>}</figcaption></figure>
      <div className="comparison-legend">{snapshot.rows.map((row) => <div key={row.marketId}><i style={{ backgroundColor: row.color }}/><span><strong>{row.label}</strong><small>{row.source === "manual" ? "Saisie manuelle" : row.source === "saved" ? "Point enregistré" : row.source === "import" ? "Import Jira" : "Sans données"}{row.updatedAt ? ` · ${row.updatedAt.slice(0, 10).split("-").reverse().join("/")}` : ""}</small></span><b>{row.count ?? "—"}</b><em>{row.count !== null && total > 0 ? `${(row.count / total * 100).toFixed(1)} %` : "—"}</em></div>)}</div>
    </div>
    {missing > 0 && <p className="comparison-caption" role="status">{missing} marché{missing > 1 ? "s" : ""} sans données : les pourcentages portent uniquement sur les marchés renseignés.</p>}
    {loading && <p className="comparison-caption" role="status">Actualisation en cours…</p>}
  </section>;
}
