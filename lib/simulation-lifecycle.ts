import type { PlannerChecklistItem } from "./planner-import";

export type SimulationMilestones = { notice: string; templateSent: string; supplierReceived: string };
const normalized = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export function validMilestoneDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}
export function milestoneKind(label: string): keyof SimulationMilestones | null {
  const text = normalized(label);
  if (/^avis (?:de )?(?:hausse|variation|tarif)/.test(text)) return "notice";
  if (/trame/.test(text) && /recu|recept|retour|fournisseur/.test(text) && !/envoy|envoi/.test(text)) return "supplierReceived";
  if (/^tarif fournisseur/.test(text)) return "supplierReceived";
  if (/trame/.test(text) && /workspace|envoy|envoi/.test(text)) return "templateSent";
  return null;
}
export function simulationMilestones(checklist: Pick<PlannerChecklistItem, "label" | "date">[]): SimulationMilestones {
  const result: SimulationMilestones = { notice: "", templateSent: "", supplierReceived: "" };
  // A dedicated returned-template date takes precedence over the legacy tariff date.
  const explicitReceipt = checklist.find(item => milestoneKind(item.label) === "supplierReceived" && /trame/i.test(item.label) && validMilestoneDate(item.date));
  for (const item of checklist) {
    const key = milestoneKind(item.label);
    if (key && !result[key] && validMilestoneDate(item.date)) result[key] = item.date;
  }
  if (explicitReceipt) result.supplierReceived = explicitReceipt.date;
  return result;
}
export function elapsedCalendarDays(start: string, end: string): number | null {
  if (!validMilestoneDate(start) || !validMilestoneDate(end)) return null;
  const days = Math.round((Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86400000);
  return days >= 0 ? days : null;
}
export function simulationLifecycle(dates: SimulationMilestones) {
  const noticeToTemplate = elapsedCalendarDays(dates.notice, dates.templateSent);
  const templateToSupplier = elapsedCalendarDays(dates.templateSent, dates.supplierReceived);
  const invalidOrder = Boolean((dates.notice && dates.templateSent && noticeToTemplate === null) || (dates.templateSent && dates.supplierReceived && templateToSupplier === null));
  return { ...dates, templateDone: validMilestoneDate(dates.templateSent), noticeToTemplate, templateToSupplier, invalidOrder };
}
export function milestonesFromSteps(steps: [string, string][]) {
  return simulationMilestones(steps.map(([label, date]) => ({ label, date })));
}
export function milestoneDateLabel(value: string) {
  return validMilestoneDate(value) ? value.split("-").reverse().join("/") : "Non renseignée";
}
