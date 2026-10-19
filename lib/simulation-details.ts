import type { CommercialOperation } from "../features/market-pulse/point-model";
import { simulationMilestones, milestonesFromSteps, simulationLifecycle } from "./simulation-lifecycle";
export function operationLifecycle(item: CommercialOperation) {
  return simulationLifecycle(item.plannerSource?.checklist ? simulationMilestones(item.plannerSource.checklist) : milestonesFromSteps(item.steps));
}
export function operationSteps(item: CommercialOperation): [string, string][] {
  return item.plannerSource?.checklist?.map(step => [step.label, step.date || (step.nonApplicable ? "Non applicable" : "À faire")]) ?? item.steps;
}
