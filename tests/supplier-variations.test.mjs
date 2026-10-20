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

test("monthly columns span a rolling year and preserve gaps and real zeros", () => {
  const points = variations.buildSupplierVariations([
    task("a", "2025-11", "ALPHA", "A", -2, null),
    task("b", "2025-11", "BETA", "B", 0, 4),
    task("c", "2026-10", "ALPHA", "A", .9, 1.52),
  ]);
  const result = variations.aggregateMonthlyVariations(points, "2025-11-01", "2026-10-15");
  assert.equal(result.length, 12);
  assert.equal(result[0].period, "2025-11");
  assert.equal(result.at(-1).period, "2026-10");
  assert.equal(result[0].globalVariation, -1);
  assert.equal(result[0].weightedVariation, 4);
  assert.equal(result[1].globalVariation, null);
  assert.equal(result[1].weightedVariation, null);
  assert.equal(variations.aggregateMonthlyVariations(points, "2026-11-01", "2026-10-01").length, 0);
  assert.equal(variations.aggregateMonthlyVariations([], "2026-01-01", "2026-03-01").length, 3);
});

test("column scale always includes zero and bounds every visible value", () => {
  for (const values of [[], [0, 0], [-8, -1], [3, 4], [-2, 4], [.9, 1.52]]) {
    const scale = variations.variationColumnScale(values);
    assert(scale.ticks.includes(0));
    assert(scale.max > scale.min);
    assert(scale.min <= Math.min(0, ...values));
    assert(scale.max >= Math.max(0, ...values));
    assert(scale.ticks.every(Number.isFinite));
  }
});

test("supplier search matches accented names and codes without losing the all option", () => {
  const suppliers = [
    { key: "a", label: "Établissements Chêne", code: "F0123" },
    { key: "b", label: "Bois du Nord", code: "F0456" },
  ];
  assert.equal(variations.filterSupplierOptions(suppliers, "").length, 3);
  assert.equal(variations.filterSupplierOptions(suppliers, "")[0].key, "all");
  assert.deepEqual(variations.filterSupplierOptions(suppliers, "chene f0123").map((s) => s.key), ["a"]);
  assert.deepEqual(variations.filterSupplierOptions(suppliers, "0456").map((s) => s.key), ["b"]);
  assert.deepEqual(variations.filterSupplierOptions(suppliers, "introuvable"), []);
});

test("supplier month keeps V2 instead of averaging the original and its revision", () => {
  const original = {...task("placo-v1", "2025-11", "PLACOPLATRE", "B7795", -2.63, 3), checklist:[{label:"Intégration",date:"2025-10-15"}]};
  const revised = {...task("placo-v2", "2025-11", "PLACOPLATRE V2", "B7795", -11.46, null), checklist:[{label:"Intégration",date:"2025-11-03"}]};
  for (const tasks of [[original, revised], [revised, original]]) {
    const points = variations.buildSupplierVariations(tasks);
    assert.equal(points.length, 2);
    const retained = variations.latestSupplierVariations(points);
    assert.equal(retained[0].taskId, "placo-v2");
    assert.equal(retained[0].globalVariation, -11.46);
    assert.equal(retained[0].weightedVariation, null);
    assert.equal(variations.averageVariation(points, "globalVariation"), -11.46);
    const monthly = variations.aggregateMonthlyVariations(points, "2025-11-01", "2025-11-30");
    assert.equal(monthly[0].globalVariation, -11.46);
    assert.equal(monthly[0].weightedVariation, null);
  }
});

test("latest integration date resolves same-month records and suppliers stay separate", () => {
  const old = {...task("old", "2025-11", "ALPHA", "A", 2, 3), integratedAt:"2025-10-01",createdAt:"2025-10-05"};
  const latest = {...task("new", "2025-11", "ALPHA", "A", 6, 0), integratedAt:"2025-10-10",createdAt:"2025-09-01"};
  const other = task("other", "2025-11", "BETA", "B", 10, 2);
  const points = variations.buildSupplierVariations([latest,old,other]);
  assert.equal(points.length,3);
  assert.equal(variations.latestSupplierVariations(points).find(p=>p.supplierKey==='A').taskId,'new');
  assert.equal(variations.aggregateMonthlyVariations(points,'2025-11-01','2025-11-30')[0].globalVariation,8);
  assert.equal(variations.aggregateMonthlyVariations(points,'2025-11-01','2025-11-30')[0].weightedVariation,1);
});

