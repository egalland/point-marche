import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import postcss from "postcss";
import { moduleUrl, sourceUrl } from "./helpers/module-url.mjs";
import { miniTrendUrl, supplierChartUrl, reactImports, dialogUrl, safeDateUrl, paginationUrl } from "./helpers/ui-modules.mjs";

const { supplierMiniTrend } = await import(miniTrendUrl);
const { SupplierSparkline, SupplierVariationChart } = await import(supplierChartUrl);
const { contrastRatio } = await import(moduleUrl("../../lib/color-contrast.ts"));
const observation = (period, globalVariation, weightedVariation = null) => ({
  taskId: `example:${period}`, taskName: "Simulation exemple", supplierKey: "F0001",
  supplierCode: "F0001", supplierLabel: "Fournisseur exemple", period, globalVariation, weightedVariation, labels: [],
});

test("miniature is a fixed 120 by 36 SVG without the detailed chart machinery", () => {
  const points = [observation("2026-07", 4), observation("2026-08", 3), observation("2026-09", 2)];
  for (const html of [
    renderToStaticMarkup(createElement(SupplierVariationChart, { points, compact: true })),
    renderToStaticMarkup(createElement(SupplierSparkline, { points, label: "Fournisseur exemple" })),
  ]) {
    assert.match(html, /width="120" height="36" viewBox="0 0 120 36"/);
    assert.equal((html.match(/<svg /g) ?? []).length, 1);
    assert.doesNotMatch(html, /supplier-chart-stage|supplier-chart-grid|supplier-chart-cursor|supplier-chart-tooltip|supplier-chart-toggles|<text|<line |role="dialog"/);
  }
  const card = renderToStaticMarkup(createElement(SupplierSparkline, { points, label: "Fournisseur exemple" }));
  assert.match(card, /Variation GLOBAL/);
  assert.match(card, /-1 pt vs août 26/);
  assert.doesNotMatch(card, /-1 %/);
  assert.match(card, /aria-haspopup="dialog" aria-expanded="false"/);
  assert.match(card, /Fournisseur exemple · Variation GLOBAL 2 %/);
});

test("one observation renders an honest dot and zero remains a valid flat line", () => {
  const single = supplierMiniTrend([observation("2026-08", 3)]);
  assert.deepEqual(single.paths, []);
  assert.deepEqual(single.dots, [{ x: 60, y: 18 }]);
  assert.equal(single.delta, null);
  const zero = supplierMiniTrend([observation("2026-07", 0), observation("2026-08", 0)]);
  assert.equal(zero.value, 0);
  assert.equal(zero.delta, 0);
  assert.deepEqual(zero.paths, ["M3.00,18.00 L117.00,18.00"]);
  assert.deepEqual(zero.dots, []);
  assert.equal(renderToStaticMarkup(createElement(SupplierSparkline, { points: [], label: "Exemple" })), "");
});

test("missing observations are not zero-filled or connected to a different series", () => {
  const interrupted = supplierMiniTrend([
    observation("2026-06", 3, 30), observation("2026-07", 2, 20),
    observation("2026-08", null, 10), observation("2026-09", 4, 40),
  ]);
  assert.equal(interrupted.series, "globalVariation");
  assert.equal(interrupted.paths.length, 1);
  assert.equal(interrupted.dots.length, 1);
  assert.equal(interrupted.delta, null);
  const weighted = supplierMiniTrend([observation("2026-08", 5, 3), observation("2026-09", null, 2)]);
  assert.equal(weighted.series, "weightedVariation");
  assert.equal(weighted.label, "Pondérée");
  assert.equal(weighted.value, 2);
  assert.equal(weighted.delta, -1);
  const invalid = supplierMiniTrend([observation("2026-08", Infinity, NaN)]);
  assert.equal(invalid.value, null);
  assert.equal(invalid.delta, null);
  assert.deepEqual(invalid.paths, []);
  assert.deepEqual(invalid.dots, []);
});

