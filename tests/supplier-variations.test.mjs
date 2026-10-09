import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../lib/supplier-variations.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const variations = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);

function task(id, period, name, supplierCode, globalVariation, weightedVariation) {
  return {
    externalId: id,
    taskName: `${period}-MOIS-${name}`,
    effectiveMonth: period,
    labels: ["REV-PB"],
    metrics: { supplierCode, globalVariation, weightedVariation },
  };
}

test("groups supplier history by code and keeps missing values missing", () => {
  const tasks = [
    task("one", "2026-05", "JOHN INDUSTRY", "A1234", 2.5, 2.1),
    task("two", "2026-06", "JOHN INDUSTRY RENAMED", "A1234", 3.2, null),
    task("three", "2026-07", "JANE FLOOR", "B5678", null, 1.8),
  ];
  const points = variations.buildSupplierVariations(tasks);
  const history = variations.supplierSeriesForTask(tasks[0], tasks);

  assert.equal(points.length, 3);
  assert.equal(history.length, 2);
  assert.deepEqual(history.map((point) => point.period), ["2026-05", "2026-06"]);
  assert.equal(history[1].weightedVariation, null);
  assert.equal(variations.averageVariation(history, "weightedVariation"), 2.1);
});

test("uses the normalized task supplier when no supplier code exists", () => {
  const item = task("one", "2026-08", "NEUTRAL SUPPLIER", "", 4, 3.7);
  assert.equal(variations.supplierLabelFromTask(item.taskName), "NEUTRAL SUPPLIER");
  assert.equal(variations.supplierKeyForTask(item), "neutral supplier");
});

test("preserves the amount for each observation rather than a supplier total", () => {
  const amounts = [473398.58, 89613.02, 0, null];
  const tasks = amounts.map((purchases12m, index) => {
    const item = task(`sim-${index}`, `2026-0${index + 5}`, "JOHN INDUSTRY", "A1234", 3, 2.8);
    return { ...item, metrics: { ...item.metrics, purchases12m } };
  });
  assert.deepEqual(variations.supplierSeriesForTask(tasks[0], tasks).map((point) => point.purchases12m), amounts);
});
