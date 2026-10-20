import type { CommercialOperation } from "./point-model";
import { operationLifecycle, operationSteps } from "@/lib/simulation-details";
import { milestoneDateLabel } from "@/lib/simulation-lifecycle";
import { SupplierMiniChart } from "./supplier-mini-chart";
export function SimulationDetails({ item, showPurchases = true }: { item: CommercialOperation; showPurchases?: boolean }) {
  const dates = operationLifecycle(item), metrics = item.plannerSource?.metrics, steps = operationSteps(item);
  const pct = (value: number | null | undefined) => value == null ? "—" : `${value.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %`;
  return <div className="simulation-details">
    {item.summary && <p className="simulation-summary">{item.summary}</p>}
    <span className={`simulation-template-status ${dates.templateDone ? "is-done" : ""}`}>{dates.templateDone ? `Trame envoyée le ${milestoneDateLabel(dates.templateSent)}` : "Trame non datée · envoi non confirmé"}</span>
    <dl className="simulation-milestones">{[["Avis", dates.notice], ["Trame envoyée", dates.templateSent], ["Retour fournisseur", dates.supplierReceived]].map(([label, date]) => <div key={label}><dt>{label}</dt><dd>{milestoneDateLabel(date)}</dd></div>)}</dl>
    <div className="simulation-delay-pills"><span>Avis → trame <b>{dates.noticeToTemplate === null ? "—" : `${dates.noticeToTemplate} j`}</b></span><span>Trame → retour <b>{dates.templateToSupplier === null ? "—" : `${dates.templateToSupplier} j`}</b></span></div>
    {dates.invalidOrder && <p role="status" className="simulation-date-warning">Dates à vérifier : ordre chronologique incohérent. Délai concerné exclu des moyennes.</p>}
    {metrics && <dl className="simulation-milestones"><div><dt>Variation GLOBAL</dt><dd>{pct(metrics.globalVariation)}</dd></div><div><dt>Pondérée</dt><dd>{pct(metrics.weightedVariation)}</dd></div>{showPurchases && <div><dt>Achats 12 mois</dt><dd>{metrics.purchases12m == null ? "—" : `${metrics.purchases12m.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €`}</dd></div>}</dl>}
    {!!steps.length && <details className="simulation-step-details"><summary>Étapes et historique fournisseur</summary><p className="simulation-source-note">Jours calendaires entre dates renseignées. Retour : date de réception de la trame, ou « Tarif fournisseur » si aucune date dédiée.</p><ol>{steps.map(([label, date], index) => <li key={`${label}-${index}`}><span>{label}</span><b>{/^\d{4}-\d{2}-\d{2}$/.test(date) ? milestoneDateLabel(date) : date}</b></li>)}</ol>{!!item.plannerSource?.variationHistory?.length && <SupplierMiniChart points={item.plannerSource.variationHistory}/>}</details>}
  </div>;
}
