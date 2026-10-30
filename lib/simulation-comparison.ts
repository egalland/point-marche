import {matchesPlannerMarket} from './planner-market-tags';
import type { PlannerTask } from "./planner-import";
import { supplierKeyForTask } from "./supplier-variations";
export type ComparisonMetric = "count" | "variation" | "weighted";
export type ComparisonConfig = { fromA: string; toA: string; fromB: string; toB: string; marketId: string; supplierKey: string; metric: ComparisonMetric };
export type ComparisonBucket = { labelA: string; labelB: string; valueA: number | null; valueB: number | null; countA: number; countB: number };
export type ComparisonSnapshot = { config: ComparisonConfig; buckets: ComparisonBucket[]; totalA: number | null; totalB: number | null; countA: number; countB: number; title: string; sourceUpdatedAt?: string };
export type ComparisonMarket = { id: string; name: string; plannerTags: string[] };
const monthValid = (s: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
export function defaultComparison(marketId = "all"): ComparisonConfig {
  const date = new Date(); const month = date.toISOString().slice(0, 7); const old = `${date.getUTCFullYear() - 1}${month.slice(4)}`;
  return { fromA: old, toA: old, fromB: month, toB: month, marketId, supplierKey: "all", metric: "count" };
}
export function normalizeComparison(value: unknown, marketId = "all"): ComparisonConfig {
  const d = defaultComparison(marketId); if (!value || typeof value !== "object") return d;
  const v = value as Partial<ComparisonConfig>;
  for (const key of ["fromA", "toA", "fromB", "toB"] as const) if (typeof v[key] === "string" && monthValid(v[key]!)) d[key] = v[key]!;
  for (const key of ["marketId", "supplierKey"] as const) if (typeof v[key] === "string") d[key] = v[key]!;
  if (["count", "variation", "weighted"].includes(v.metric ?? "")) d.metric = v.metric!;
  return d;
}
function months(from: string, to: string) {
  if (!monthValid(from) || !monthValid(to) || from > to) return [];
  const result: string[] = []; const date = new Date(`${from}-01T00:00:00Z`);
  while (date.toISOString().slice(0, 7) <= to && result.length < 60) { result.push(date.toISOString().slice(0, 7)); date.setUTCMonth(date.getUTCMonth() + 1); }
  return result;
}
function measure(tasks: PlannerTask[], metric: ComparisonMetric) {
  if (metric === "count") return tasks.length;
  const values = tasks.map((t) => metric === "variation" ? t.metrics.globalVariation : t.metrics.weightedVariation).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
}
export function buildSimulationComparison(tasks: PlannerTask[], markets: ComparisonMarket[], config: ComparisonConfig, sourceUpdatedAt = ""): ComparisonSnapshot {
  const market = markets.find((m) => m.id === config.marketId);
  // A simulation is a distinct Planner task, never a checklist step.
  const distinct = [...new Map(tasks.map((t) => [t.externalId, t])).values()].filter((t) => t.workflowState !== "stopped" && (config.marketId === "all" || market && matchesPlannerMarket(t.labels,market.plannerTags)) && (config.supplierKey === "all" || supplierKeyForTask(t) === config.supplierKey));
  const a = months(config.fromA, config.toA); const b = months(config.fromB, config.toB);
  const listA = distinct.filter((t) => a.includes(t.effectiveMonth)); const listB = distinct.filter((t) => b.includes(t.effectiveMonth));
  const buckets = Array.from({ length: Math.max(a.length, b.length) }, (_, i) => {
    const ta = distinct.filter((t) => t.effectiveMonth === a[i]); const tb = distinct.filter((t) => t.effectiveMonth === b[i]);
    return { labelA: a[i] ?? "", labelB: b[i] ?? "", valueA: a[i] ? measure(ta, config.metric) : null, valueB: b[i] ? measure(tb, config.metric) : null, countA: ta.length, countB: tb.length };
  });
  return { config, buckets, totalA: a.length ? measure(listA, config.metric) : null, totalB: b.length ? measure(listB, config.metric) : null, countA: listA.length, countB: listB.length, title: config.metric === "count" ? "Nombre de simulations" : config.metric === "variation" ? "Variation moyenne GLOBAL" : "Moyenne des variations pondérées", sourceUpdatedAt };
}
export function normalizeComparisonSnapshot(value: unknown): ComparisonSnapshot | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as Partial<ComparisonSnapshot>; if (!Array.isArray(v.buckets)) return undefined;
  const config = normalizeComparison(v.config); const number = (n: unknown) => typeof n === "number" && Number.isFinite(n) ? n : null;
  return { config, title: config.metric === "count" ? "Nombre de simulations" : config.metric === "variation" ? "Variation moyenne GLOBAL" : "Moyenne des variations pondérées", totalA: number(v.totalA), totalB: number(v.totalB), countA: Math.max(0, Number(v.countA) || 0), countB: Math.max(0, Number(v.countB) || 0), sourceUpdatedAt: typeof v.sourceUpdatedAt === "string" ? v.sourceUpdatedAt.slice(0, 30) : "", buckets: v.buckets.slice(0, 60).flatMap((b) => b && typeof b === "object" ? [{ labelA: typeof b.labelA === "string" && monthValid(b.labelA) ? b.labelA : "", labelB: typeof b.labelB === "string" && monthValid(b.labelB) ? b.labelB : "", valueA: number(b.valueA), valueB: number(b.valueB), countA: Math.max(0, Number(b.countA) || 0), countB: Math.max(0, Number(b.countB) || 0) }] : []) };
}
export function comparisonValue(v: number | null, metric: ComparisonMetric) { return v === null ? "Sans donnée" : `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: metric === "count" ? 0 : 2 }).format(v)}${metric === "count" ? "" : " %"}`; }
export function comparisonHtml(input: ComparisonSnapshot | undefined) {
  const snapshot = normalizeComparisonSnapshot(input);
  if (!snapshot) return '<p>Comparatif à configurer dans le point.</p>';
  const metric = snapshot.config.metric;
  const maximum = Math.max(1, ...snapshot.buckets.flatMap((b) => [Math.abs(b.valueA ?? 0), Math.abs(b.valueB ?? 0)]));
  const bars = `<table role="presentation" style="width:100%">${snapshot.buckets.map((b) => (["A", "B"] as const).map((p) => `<tr><td style="padding:5px;width:90px">${b[`label${p}`] || "—"}</td><td style="padding:5px"><table role="presentation" width="100%"><tr><td style="width:${Math.max(1,Math.abs(b[`value${p}`] ?? 0) / maximum * 100)}%;height:14px;background:${p === "A" ? "#126887" : "#8050ba"}"></td><td></td></tr></table></td><td style="padding:5px;width:90px">${comparisonValue(b[`value${p}`], metric)}</td></tr>`).join("")).join("")}</table>`;
  return `${bars}<p>${snapshot.title} · ${snapshot.config.fromA} → ${snapshot.config.toA} / ${snapshot.config.fromB} → ${snapshot.config.toB}</p><table style="width:100%;border-collapse:collapse"><thead><tr><th>Période A</th><th>Valeur A</th><th>Période B</th><th>Valeur B</th></tr></thead><tbody>${snapshot.buckets.map((b) => `<tr><td style="padding:8px;border-bottom:1px solid #ddd">${b.labelA || "—"}</td><td style="padding:8px;color:#126887">${comparisonValue(b.valueA, metric)}</td><td style="padding:8px;border-bottom:1px solid #ddd">${b.labelB || "—"}</td><td style="padding:8px;color:#8050ba">${comparisonValue(b.valueB, metric)}</td></tr>`).join("")}</tbody></table><p><b>A : ${comparisonValue(snapshot.totalA, metric)} · B : ${comparisonValue(snapshot.totalB, metric)}</b></p><small>${metric === "count" ? "Tâches distinctes par mois d’application." : "Moyenne arithmétique des valeurs renseignées par simulation, hors valeurs manquantes. Les variations successives ne sont pas cumulées."}</small>`;
}