test("large histories keep every observation inside the miniature bounds", () => {
  const points = Array.from({ length: 12491 }, (_, index) => observation("2026-08", Math.sin(index) * 20));
  const trend = supplierMiniTrend(points);
  assert.equal(trend.paths.length, 1);
  const coordinates = [...trend.paths[0].matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)];
  assert.equal(coordinates.length, points.length);
  for (const [, x, y] of coordinates) {
    assert.ok(Number(x) >= 3 && Number(x) <= 117);
    assert.ok(Number(y) >= 3 && Number(y) <= 33);
  }
});

test("click opens the detailed two-series dialog and closing returns to the miniature", async () => {
  const hooksUrl = sourceUrl(`
    export * from "${reactImports.react}";
    const state = []; let cursor = 0;
    export const beginRender = () => { cursor = 0; };
    export const useId = () => "supplier-history-test";
    export const useMemo = fn => fn();
    export const useState = initial => {
      const index = cursor++;
      if (!(index in state)) state[index] = typeof initial === "function" ? initial() : initial;
      return [state[index], value => { state[index] = typeof value === "function" ? value(state[index]) : value; }];
    };
  `);
  const source = Buffer.from(supplierChartUrl.split(",")[1], "base64").toString().replaceAll(`from "${reactImports.react}"`, `from "${hooksUrl}"`);
  const { SupplierSparkline: InteractiveSparkline } = await import(sourceUrl(source));
  const { beginRender } = await import(hooksUrl);
  const props = { label: "Fournisseur exemple", points: [observation("2026-07", 4, 3), observation("2026-08", 2, 1.5)] };
  beginRender();
  const closed = InteractiveSparkline(props);
  assert.equal(closed.props.children[1], false);
  closed.props.children[0].props.onClick();
  beginRender();
  const opened = InteractiveSparkline(props);
  const html = renderToStaticMarkup(opened);
  assert.match(html, /aria-expanded="true"/);
  assert.match(html, /role="dialog" aria-modal="true" aria-labelledby="supplier-history-test"/);
  assert.match(html, /class="supplier-chart-bar global"/);
  assert.match(html, /class="supplier-chart-bar weighted"/);
  assert.match(html, /class="supplier-chart-zero"/);
  assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 2);
  assert.match(html, /Variation GLOBAL/);
  assert.match(html, /Variation pondérée/);
  assert.match(html, /aria-label="Fermer"/);
  opened.props.children[1].props.onClose();
  beginRender();
  assert.equal(InteractiveSparkline(props).props.children[1], false);
});

test("simulation steps use readable surface and text tokens in both themes", () => {
  const names = ["theme", "analyst", "components", "workspace", "simulations"];
  const styles = names.map((name) => postcss.parse(readFileSync(new URL(`../app/styles/${name}.css`, import.meta.url), "utf8")));
  const declarations = (selector) => {
    const values = new Map();
    for (const css of styles) css.walkRules((rule) => {
      if (rule.parent.type !== "root" || rule.selector.replace(/\s*([>+~])\s*/g, "$1") !== selector.replace(/\s*([>+~])\s*/g, "$1")) return;
      rule.walkDecls((decl) => values.set(decl.prop, decl.value));
    });
    return values;
  };
  assert.equal(declarations(".report-step").get("background"), "var(--surface)");
  assert.equal(declarations(".report-step > span").get("color"), "var(--text)");
  assert.equal(declarations(".report-step > span").get("text-transform"), "none");
  assert.equal(declarations(".supplier-sparkline").get("width"), "auto");
  assert.equal(declarations(".supplier-mini-chart").get("width"), "120px");
  assert.equal(declarations(".supplier-mini-chart").get("height"), "36px");
  for (const selector of [":root", ':root[data-theme="dark"]']) {
    const tokens = declarations(selector);
    for (const token of ["--text", "--muted", "--mint", "--aqua", "--violet", "--peach", "--red"]) {
      assert.ok(contrastRatio(tokens.get(token), tokens.get("--surface")) >= 4.5, `${selector} ${token}`);
    }
  }
  for (const css of styles) css.walkDecls((decl) => {
    if (/^background/.test(decl.prop)) {
      const mix = decl.value.match(/var\(--text\)\s+([\d.]+)%/);
      assert.ok(!mix || Number(mix[1]) < 20, `${decl.parent.selector}: text-colored surface can reverse contrast`);
    }
    if (decl.prop === "display" && decl.parent.selector?.includes("supplier-mini-chart")) assert.notEqual(decl.value, "none");
  });
  const globals = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.ok(globals.indexOf('"./styles/simulations.css"') > globals.indexOf('"./styles/workspace.css"'));
});

