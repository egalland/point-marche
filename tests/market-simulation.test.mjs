import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

const bundled = await build({ entryPoints: ["lib/market-simulation.ts"], bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent" });
const simulation = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);

function task(category, checklist = [], workflowState = "active") {
  return {
    externalId: "one", taskName: "FOURNISSEUR TEST", effectiveMonth: "2026-09", category, goal: "", plannerStatus: "", priority: "", assignedTo: "", createdBy: "", createdAt: "", dueDate: "", startDate: "", recurring: false, overdue: false, completedAt: "", completedBy: "", checklistCompleted: 0, checklistTotal: checklist.length, checklist, labels: [], comments: "", metrics: { purchases12m: null, supplierCode: "", announcedVariation: null, globalVariation: null, weightedVariation: null, tariffStructure: "" }, workflowState,
  };
}

test("reduces the Planner workflow to the market-point business state", () => {
  assert.equal(simulation.marketSimulationState(task("0-Avis de Hausse reçu -Attente Tarif fournisseur")), "En attente du fournisseur");
  assert.equal(simulation.marketSimulationState(task("1-Tarif FRN reçu -Simulation à faire")), "À faire");
  assert.equal(simulation.marketSimulationState(task("2-Simulation en cours")), "En cours");
  assert.equal(simulation.marketSimulationState(task("4-Attente retour ou validation CDM")), "En attente du marché");
  assert.equal(simulation.marketSimulationState(task("6-SIMULATION injecté - Attente contrôle ERP")), "En attente de contrôle");
  assert.equal(simulation.marketSimulationState(task("11-Evolution non finalisée")), "Non finalisée");
});

test("a completed control makes the simulation done", () => {
  const checklist = [{ order: 1, label: "Contrôle ERP", date: "2026-09-04", kind: "control", analystName: "", nonApplicable: false }];
  assert.equal(simulation.marketSimulationState(task("2-Simulation en cours", checklist)), "Faite");
});

test("point overrides survive a refreshed imported value and can be reset", () => {
  const base = { name: "A", month: "Septembre 2026", state: "En cours", summary: "" };
  const override = simulation.updateMarketSimulationOverride(base, undefined, { state: "En attente du fournisseur" }, "2026-09-04T12:00:00Z");
  const refreshed = { ...base, state: "En attente de contrôle" };
  assert.equal(simulation.resolveMarketSimulationFields(refreshed, override).state, "En attente du fournisseur");
  assert.equal(simulation.hasMarketSimulationOverride(override), true);
  const reset = simulation.updateMarketSimulationOverride(refreshed, override, { state: refreshed.state });
  assert.equal(simulation.hasMarketSimulationOverride(reset), false);
});
