export function ManualAnalystJira({ counts, onChange }: { counts: { open: number; resolved: number }; onChange: (counts: { open: number; resolved: number }) => void }) {
  return <section className="surface manual-analyst-editor"><header><div><strong>Totaux Jira du point</strong><p className="comparison-caption">Renseigne les totaux de cette semaine. Ils restent séparés du registre et sont signalés comme manuels dans les exports.</p></div></header><div className="form-grid">
    <label className="field"><span>Tickets terminés dans la semaine</span><input type="number" min="0" step="1" value={counts.resolved} onChange={(event) => onChange({ ...counts, resolved: Math.max(0, Math.round(Number(event.target.value) || 0)) })}/></label>
    <label className="field"><span>Tickets encore ouverts</span><input type="number" min="0" step="1" value={counts.open} onChange={(event) => onChange({ ...counts, open: Math.max(0, Math.round(Number(event.target.value) || 0)) })}/></label>
  </div></section>;
}
