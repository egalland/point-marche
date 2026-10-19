import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { moduleUrl, sourceUrl } from "./helpers/module-url.mjs";
import { reactImports, paginationUrl, supplierChartUrl } from "./helpers/ui-modules.mjs";

const { tablePage } = await import(moduleUrl("../../lib/table-page.ts"));
const { groupAnalystActivities } = await import(moduleUrl("../../lib/analyst-activity-groups.ts"));
const { TablePagination } = await import(paginationUrl);
const { SupplierVariationChart, SupplierVariationDashboard } = await import(supplierChartUrl);

test("paginates a 12,491 row table without gaps or duplicate rows", () => {
  const seen = [];
  for (let page = 1; page <= 125; page++) {
    const state = tablePage(12491, page);
    for (let index = state.start; index < state.end; index++) seen.push(index);
  }
  assert.deepEqual(seen, Array.from({ length: 12491 }, (_, index) => index));
  assert.deepEqual(tablePage(0, 5), { page: 1, pages: 1, start: 0, end: 0, total: 0 });
  assert.equal(tablePage(12, 5).page, 1);
  assert.equal(tablePage(1000, -1).page, 1);
  assert.equal(tablePage(1000, NaN).page, 1);
  const html = renderToStaticMarkup(createElement(TablePagination, { ...tablePage(12491, 125), onPageChange() {} }));
  assert.match(html, /12401–12491/);
  assert.match(html, /Page 125 \/ 125/);
  assert.match(html, /disabled="" aria-label="Page suivante"/);
});

test("groups activities in one pass and retains each simulation amount without adding it", () => {
  const contributions = [
    { taskId: "one", taskName: "Simulation exemple", date: "2026-08-25", purchases12m: 89613.02, specialty: "simulation" },
    { taskId: "two", taskName: "Autre simulation", date: "2026-08-27", purchases12m: 0, specialty: "simulation" },
    { taskId: "one", taskName: "Simulation exemple", date: "2026-08-26", purchases12m: 89613.02, specialty: "control" },
  ];
  const expected = Array.from(new Map(contributions.map((item) => [item.taskId, { taskId: item.taskId, taskName: item.taskName, purchases12m: item.purchases12m, date: item.date, activities: contributions.filter((candidate) => candidate.taskId === item.taskId) }])).values()).sort((a, b) => b.date.localeCompare(a.date));
  assert.deepEqual(groupAnalystActivities(contributions), expected);
  const volume = Array.from({ length: 20000 }, (_, index) => ({ ...contributions[0], taskId: String(index % 5000) }));
  const grouped = groupAnalystActivities(volume);
  assert.equal(grouped.length, 5000);
  assert.ok(grouped.every((item) => item.activities.length === 4 && item.purchases12m === 89613.02));
});

test("supplier chart exposes keyboard navigation, toggles, and bounded labels", () => {
  const points = Array.from({ length: 60 }, (_, index) => ({
    taskId: String(index), supplierKey: "example", supplierLabel: "Exemple", taskName: "Simulation exemple", supplierCode: "F0001",
    period: `${2022 + Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, "0")}`, globalVariation: index % 4, weightedVariation: index % 3, labels: [],
  }));
  const html = renderToStaticMarkup(createElement(SupplierVariationChart, { points }));
  assert.match(html, /tabindex="0"/);
  assert.match(html, /flèches gauche et droite/);
  assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 2);
  assert.ok((html.match(/<text /g) ?? []).length <= points.length * 3 + 6);
  assert.match(html, /supplier-column-scroll/);
  assert.match(html, /supplier-column-summary/);
  const compact = renderToStaticMarkup(createElement(SupplierVariationChart, { points, compact: true }));
  assert.doesNotMatch(compact, /tabindex=|<button/);
});

test("supplier table renders only a page but keeps its full dataset in the statistics", () => {
  const period = new Date().toISOString().slice(0, 7);
  const tasks = Array.from({ length: 520 }, (_, index) => ({ externalId: String(index), taskName: `${period}-Exemple ${index}`, effectiveMonth: period, labels: [], metrics: { supplierCode: `F${index}`, purchases12m: 100, globalVariation: 4, weightedVariation: 3 } }));
  const html = renderToStaticMarkup(createElement(SupplierVariationDashboard, { tasks, markets: [], registry: { imported: 520, recovered: 0, usableVariations: 520, withoutVariation: 0, withoutMonth: 0 } }));
  const tbody = html.match(/<tbody>(.*?)<\/tbody>/s)?.[1];
  assert.equal((tbody.match(/<tr/g) ?? []).length, 100);
  assert.match(html, />520 observations</);
  assert.match(html, /1–100 sur 520 lignes/);
  assert.match(html, /aria-haspopup="dialog"/);
  assert.match(html, /aria-sort="descending"/);
});

test("analyst table pagination does not truncate KPI totals", async () => {
  const contribution = { taskId: "task", taskName: "Simulation exemple", purchases12m: 0, date: "2026-08-25", analystName: "Jane DOE", marketIds: [], marketTags: [], specialty: "simulation", stepLabel: "Simulation" };
  const statsUrl = sourceUrl(`export function buildAnalystStats(){return {totalActivities:12491,distinctTasks:12491,simulations:12491,controls:0,coverageRate:1,movement:0,previousTotal:0,previousContributions:[],monthly:[],byAnalyst:[],delaySummaries:[],delaySamples:[],unmatchedNames:[],contributions:Array.from({length:12491},(_,index)=>({...${JSON.stringify(contribution)},taskId:String(index)}))}}`);
  const { AnalystStatsDashboard } = await import(moduleUrl("../../features/market-pulse/analyst-stats-dashboard.tsx", {
    ...reactImports,
    "./purchaseData-dashboard": sourceUrl("export function PURCHASESDashboard(){return null;}"),
    "@/lib/analyst-stats": statsUrl,
    "@/lib/supplier-turnover": moduleUrl("../../lib/supplier-turnover.ts"),
    "@/components/table-pagination": paginationUrl,
    "./planner-import-dialog": sourceUrl("export function PlannerImportDialog(){ return null; }"),
    "./supplier-variation-dashboard": supplierChartUrl,
    "./activity-period-comparison": moduleUrl("../../features/market-pulse/activity-period-comparison.tsx", reactImports),
    "./simulation-comparison": sourceUrl("export function SimulationComparison(){return null;}"),
    "@/lib/simulation-comparison": sourceUrl("export function defaultComparison(){return {metric:\"count\"};}"),
  }));
  const html = renderToStaticMarkup(createElement(AnalystStatsDashboard, { tasks: [], users: [], markets: [], registry: {}, updatedAt: "", onImport() {} }));
  const tbody = [...html.matchAll(/<tbody>(.*?)<\/tbody>/gs)].at(-1)?.[1];
  assert.equal((tbody.match(/<tr/g) ?? []).length, 100);
  assert.match(html, />12491 activités dans la sélection</);
  assert.match(html, />12491<\/strong>/);
  assert.match(html, /Page 1 \/ 125/);
});
