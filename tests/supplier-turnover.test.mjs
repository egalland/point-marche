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
  assert.equal(normal(formatSupplierTurnover(123456.78)), "123 456,78 €");
  assert.equal(normal(formatSupplierTurnover(23456.12)), "23 456,12 €");
  assert.equal(normal(formatSupplierTurnover(0)), "0,00 €");
  assert.equal(normal(formatSupplierTurnover(-12.34)), "-12,34 €");
  for (const missing of [null, undefined, NaN, Infinity]) assert.equal(formatSupplierTurnover(missing), "—");
});

test("sorts amounts numerically with absent values last in either direction", () => {
  const values = [null, 100, 9, 0, 123456.78, NaN];
  const asc = values.slice().sort((a, b) => compareSupplierTurnover(a, b, "asc"));
  const desc = values.slice().sort((a, b) => compareSupplierTurnover(a, b, "desc"));
  assert.deepEqual(asc.slice(0, 4), [0, 9, 100, 123456.78]);
  assert.deepEqual(desc.slice(0, 4), [123456.78, 100, 9, 0]);
  assert.equal(asc[4], null);
  assert.equal(desc[4], null);
});

test("shows the source period and the same amount in the card and exports", () => {
  for (const html of [renderToStaticMarkup(createElement(SupplierTurnover, { value: 123456.78 })), supplierTurnoverHtml(123456.78)]) {
    assert.match(html, /CA fournisseur · 12 mG/);
    assert.match(html, /Achats 12 mG/);
    assert.match(html, /Aucun cumul/);
    assert.match(normal(html), /123 456,78 €/);
  }
});

test("shows CA for an individual curve observation but not for a monthly aggregate", () => {
  const observation = { taskId: "sim", taskName: "Simulation exemple", supplierKey: "F1000", supplierLabel: "Fournisseur exemple", supplierCode: "F1000", period: "2026-08", globalVariation: 3, weightedVariation: 2.8, labels: [] };
  const detail = renderToStaticMarkup(createElement(SupplierVariationChart, { points: [{ ...observation, purchases12m: 23456.12 }] }));
  const monthly = renderToStaticMarkup(createElement(SupplierVariationChart, { points: [observation] }));
  assert.match(normal(detail), /23 456,12 €/);
  assert.doesNotMatch(monthly, /CA · 12 mG|€/);
});
