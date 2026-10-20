import type { CommercialOperation } from "../features/market-pulse/point-model";
import { simulationMilestones, simulationLifecycle, hasTemplateTracking } from "./simulation-lifecycle";
export function operationLifecycle(item: CommercialOperation) {
  const checklist = item.plannerSource?.checklist ?? item.steps.map(([label, value]) => ({label, date: value, nonApplicable: value === "Non applicable"}));
  return simulationLifecycle(simulationMilestones(checklist), hasTemplateTracking({labels: item.plannerSource?.labels, checklist}));
}
export function operationSteps(item: CommercialOperation): [string, string][] {
  return item.plannerSource?.checklist?.map(step => [step.label, step.date || (step.nonApplicable ? "Non applicable" : "À faire")]) ?? item.steps;
}
