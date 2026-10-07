export type JiraAlertRule = { id: string; category: string; subcategory: string; warningDays: number; criticalDays: number; priority: "normal" | "high"; enabled: boolean };
const normalize = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
export function normalizeJiraRules(value: unknown): JiraAlertRule[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((v, index) => { if (!v || typeof v !== "object") return []; const warningDays = Math.max(1, Math.min(365, Math.round(Number(v.warningDays) || 2))); return [{ id: typeof v.id === "string" ? v.id : `rule-${index}`, category: typeof v.category === "string" ? v.category.slice(0, 240) : "", subcategory: typeof v.subcategory === "string" ? v.subcategory.slice(0, 240) : "", warningDays, criticalDays: Math.max(warningDays + 1, Math.min(366, Math.round(Number(v.criticalDays) || 5))), priority: v.priority === "high" ? "high" as const : "normal" as const, enabled: v.enabled !== false }]; }).slice(0, 50);
}
export function jiraRuleFor(ticket: { category?: string; subcategory?: string }, rules: JiraAlertRule[]) {
  return rules.filter((r) => r.enabled && (r.category || r.subcategory) && (!r.category || normalize(r.category) === normalize(ticket.category ?? "")) && (!r.subcategory || normalize(r.subcategory) === normalize(ticket.subcategory ?? ""))).sort((a, b) => Number(!!b.subcategory) - Number(!!a.subcategory) || Number(!!b.category) - Number(!!a.category) || a.warningDays - b.warningDays)[0];
}