test("creation/import chronology and legacy ordering break ties without changing other months", () => {
  const a={...task('a','2026-01','ALPHA','A',2,1),createdAt:'2025-10-01'};
  const b={...task('b','2026-01','ALPHA','A',4,2),createdAt:'2025-10-02'};
  const feb=task('feb','2026-02','ALPHA','A',7,3);
  assert.deepEqual(variations.latestSupplierVariations(variations.buildSupplierVariations([b,a,feb])).map(p=>p.taskId),['b','feb']);
  assert.equal(variations.latestSupplierVariations(variations.buildSupplierVariations([{...a,createdAt:'',importedAt:'2026-01-01T12:00:00Z'},{...b,createdAt:'',importedAt:'2026-01-01T11:00:00Z'}]))[0].taskId,'a');
});

test("integration date beats revision name, creation, completion and import dates", () => {
  const v2={...task('v2','2025-11','ALPHA V2','A',1,2),createdAt:'2025-11-20',completedAt:'2025-12-01',importedAt:'2026-10-15',checklist:[{label:'Intégration',date:'2025-10-20'}]};
  const integratedLater={...task('later','2025-11','ALPHA','A',5,0),createdAt:'2025-09-01',checklist:[{label:'Intégration',date:'2025-11-03'}]};
  for(const tasks of [[v2,integratedLater],[integratedLater,v2]]){
    const points=variations.latestSupplierVariations(variations.buildSupplierVariations(tasks));
    assert.equal(points.length,1);assert.equal(points[0].taskId,'later');assert.equal(points[0].integratedAt,'2025-11-03');assert.equal(points[0].weightedVariation,0);
  }
});

test("a later blank profile does not erase the available variation for January", () => {
  const old={...task('old','2026-01','PLACOPLATRE','B7795',1.45,null),integratedAt:'2025-11-24'};
  const recent={...task('new','2026-01','PLACOPLATRE PROFILES','B7795',null,null),integratedAt:'2025-12-02'};
  const raw=variations.buildSupplierVariations([old,recent]);
  assert.equal(raw.length,1);
  assert.equal(variations.aggregateMonthlyVariations(raw,'2026-01-01','2026-01-31')[0].globalVariation,1.45);
});

test("reversed Isover title keeps a clean supplier label", () => {
  assert.equal(variations.supplierLabelFromTask('2026-AVRIL-04-ISOVER'),'ISOVER');
  assert.equal(variations.supplierLabelFromTask('2026-04-AVRIL-ISOVER'),'ISOVER');
});

test("history view keeps calendar months empty or only the observations, including zero", () => {
  const points=variations.buildSupplierVariations([
    task('jan','2026-01','ALPHA','A',2,null),
    task('apr','2026-04','ALPHA','A',0,5),
    task('may','2026-05','ALPHA','A',null,3),
  ]);
  const calendar=variations.supplierVariationView(points,'months');
  assert.deepEqual(calendar.map(p=>p.period),['2026-01','2026-02','2026-03','2026-04','2026-05']);
  assert.equal(calendar[1].globalVariation,null);assert.equal(calendar[1].weightedVariation,null);
  assert.equal(calendar[3].globalVariation,0);
  assert.deepEqual(variations.supplierVariationView(points,'variations',true,false).map(p=>p.period),['2026-01','2026-04']);
  assert.deepEqual(variations.supplierVariationView(points,'variations',false,true).map(p=>p.period),['2026-04','2026-05']);
  assert.equal(variations.supplierVariationView(points,'variations',false,false).length,0);
  assert.equal(variations.supplierVariationView([],'months').length,0);
});
