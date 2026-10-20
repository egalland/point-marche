import type { PlannerTask } from "./planner-import";
import type { PURCHASESRow } from "./purchaseData";
import { supplierLabelFromTask, buildSupplierVariations } from "./supplier-variations";
import { marketSimulationState } from "./market-simulation";
import { simulationMilestones, simulationLifecycle, hasTemplateTracking } from "./simulation-lifecycle";

export type SupplierMatch = { source: "planner" | "purchaseData"; id: string; name: string; rawCode: string; code: string; reason: "name" | "missing" | "ambiguous-name" | "ambiguous-code"; candidates: string[] };
export type SupplierProfile = { key: string; code: string; label: string; aliases: string[]; nameVariants: { name: string; count: number }[]; labelCount: number; labelTotal: number; correlations: SupplierMatch[]; tasks: PlannerTask[]; purchaseData: PURCHASESRow[] };
const nameKey = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr-FR").replace(/[^a-z0-9]+/g, " ").trim();
const chronology = (task: PlannerTask) => `${task.effectiveMonth || "0000-00"}|${task.importedAt || task.createdAt || ""}`;
function codeCandidates(value: string) {
  return [...new Set((value.toUpperCase().match(/(?<![A-Z0-9])[A-Z][0-9]{4}(?![A-Z0-9])/g) || []))];
}
/** Extract only a unique letter + four digits, including legacy code fields followed by comments. */
export const supplierCode = (value: string) => { const codes = codeCandidates(value); return codes.length === 1 ? codes[0] : ""; };
export function buildSupplierCatalog(tasks: PlannerTask[], rows: PURCHASESRow[]) {
  const profiles = new Map<string, SupplierProfile>();
  const votes = new Map<string, Map<string, Map<string, number>>>();
  const nameIndex = new Map<string, Set<string>>();
  const unresolved: SupplierMatch[] = [];
  const pending: { source: "planner" | "purchaseData"; id: string; name: string; rawCode: string; task?: PlannerTask; row?: PURCHASESRow }[] = [];
  const ensure = (code: string) => {
    let profile = profiles.get(code);
    if (!profile) { profile = { key: `code:${code}`, code, label: code, aliases: [], nameVariants: [], labelCount: 0, labelTotal: 0, correlations: [], tasks: [], purchaseData: [] }; profiles.set(code, profile); }
    return profile;
  };
  const vote = (code: string, value: string) => {
    const label = value.trim().replace(/\s+/g, " "), key = nameKey(label);
    if (!key) return;
    const profile = ensure(code);
    if (!profile.aliases.includes(label)) profile.aliases.push(label);
    let codes = nameIndex.get(key); if (!codes) { codes = new Set(); nameIndex.set(key, codes); } codes.add(code);
    let names = votes.get(code); if (!names) { names = new Map(); votes.set(code, names); }
    let spellings = names.get(key); if (!spellings) { spellings = new Map(); names.set(key, spellings); }
    spellings.set(label, (spellings.get(label) || 0) + 1);
  };
  const uniqueTasks = new Map<string, PlannerTask>();
  for (const task of tasks) { const previous = uniqueTasks.get(task.externalId); if (!previous || chronology(task) >= chronology(previous)) uniqueTasks.set(task.externalId, task); }
  for (const task of uniqueTasks.values()) {
    const rawCode = task.metrics.supplierCode, code = supplierCode(rawCode), name = supplierLabelFromTask(task.taskName);
    if (code) { ensure(code).tasks.push(task); vote(code, name); }
    else pending.push({ source: "planner", id: task.externalId, name, rawCode, task });
  }
  const seenRows = new Set<string>();
  for (const row of rows) {
    if (seenRows.has(row.id)) continue; seenRows.add(row.id);
    const rawCode = row.supplier, code = supplierCode(rawCode), name = row.name.trim();
    if (code) { ensure(code).purchaseData.push(row); vote(code, name); }
    else pending.push({ source: "purchaseData", id: row.id, name, rawCode, row });
  }
  // Correlation uses only aliases anchored by an explicit valid Code; inferred rows never propagate new aliases or votes.
  for (const item of pending) {
    const candidates = [...(nameIndex.get(nameKey(item.name)) || [])].sort();
    const conflicting = codeCandidates(item.rawCode).length > 1;
    const match: SupplierMatch = { source: item.source, id: item.id, name: item.name, rawCode: item.rawCode, code: !conflicting && candidates.length === 1 ? candidates[0] : "", reason: conflicting ? "ambiguous-code" : candidates.length === 1 ? "name" : candidates.length > 1 ? "ambiguous-name" : "missing", candidates };
    if (!match.code) { unresolved.push(match); continue; }
    const profile = ensure(match.code); profile.correlations.push(match);
    if (item.task) profile.tasks.push(item.task); if (item.row) profile.purchaseData.push(item.row);
  }
  for (const profile of profiles.values()) {
    const groups = [...(votes.get(profile.code)?.values() || [])].map(spellings => {
      const names = [...spellings].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr") || a[0].localeCompare(b[0]));
      return { name: names[0][0], count: names.reduce((sum, item) => sum + item[1], 0) };
    }).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "fr") || a.name.localeCompare(b.name));
    profile.nameVariants = groups; profile.label = groups[0]?.name || profile.code; profile.labelCount = groups[0]?.count || 0; profile.labelTotal = groups.reduce((sum, group) => sum + group.count, 0);
    profile.tasks.sort((a, b) => chronology(b).localeCompare(chronology(a)) || a.externalId.localeCompare(b.externalId));
    profile.purchaseData.sort((a, b) => b.extracted.localeCompare(a.extracted) || a.piece.localeCompare(b.piece));
  }
  return { profiles: [...profiles.values()].sort((a, b) => a.label.localeCompare(b.label, "fr") || a.code.localeCompare(b.code)), unresolved, correlated: [...profiles.values()].reduce((sum, profile) => sum + profile.correlations.length, 0) };
}
export function buildSupplierProfiles(tasks: PlannerTask[], rows: PURCHASESRow[]) { return buildSupplierCatalog(tasks, rows).profiles; }
export function supplierProfileSummary(profile: SupplierProfile) {
  const dated = profile.tasks.map(task => simulationLifecycle(simulationMilestones(task.checklist), hasTemplateTracking(task)));
  const average = (key: "noticeToTemplate" | "templateToSupplier") => {
    const values = dated.map(item => item[key]).filter((value): value is number => value !== null);
    return { days: values.length ? Math.round(values.reduce((a,b) => a+b,0) / values.length * 10) / 10 : null, count: values.length };
  };
  const latestVariation = profile.tasks.find(task => task.metrics.globalVariation !== null || task.metrics.weightedVariation !== null);
  return { total: profile.tasks.length, done: profile.tasks.filter(task => marketSimulationState(task) === "Faite").length,
    active: profile.tasks.filter(task => !["Faite", "Non finalisée"].includes(marketSimulationState(task))).length,
    stopped: profile.tasks.filter(task => marketSimulationState(task) === "Non finalisée").length,
    tracked: dated.filter(item => item.templateApplicable).length, sent: dated.filter(item => item.templateDone === true).length, dateIssues: dated.filter(item => item.invalidOrder).length,
    preparation: average("noticeToTemplate"), supplierReturn: average("templateToSupplier"), latestVariation,
    variations: buildSupplierVariations(profile.tasks).map(({ purchases12m: _omitted, ...point }) => ({ ...point, supplierKey: profile.code, supplierCode: profile.code, supplierLabel: profile.label })), tags: [...new Set(profile.tasks.flatMap(task => task.labels))].sort(),
  };
}
export function filterSupplierProfiles(profiles: SupplierProfile[], query: string) {
  const terms = nameKey(query).split(" ").filter(Boolean);
  return profiles.filter(profile => terms.every(term => nameKey(`${profile.label} ${profile.code} ${profile.aliases.join(" ")}`).includes(term)));
}
export function supplierSelectionUrl(href: string, key: string) {
  const url = new URL(href);
  url.searchParams.set("mode", "suppliers");
  if (key) url.searchParams.set("supplier", key); else url.searchParams.delete("supplier");
  return url.href;
}
export function supplierSelectionFromUrl(href: string) {
  return new URL(href).searchParams.get("supplier") || "";
}

/** Omit labelled purchase/turnover amounts from notes in the supplier view; keep the source record unchanged. */
export function supplierNotesWithoutTurnover(value: string) {
  return value.replace(/\b(?:achats?\s*12\s*m(?:g|ois)?|ca(?:\s+fournisseur)?(?:\s*12\s*m(?:g|ois)?)?|chiffre d[’']affaires)\s*:\s*[+−-]?[\d., \u00a0]+(?:€|eur(?:os?)?)?/gi, "").replace(/^[ \t]+$/gm, "").trim();
}
