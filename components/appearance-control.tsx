"use client";

import { appearanceOptions } from "@/lib/appearance";
import { AppIcon } from "./app-icon";
import { useAppearance } from "./appearance-provider";

export function AppearanceControl({ expanded = false }: { expanded?: boolean }) {
  const { mode, chooseMode } = useAppearance();
  return <div className={expanded ? "appearance-options" : "appearance-switch"} role="group" aria-label="Apparence de l’application">
    {appearanceOptions.map((option) => <button key={option.id} type="button" className={mode === option.id ? "active" : ""} aria-pressed={mode === option.id} aria-label={`Mode ${option.label.toLocaleLowerCase("fr")}`} title={`Mode ${option.label.toLocaleLowerCase("fr")}`} onClick={() => chooseMode(option.id)}>
      {expanded && <span className={`appearance-preview preview-${option.id}`} aria-hidden="true"><i/><span><i/><i/><i/></span></span>}
      <span className="appearance-option-label"><AppIcon name={option.icon} size={17}/><strong>{option.label}</strong></span>
      {expanded && <small>{option.detail}</small>}
    </button>)}
  </div>;
}

export function AppearanceSettings() {
  return <section className="surface appearance-settings" aria-labelledby="appearance-title">
    <header><div><span>Sur cet appareil</span><h2 id="appearance-title">Apparence de l’application</h2></div><p>Le choix est mémorisé ici. Il ne modifie ni les points enregistrés ni le fond blanc des mails.</p></header>
    <AppearanceControl expanded/>
  </section>;
}
