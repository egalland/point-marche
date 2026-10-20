"use client";

import { useId } from "react";

type Source = "purchaseData" | "jira" | "planner";
const sources = {
  purchaseData: { title: "Importer depuis un fichier", label: "Chemin du fichier ou URL", placeholder: "Chemin complet vers le fichier Excel (.xlsx)" },
  jira: { title: "Importer depuis un flux RSS", label: "Lien du flux RSS Jira", placeholder: "https://…/flux-rss" },
  planner: { title: "Importer depuis Planner", label: "Lien du plan Planner", placeholder: "https://…/planner/…" },
};

export function ImportSourceLocation({ source }: { source: Source }) {
  const id = useId();
  const config = sources[source];
  return <section className="import-source-location" aria-labelledby={`${id}-title`}>
    <div className="import-source-location-heading"><h3 id={`${id}-title`}>{config.title}</h3><span>À venir</span></div>
    <div className={`import-source-location-fields${source === "purchaseData" ? " has-sheet" : ""}`}>
      <label htmlFor={`${id}-location`}>{config.label}<input id={`${id}-location`} type={source === "purchaseData" ? "text" : "url"} placeholder={config.placeholder} autoComplete="off" spellCheck={false} aria-describedby={`${id}-help`}/></label>
      {source === "purchaseData" && <label htmlFor={`${id}-sheet`}>Nom de la feuille Excel<input id={`${id}-sheet`} type="text" placeholder="Ex. : Extraction PURCHASES" autoComplete="off" aria-describedby={`${id}-help`}/></label>}
      <button type="button" className="secondary-button" disabled aria-describedby={`${id}-help`}>Importer</button>
    </div>
    <p id={`${id}-help`}>Import non activé pour le moment. Les modalités seront ajoutées prochainement.</p>
  </section>;
}