test("supplier picker filters and selects by keyboard, with an empty-result state", async () => {
  const hooksUrl = sourceUrl(`
    export * from "${reactImports.react}";
    const state = []; let cursor = 0;
    export const beginRender = () => { cursor = 0; };
    export const useId = () => "supplier-picker-test";
    export const useEffect = () => {};
    export const useRef = () => ({current: null});
    export const useState = initial => {
      const index = cursor++;
      if (!(index in state)) state[index] = typeof initial === "function" ? initial() : initial;
      return [state[index], value => {state[index] = typeof value === "function" ? value(state[index]) : value;}];
    };
  `);
  const hooks = await import(hooksUrl);
  const module = await import(moduleUrl("../../features/market-pulse/supplier-variation-dashboard.tsx", {
    ...reactImports, react: hooksUrl,
    "@/lib/chart-excel-export": moduleUrl("../../lib/chart-excel-export.ts"),
  "@/lib/chart-image-export": moduleUrl("../../lib/chart-image-export.ts"),
    "@/lib/supplier-turnover": moduleUrl("../../lib/supplier-turnover.ts"),
    "@/lib/supplier-variations": moduleUrl("../../lib/supplier-variations.ts"),
    "@/components/app-dialog": dialogUrl,
    "@/components/safe-date-input": safeDateUrl,
    "@/components/table-pagination": paginationUrl,
    "@/lib/supplier-mini-trend": miniTrendUrl,
    "./supplier-mini-chart": moduleUrl("../../features/market-pulse/supplier-mini-chart.tsx", { ...reactImports, "@/lib/supplier-mini-trend": miniTrendUrl }),
  }));
  let chosen = "all";
  const suppliers = [{key:"a", label:"Chêne", code:"F01"}, {key:"b", label:"Bois", code:"F02"}];
  const render = () => { hooks.beginRender(); return module.SupplierPicker({suppliers, value:chosen, onChange:key=>{chosen=key;}}); };
  const nodes = tree => !tree || typeof tree !== "object" ? [] : [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)];
  let tree = render();
  nodes(tree).find(n=>n.props?.className === "supplier-picker-trigger").props.onClick();
  tree=render();
  let input=nodes(tree).find(n=>n.props?.role === "combobox");
  input.props.onChange({target:{value:"f02"}});
  tree=render();
  assert.equal(nodes(tree).filter(n=>n.props?.role === "option").length, 1);
  input=nodes(tree).find(n=>n.props?.role === "combobox");
  input.props.onKeyDown({key:"Enter",preventDefault(){}});
  assert.equal(chosen,"b");
  tree=render();
  assert(!nodes(tree).some(n=>n.props?.role === "combobox"));
  nodes(tree).find(n=>n.props?.className === "supplier-picker-trigger").props.onClick();
  tree=render();nodes(tree).find(n=>n.props?.role === "combobox").props.onChange({target:{value:"introuvable"}});
  tree=render();assert(nodes(tree).some(n=>n.props?.role === "status" && n.props.children === "Aucun fournisseur trouvé."));
});
