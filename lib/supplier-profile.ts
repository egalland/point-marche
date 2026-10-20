import type { PlannerTask } from "./planner-import";
import type { PURCHASESRow } from "./purchaseData";
import { supplierLabelFromTask, buildSupplierVariations } from "./supplier-variations";
import { marketSimulationState } from "./market-simulation";
import { simulationMilestones, simulationLifecycle } from "./simulation-lifecycle";

export type SupplierProfile = { key: string; code: string; label: string; aliases: string[]; tasks: PlannerTask[]; purchaseData: PURCHASESRow[] };
export const supplierCode = (value: string) => value.trim().toUpperCase();
const nameKey = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr-FR").replace(/[^a-z0-9]+/g, " ").trim();
const chronology = (task: PlannerTask) => `${task.effectiveMonth || "0000-00"}|${task.importedAt || task.createdAt || ""}`;
export function buildSupplierProfiles(tasks: PlannerTask[], rows: PURCHASESRow[]): SupplierProfile[] {
  const profiles = new Map<string, SupplierProfile>();
  const ensure = (key: string, code: string, label: string) => {
    let profile = profiles.get(key);
    if (!profile) { profile = { key, code, label: label || code || "Fournisseur sans nom", aliases: [], tasks: [], purchaseData: [] }; profiles.set(key, profile); }
    if (label && !profile.aliases.includes(label)) profile.aliases.push(label);
    return profile;
  };
  const uniqueTasks = new Map<string, PlannerTask>();
  for (const task of tasks) {
    const previous = uniqueTasks.get(task.externalId);
    if (!previous || chronology(task) >= chronology(previous)) uniqueTasks.set(task.externalId, task);
  }
  for (const task of uniqueTasks.values()) {
    const code = supplierCode(task.metrics.supplierCode), label = supplierLabelFromTask(task.taskName);
    const key = code ? `code:${code}` : `name:${nameKey(label)}`;
    ensure(key, code, label).tasks.push(task);
  }
  const seenRows = new Set<string>();
  for (const row of rows) {
    if (seenRows.has(row.id)) continue;
    seenRows.add(row.id);
    const code = supplierCode(row.supplier);
    if (code) ensure(`code:${code}`, code, row.name.trim()).purchaseData.push(row);
  }
  for (const profile of profiles.values()) {
    profile.tasks.sort((a, b) => chronology(b).localeCompare(chronology(a)) || a.externalId.localeCompare(b.externalId));
    profile.label = profile.tasks.length ? supplierLabelFromTask(profile.tasks[0].taskName) : profile.purchaseData.find(row => row.name.trim())?.name.trim() || profile.code;
    profile.purchaseData.sort((a, b) => b.extracted.localeCompare(a.extracted) || a.piece.localeCompare(b.piece));
  }
  return [...profiles.values()].sort((a, b) => a.label.localeCompare(b.label, "fr") || a.code.localeCompare(b.code));
}
export function supplierProfileSummary(profile: SupplierProfile) {
  const dated = profile.tasks.map(task => simulationLifecycle(simulationMilestones(task.checklist)));
  const average = (key: "noticeToTemplate" | "templateToSupplier") => {
    const values = dated.map(item => item[key]).filter((value): value is number => value !== null);
    return { days: values.length ? Math.round(values.reduce((a,b) => a+b,0) / values.length * 10) / 10 : null, count: values.length };
  };
  const turnoverTask = profile.tasks.find(task => typeof task.metrics.purchases12m === "number" && Number.isFinite(task.metrics.purchases12m));
  const latestVariation = profile.tasks.find(task => task.metrics.globalVariation !== null || task.metrics.weightedVariation !== null);
  return { total: profile.tasks.length, done: profile.tasks.filter(task => marketSimulationState(task) === "Faite").length,
    active: profile.tasks.filter(task => !["Faite", "Non finalisée"].includes(marketSimulationState(task))).length,
    stopped: profile.tasks.filter(task => marketSimulationState(task) === "Non finalisée").length,
    sent: dated.filter(item => item.templateDone).length, dateIssues: dated.filter(item => item.invalidOrder).length,
    preparation: average("noticeToTemplate"), supplierReturn: average("templateToSupplier"), turnoverTask, latestVariation,
    variations: buildSupplierVariations(profile.tasks), tags: [...new Set(profile.tasks.flatMap(task => task.labels))].sort(),
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
