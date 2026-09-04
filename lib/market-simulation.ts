import { plannerTaskMonthLabel, type PlannerTask } from "./planner-import";

export const MARKET_SIMULATION_STATES = [
  "À faire",
  "En cours",
  "En attente du fournisseur",
  "En attente du marché",
  "En attente de contrôle",
  "Faite",
  "Non finalisée",
] as const;

export type MarketSimulationState = typeof MARKET_SIMULATION_STATES[number];
export type MarketSimulationFields = {
  name: string;
  month: string;
  state: string;
  summary: string;
};
export type MarketSimulationOverride = Partial<MarketSimulationFields> & { updatedAt?: string };

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr-FR");
}

function stateFromText(value: string): MarketSimulationState | null {
  const text = normalized(value);
  if (/non finalis|abandon|arret|stop/.test(text)) return "Non finalisée";
  const code = Number.parseInt(/^\s*(\d+)/.exec(text)?.[1] ?? "", 10);
  if (Number.isFinite(code)) {
    if (code === 0 || code === 3) return "En attente du fournisseur";
    if (code === 1) return "À faire";
    if (code === 2) return "En cours";
    if (code === 4 || code === 5) return "En attente du marché";
    if (code === 6 || code === 7) return "En attente de contrôle";
    if (code >= 8) return "Faite";
  }
  if (/controle.*(fait|termine|ok)|ctrl.*(fait|termine|ok)/.test(text)) return "Faite";
  if (/attente.*(controle|ctrl)|controle.*attente|ctrl.*attente/.test(text)) return "En attente de contrôle";
  if (/attente.*(cdm|client|marche)|retour.*(cdm|client|marche)|validation.*(cdm|client|marche)/.test(text)) return "En attente du marché";
  if (/attente.*fournisseur|retour.*fournisseur|tarif.*fournisseur.*attente/.test(text)) return "En attente du fournisseur";
  if (/simulation.*a faire|a simuler|non commence/.test(text)) return "À faire";
  if (/simulation.*en cours|traitement.*en cours/.test(text)) return "En cours";
  if (/clotur|complete|termine|fini/.test(text)) return "Faite";
  return null;
}

export function marketSimulationState(task: PlannerTask): MarketSimulationState {
  if (task.workflowState === "stopped") return "Non finalisée";
  if (task.workflowState === "completed" || task.checklist.some((item) => item.kind === "control" && Boolean(item.date))) return "Faite";
  const described = stateFromText([task.category, task.plannerStatus, task.goal].filter(Boolean).join(" · "));
  if (described) return described;
  const simulationDone = task.checklist.some((item) => item.kind === "simulation" && Boolean(item.date));
  const controlExpected = task.checklist.some((item) => item.kind === "control" && !item.nonApplicable);
  if (simulationDone && controlExpected) return "En attente de contrôle";
  if (simulationDone) return "En attente du marché";
  if (task.checklist.some((item) => item.kind === "trame" && Boolean(item.date))) return "En cours";
  return "À faire";
}

export function normalizeMarketSimulationState(value: string) {
  const current = MARKET_SIMULATION_STATES.find((state) => state === value.trim());
  return current ?? stateFromText(value) ?? (value.trim() || "À faire");
}

export function marketSimulationFields(task: PlannerTask): MarketSimulationFields {
  return {
    name: task.taskName,
    month: plannerTaskMonthLabel(task),
    state: marketSimulationState(task),
    summary: "",
  };
}

export function normalizeMarketSimulationOverride(value: unknown): MarketSimulationOverride {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const result: MarketSimulationOverride = {};
  (["name", "month", "state", "summary"] as const).forEach((key) => {
    if (typeof source[key] === "string") result[key] = source[key] as never;
  });
  if (typeof source.updatedAt === "string") result.updatedAt = source.updatedAt;
  return result;
}

export function resolveMarketSimulationFields(base: MarketSimulationFields, override: MarketSimulationOverride | undefined): MarketSimulationFields {
  return {
    name: override?.name ?? base.name,
    month: override?.month ?? base.month,
    state: override?.state ?? base.state,
    summary: override?.summary ?? base.summary,
  };
}

export function updateMarketSimulationOverride(base: MarketSimulationFields, current: MarketSimulationOverride | undefined, patch: Partial<MarketSimulationFields>, updatedAt = new Date().toISOString()) {
  const next: MarketSimulationOverride = { ...current };
  (Object.keys(patch) as (keyof MarketSimulationFields)[]).forEach((key) => {
    const value = patch[key];
    if (typeof value !== "string") return;
    if (value === base[key]) delete next[key];
    else next[key] = value as never;
  });
  const changed = (["name", "month", "state", "summary"] as const).some((key) => typeof next[key] === "string");
  if (changed) next.updatedAt = updatedAt;
  else delete next.updatedAt;
  return next;
}

export function hasMarketSimulationOverride(value: unknown) {
  const override = normalizeMarketSimulationOverride(value);
  return (["name", "month", "state", "summary"] as const).some((key) => typeof override[key] === "string");
}
