import type { AnalystStats } from "@/lib/analyst-stats";

type Range = { from: string; to: string };
const dateLabel = (s: string) => new Date(`${s}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC" });
export function ActivityPeriodComparison({ stats, rangeA, rangeB }: { stats: AnalystStats; rangeA: Range; rangeB: Range }) {
  const rows = [
    { label: "Activités", a: stats.totalActivities, b: stats.previousTotal },
    { label: "Tâches distinctes", a: stats.distinctTasks, b: new Set(stats.previousContributions.map((c) => c.taskId)).size },
    { label: "Simulations", a: stats.simulations, b: stats.previousContributions.filter((c) => c.specialty === "simulation").length },
    { label: "Contrôles", a: stats.controls, b: stats.previousContributions.filter((c) => c.specialty === "control").length },
  ];
  const max = Math.max(1, ...rows.flatMap((r) => [r.a, r.b]));
  const days = (r: Range) => Math.round((Date.parse(r.to) - Date.parse(r.from)) / 86400000) + 1;
  const people = new Map<string, { a: number; b: number }>();
  for (const [period, contributions] of [["a", stats.contributions], ["b", stats.previousContributions]] as const) for (const c of contributions) { const row = people.get(c.analystName) ?? { a: 0, b: 0 }; row[period]++; people.set(c.analystName, row); }
  const names = [...people.keys()].sort((a, b) => a.localeCompare(b, "fr"));
  return <>
    <div className="period-comparison-legend"><span><i className="period-a"/>A · {dateLabel(rangeA.from)} → {dateLabel(rangeA.to)} · {days(rangeA)} jours</span><span><i className="period-b"/>B · {dateLabel(rangeB.from)} → {dateLabel(rangeB.to)} · {days(rangeB)} jours</span></div>
    {days(rangeA) !== days(rangeB) && <p className="editor-hint">Les durées diffèrent : les volumes sont bruts, sans ajustement au nombre de jours.</p>}
    <div className="period-comparison-bars">{rows.map((r) => <div key={r.label}><strong>{r.label}</strong><div className="period-bar-line"><span>A</span><div><i className="period-a" style={{ width: `${r.a / max * 100}%` }}/></div><b>{r.a}</b></div><div className="period-bar-line"><span>B</span><div><i className="period-b" style={{ width: `${r.b / max * 100}%` }}/></div><b>{r.b}</b></div><small>Écart A − B : {r.a - r.b > 0 ? "+" : ""}{r.a - r.b}</small></div>)}</div>
    {!stats.totalActivities && !stats.previousTotal && <p className="report-empty">Aucune activité datée sur les deux périodes.</p>}
    <details><summary>Comparaison par analyste</summary><div className="data-table-wrap"><table><thead><tr><th>Analyste</th><th>Période A</th><th>Période B</th><th>Écart A − B</th></tr></thead><tbody>{names.map((name) => { const { a, b } = people.get(name)!; return <tr key={name}><td>{name}</td><td>{a}</td><td>{b}</td><td>{a - b}</td></tr>; })}</tbody></table></div></details>
    <p className="editor-hint">Les mêmes marchés, spécialités et analystes sont appliqués aux deux périodes. Les délais ci-dessous comparent également A à B.</p>
  </>;
}
