"use client";

import { useId } from "react";

export function ImportSourceRefreshPanel() {
  const id = useId();
  return <section className="surface import-refresh-panel" aria-labelledby={`${id}-title`}>
    <header><div><h2 id={`${id}-title`}>Actualiser les sources</h2><p>PURCHASES, tickets Jira et simulations Planner réunis au même endroit.</p></div></header>
    <div className="import-refresh-sources">
      <div className="import-refresh-source"><div><strong>PURCHASES</strong><small>Fichier Excel</small></div><div className="import-refresh-fields has-sheet"><label htmlFor={`${id}-purchaseData`}>Chemin du fichier ou URL<input id={`${id}-purchaseData`} type="text" placeholder="Chemin complet vers le fichier Excel (.xlsx)" autoComplete="off" spellCheck={false}/></label><label htmlFor={`${id}-sheet`}>Nom de la feuille Excel<input id={`${id}-sheet`} type="text" placeholder="Ex. : Extraction PURCHASES" autoComplete="off"/></label></div></div>
      <div className="import-refresh-source"><div><strong>Jira</strong><small>Tickets et participants</small></div><div className="import-refresh-fields"><label htmlFor={`${id}-jira`}>Lien du flux RSS<input id={`${id}-jira`} type="url" placeholder="https://…/flux-rss" autoComplete="off" spellCheck={false}/></label></div></div>
      <div className="import-refresh-source"><div><strong>Simulations</strong><small>Planner</small></div><div className="import-refresh-fields"><label htmlFor={`${id}-planner`}>Lien du plan Planner<input id={`${id}-planner`} type="url" placeholder="https://…/planner/…" autoComplete="off" spellCheck={false}/></label></div></div>
    </div>
    <footer><p id={`${id}-help`}>L’actualisation groupée sera activée prochainement. Les imports manuels sont disponibles ci-dessous.</p><button type="button" className="primary-button" disabled aria-describedby={`${id}-help`}>Tout actualiser</button></footer>
  </section>;
}
