import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function transpile(path) {
  return ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}

const variationsUrl = `data:text/javascript;base64,${Buffer.from(transpile("../lib/supplier-variations.ts")).toString("base64")}`;
const enrichmentSource = transpile("../lib/point-planner-enrichment.ts").replace('from "./supplier-variations"', `from "${variationsUrl}"`);
const enrichment = await import(`data:text/javascript;base64,${Buffer.from(enrichmentSource).toString("base64")}`);

function task(externalId, effectiveMonth, globalVariation, weightedVariation) {
  return {
    externalId,
    taskName: `${effectiveMonth}-FOURNISSEUR TEST`,
    effectiveMonth,
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
    metrics: { purchases12m: null, supplierCode: "F1000", announcedVariation: null, globalVariation, weightedVariation, tariffStructure: "" },
    workflowState: "active",
  };
}

test("enriches an archived point with the supplier variation history", () => {
  const payload = {
    operations: [{
      id: "planner:august",
      name: "2026-08-AOUT-FOURNISSEUR TEST",
      plannerSource: {
        externalId: "august",
        metrics: { supplierCode: "F1000", globalVariation: null, weightedVariation: null },
      },
    }],
  };

  const result = enrichment.enrichPointPlannerHistory(payload, [
    task("july", "2026-07", 2.5, 2.2),
    task("august", "2026-08", 3.1, 2.8),
  ]);

  assert.equal(result.operations[0].plannerSource.metrics.globalVariation, 3.1);
  assert.deepEqual(result.operations[0].plannerSource.variationHistory.map((point) => point.period), ["2026-07", "2026-08"]);
  assert.equal(result.operations[0].plannerSource.supplierLabel, "FOURNISSEUR TEST");
});
