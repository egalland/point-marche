import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../lib/planner-registry.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const registry = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);

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
    labels: ["REV-PB"],
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

  const recovered = registry.recoverPlannerTasksFromPoints([{ marketId: "market", payload }], { market: ["REV-PB", "MEN-PB"] });
  const result = registry.mergePlannerTaskRegistry([importedTask("existing")], recovered);

  assert.equal(recovered.length, 2);
  assert.equal(result.tasks.length, 2);
  assert.equal(result.summary.recovered, 1);
  assert.equal(result.summary.enriched, 1);
  assert.equal(result.summary.usableVariations, 2);
  assert.equal(result.tasks.find((task) => task.externalId === "archived")?.effectiveMonth, "2026-06");
  assert.deepEqual(result.tasks.find((task) => task.externalId === "archived")?.labels, ["REV-PB", "MEN-PB"]);
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
          { taskId: "previous", taskName: "2026-07-JUILLET-CURRENT SUPPLIER", period: "2026-07", supplierCode: "S1000", globalVariation: 2.5, weightedVariation: 2.3, labels: ["REV-PB"] },
          { taskId: "current", taskName: "2026-08-AOUT-CURRENT SUPPLIER", period: "2026-08", supplierCode: "S1000", globalVariation: 3, weightedVariation: 2.8, labels: ["REV-PB"] },
        ],
      },
    }],
  };

  const recovered = registry.recoverPlannerTasksFromPoints([{ marketId: "market", payload }], { market: ["REV-PB"] });

  assert.deepEqual(recovered.map((task) => task.externalId).sort(), ["current", "previous"]);
  assert.equal(recovered.find((task) => task.externalId === "previous")?.metrics.weightedVariation, 2.3);
});

test("recovers per-simulation amounts without copying a later supplier amount into older records", () => {
  const payload = { operations: [{
    name: "2026-08-AOUT-EXAMPLE SUPPLIER", month: "Août 2026",
    plannerSource: {
      externalId: "current", metrics: { supplierCode: "S1000", purchases12m: 89613.02 },
      variationHistory: [
        { taskId: "previous", taskName: "2026-07-JUILLET-EXAMPLE SUPPLIER", period: "2026-07", supplierCode: "S1000", purchases12m: 473398.58 },
        { taskId: "current", period: "2026-08", supplierCode: "S1000", purchases12m: 89613.02 },
        { taskId: "legacy", period: "2026-06", supplierCode: "S1000" },
        { taskId: "zero", period: "2026-05", supplierCode: "S1000", purchases12m: 0 },
      ],
    },
  }] };
  const recovered = registry.recoverPlannerTasksFromPoints([{ marketId: "market", payload }], { market: ["REV-PB"] });
  const amounts = Object.fromEntries(recovered.map((task) => [task.externalId, task.metrics.purchases12m]));
  assert.deepEqual(amounts, { current: 89613.02, previous: 473398.58, legacy: null, zero: 0 });
  const imported = { ...importedTask("current"), metrics: { ...importedTask("current").metrics, purchases12m: 0 } };
  assert.equal(registry.mergePlannerTaskRegistry([imported], recovered).tasks.find((task) => task.externalId === "current").metrics.purchases12m, 0);
});
