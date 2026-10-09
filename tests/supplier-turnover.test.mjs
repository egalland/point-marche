import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { moduleUrl } from "./helpers/module-url.mjs";
import { supplierChartUrl } from "./helpers/ui-modules.mjs";

const turnoverUrl = moduleUrl("../../lib/supplier-turnover.ts");
const { formatSupplierTurnover, compareSupplierTurnover, supplierTurnoverHtml } = await import(turnoverUrl);
const reactImports = { react: import.meta.resolve("react"), "react/jsx-runtime": import.meta.resolve("react/jsx-runtime") };
const { SupplierTurnover } = await import(moduleUrl("../../components/supplier-turnover.tsx", { ...reactImports, "@/lib/supplier-turnover": turnoverUrl }));
const { SupplierVariationChart } = await import(supplierChartUrl);
const normal = (value) => value.replace(/[\u00a0\u202f]/g, " ");

test("formats one imported amount with cents and distinguishes zero from missing", () => {
  assert.equal(normal(formatSupplierTurnover(473398.58)), "473 398,58 €");
  assert.equal(normal(formatSupplierTurnover(89613.02)), "89 613,02 €");
  assert.equal(normal(formatSupplierTurnover(0)), "0,00 €");
  assert.equal(normal(formatSupplierTurnover(-12.34)), "-12,34 €");
  for (const missing of [null, undefined, NaN, Infinity]) assert.equal(formatSupplierTurnover(missing), "—");
});

test("sorts amounts numerically with absent values last in either direction", () => {
  const values = [null, 100, 9, 0, 473398.58, NaN];
  const asc = values.slice().sort((a, b) => compareSupplierTurnover(a, b, "asc"));
  const desc = values.slice().sort((a, b) => compareSupplierTurnover(a, b, "desc"));
  assert.deepEqual(asc.slice(0, 4), [0, 9, 100, 473398.58]);
  assert.deepEqual(desc.slice(0, 4), [473398.58, 100, 9, 0]);
  assert.equal(asc[4], null);
  assert.equal(desc[4], null);
});

test("shows the source period and the same amount in the card and exports", () => {
  for (const html of [renderToStaticMarkup(createElement(SupplierTurnover, { value: 473398.58 })), supplierTurnoverHtml(473398.58)]) {
    assert.match(html, /CA fournisseur · 12 mG/);
    assert.match(html, /Achats 12 mG/);
    assert.match(html, /Aucun cumul/);
    assert.match(normal(html), /473 398,58 €/);
  }
});

test("shows CA for an individual curve observation but not for a monthly aggregate", () => {
  const observation = { taskId: "sim", taskName: "Simulation exemple", supplierKey: "F1000", supplierLabel: "Fournisseur exemple", supplierCode: "F1000", period: "2026-08", globalVariation: 3, weightedVariation: 2.8, labels: [] };
  const detail = renderToStaticMarkup(createElement(SupplierVariationChart, { points: [{ ...observation, purchases12m: 89613.02 }] }));
  const monthly = renderToStaticMarkup(createElement(SupplierVariationChart, { points: [observation] }));
  assert.match(normal(detail), /89 613,02 €/);
  assert.doesNotMatch(monthly, /CA · 12 mG|€/);
});
