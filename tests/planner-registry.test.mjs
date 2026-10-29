import assert from "node:assert/strict";
import test from "node:test";
import { moduleUrl } from "./helpers/module-url.mjs";
const registry = await import(moduleUrl("../../lib/planner-registry.ts"));

function importedTask(externalId) {
  return {
    externalId,
    taskName: "2026-07-JUILLET-EXISTING SUPPLIER",
    effectiveMonth: "2026-07",
    category: "",
    goal: "",
    plannerStatus: "",
    priority: "",
    assignedTo: "",
    createdBy: "",
    createdAt: "",
    dueDate: "",
    startDate: "",
    recurring: false,
    overdue: false,
    completedAt: "",
    completedBy: "",
    checklistCompleted: 0,
    checklistTotal: 0,
    checklist: [],
    labels: ["TEST-A"],
    comments: "",
    metrics: { purchases12m: null, supplierCode: "E1000", announcedVariation: null, globalVariation: null, weightedVariation: null, tariffStructure: "" },
    workflowState: "active",
  };
}

test("recovers point simulations and deduplicates them with the Planner registry", () => {
  const payload = {
    operations: [
      {
        id: "planner:archived",
        name: "2026-06-JUIN-ARCHIVED SUPPLIER",
        month: "Juin 2026",
        state: "Clôturée",
        plannerSource: {
          externalId: "archived",
          metrics: { purchases12m: 120000, supplierCode: "A1000", announcedVariation: null, globalVariation: 4.5, weightedVariation: 4.2, tariffStructure: "PAB" },
        },
      },
      {
        id: "planner:existing",
        name: "2026-07-JUILLET-EXISTING SUPPLIER",
        month: "Juillet 2026",
        state: "En cours",
        plannerSource: {
          externalId: "existing",
          metrics: { purchases12m: null, supplierCode: "E1000", announcedVariation: null, globalVariation: 3.1, weightedVariation: 2.9, tariffStructure: "" },
        },
      },
    ],
  };

  const recovered = registry.recoverPlannerTasksFromPoints([{ marketId: "market", payload }], { market: ["TEST-A", "TEST-B"] });
  const result = registry.mergePlannerTaskRegistry([importedTask("existing")], recovered);

  assert.equal(recovered.length, 2);
  assert.equal(result.tasks.length, 2);
  assert.equal(result.summary.recovered, 1);
  assert.equal(result.summary.enriched, 1);
  assert.equal(result.summary.usableVariations, 2);
  assert.equal(result.tasks.find((task) => task.externalId === "archived")?.effectiveMonth, "2026-06");
  assert.deepEqual(result.tasks.find((task) => task.externalId === "archived")?.labels, ["TEST-A", "TEST-B"]);
  assert.equal(result.tasks.find((task) => task.externalId === "existing")?.metrics.globalVariation, 3.1);
});

test("recovers historical variation series kept inside a saved point", () => {
  const payload = {
    operations: [{
      name: "2026-08-AOUT-CURRENT SUPPLIER",
      month: "Août 2026",
      state: "En cours",
      plannerSource: {
        externalId: "current",
        metrics: { supplierCode: "S1000", globalVariation: 3, weightedVariation: 2.8 },
        variationHistory: [
          { taskId: "previous", taskName: "2026-07-JUILLET-CURRENT SUPPLIER", period: "2026-07", supplierCode: "S1000", globalVariation: 2.5, weightedVariation: 2.3, labels: ["TEST-A"] },
          { taskId: "current", taskName: "2026-08-AOUT-CURRENT SUPPLIER", period: "2026-08", supplierCode: "S1000", globalVariation: 3, weightedVariation: 2.8, labels: ["TEST-A"] },
        ],
      },
    }],
  };

  const recovered = registry.recoverPlannerTasksFromPoints([{ marketId: "market", payload }], { market: ["TEST-A"] });

  assert.deepEqual(recovered.map((task) => task.externalId).sort(), ["current", "previous"]);
  assert.equal(recovered.find((task) => task.externalId === "previous")?.metrics.weightedVariation, 2.3);
});

test("recovers per-simulation amounts without copying a later supplier amount into older records", () => {
  const payload = { operations: [{
    name: "2026-08-AOUT-EXAMPLE SUPPLIER", month: "Août 2026",
    plannerSource: {
      externalId: "current", metrics: { supplierCode: "S1000", purchases12m: 23456.12 },
      variationHistory: [
        { taskId: "previous", taskName: "2026-07-JUILLET-EXAMPLE SUPPLIER", period: "2026-07", supplierCode: "S1000", purchases12m: 123456.78 },
        { taskId: "current", period: "2026-08", supplierCode: "S1000", purchases12m: 23456.12 },
        { taskId: "legacy", period: "2026-06", supplierCode: "S1000" },
        { taskId: "zero", period: "2026-05", supplierCode: "S1000", purchases12m: 0 },
      ],
    },
  }] };
  const recovered = registry.recoverPlannerTasksFromPoints([{ marketId: "market", payload }], { market: ["TEST-A"] });
  const amounts = Object.fromEntries(recovered.map((task) => [task.externalId, task.metrics.purchases12m]));
  assert.deepEqual(amounts, { current: 23456.12, previous: 123456.78, legacy: null, zero: 0 });
  const imported = { ...importedTask("current"), metrics: { ...importedTask("current").metrics, purchases12m: 0 } };
  assert.equal(registry.mergePlannerTaskRegistry([imported], recovered).tasks.find((task) => task.externalId === "current").metrics.purchases12m, 0);
});

test("repairs the month of an already imported reversed Supplier-Alpha title on read", () => {
  const supplierAlpha={...importedTask('iso-avr'),taskName:'2026-AVRIL-04-SUPPLIER-ALPHA',effectiveMonth:'',metrics:{purchases12m:345678.12,supplierCode:'F0001',announcedVariation:null,globalVariation:5,weightedVariation:5,tariffStructure:'Brut + Remise au SKU'}};
  const result=registry.mergePlannerTaskRegistry([supplierAlpha],[]);
  assert.equal(result.tasks[0].effectiveMonth,'2026-04');
  assert.equal(result.tasks[0].metrics.globalVariation,5);
  assert.equal(result.tasks[0].metrics.weightedVariation,5);
  assert.equal(result.summary.withoutMonth,0);
  assert.equal(supplierAlpha.effectiveMonth,'');
});

test("repairs an already imported SUPPLIER-EPSILON rate from its notes without mutating the saved payload", () => {
  const supplierEpsilon = { ...importedTask("supplierEpsilon"), taskName: "2026-03-MARS-SUPPLIER-EPSILON", effectiveMonth: "2026-03", comments: "Code Fournisseur : F0006\nVariation GLOBAL :\n1234 -1.43%\nAGENCES -0.12%\nPONDERE AU CA -1.69%\nStructure tarifaire :", metrics: { purchases12m: null, supplierCode: "F0006", announcedVariation: null, globalVariation: 1234, weightedVariation: null, tariffStructure: "" } };
  const result = registry.mergePlannerTaskRegistry([supplierEpsilon], []);
  assert.equal(result.tasks[0].metrics.globalVariation, -1.43);
  assert.equal(result.tasks[0].metrics.weightedVariation, -1.69);
  assert.equal(supplierEpsilon.metrics.globalVariation, 1234);
  const noNotes = { ...supplierEpsilon, comments: "", metrics: { ...supplierEpsilon.metrics, globalVariation: -2 } };
  assert.equal(registry.mergePlannerTaskRegistry([noNotes], []).tasks[0].metrics.globalVariation, -2);
});
