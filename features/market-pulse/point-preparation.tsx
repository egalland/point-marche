"use client";
import { pointReadiness, type PreparationSave, type PreparationTarget } from "@/lib/point-readiness";
import type { Market, PointData } from "./point-model";

export function PointPreparation({ data, market, save, onAction, showChecks = true }: { data: PointData; market: Market; save: PreparationSave; showChecks?: boolean; onAction?: Partial<Record<PreparationTarget, () => void>> }) {
  const status = pointReadiness(data, market, save);
  return <section className="point-preparation" aria-label="Synthèse et préparation du point">
    <div className="preparation-overview"><div><span className="preparation-eyebrow">Le point en un regard</span><strong>Les repères de la semaine</strong></div><div className="preparation-metrics">{status.metrics.map(metric => <article key={metric.label}><span>{metric.label}</span><strong>{metric.value === null ? "—" : metric.value.toLocaleString("fr-FR")}</strong><small>{metric.detail}</small></article>)}</div></div>
    {showChecks && <details className="preparation-checklist"><summary><span className={`preparation-indicator ${status.blocked ? "blocked" : status.review ? "review" : "ok"}`}>{status.review ? `${status.review} vérification${status.review > 1 ? "s" : ""}` : "Contrôles renseignés"}</span><strong>Avant de diffuser le point</strong><span className="preparation-expand">Voir les contrôles</span></summary>
      <p className="preparation-hint">Ces repères aident à la relecture ; ils ne remplacent pas la validation du contenu.</p>
      <ul>{status.checks.map(check => <li key={check.id} className={check.state}><span className="preparation-check-icon" aria-label={check.state === "ok" ? "Renseigné" : check.state === "blocked" ? "À corriger" : "À vérifier"}>{check.state === "ok" ? "✓" : "!"}</span><div><strong>{check.label}</strong><p>{check.detail}</p></div>{check.state !== "ok" && onAction?.[check.target] && <button type="button" onClick={onAction[check.target]}>{check.target === "save" ? "Enregistrer" : check.target === "mail" ? "Destinataires" : check.target === "imports" ? "Sources" : "Ouvrir le point"}</button>}</li>)}</ul>
    </details>}
  </section>;
}
