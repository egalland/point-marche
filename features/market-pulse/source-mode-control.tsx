import type { PointSourceMode } from "@/lib/point-source-mode";

export function SourceModeControl({ label, mode, onChange, busy = false }: { label: string; mode: PointSourceMode; onChange: (mode: PointSourceMode) => void; busy?: boolean }) {
  return <div className={`source-mode-control ${mode === "manual" ? "is-manual" : ""}`}>
    <div><strong>{label}</strong><p>{mode === "manual" ? "Les saisies du point sont conservées. Un nouvel import ne les remplace pas." : "Le point utilise le registre importé. Passe en manuel si l’import est indisponible."}</p></div>
    <div className="source-mode-buttons" role="group" aria-label={`Source ${label}`}>
      <button type="button" aria-pressed={mode === "automatic"} disabled={busy} onClick={() => onChange("automatic")}>Import automatique</button>
      <button type="button" aria-pressed={mode === "manual"} disabled={busy} onClick={() => onChange("manual")}>Saisie manuelle</button>
    </div>
  </div>;
}
