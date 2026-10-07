import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { build } from "esbuild";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
async function load(file, extra = "") {
  const absolute = resolve(file);
  const result = await build({ stdin: { contents: await readFile(absolute, "utf8") + extra, sourcefile: absolute, resolveDir: dirname(absolute), loader: file.endsWith("tsx") ? "tsx" : "ts" }, tsconfig: resolve("tsconfig.json"), bundle: true, packages: "external", format: "cjs", platform: "node", write: false, logLevel: "silent" });
  const module = { exports: {} };
  new Function("require", "module", "exports", result.outputFiles[0].text)(require, module, module.exports);
  return module.exports;
}
const comparison = await load("lib/market-comparison.ts");
const mail = await load("lib/mail-draft.ts");
const point = await load("lib/analyst-point.ts");
const analystExport = await load("lib/analyst-point-export.ts");
const enrichment = await load("lib/point-planner-enrichment.ts");
const plannerRegistry = await load("lib/planner-registry.ts");
const { MarketComparisonChart } = await load("features/market-pulse/market-comparison.tsx");
const app = await load("features/market-pulse/market-pulse-app.tsx", '\nexport { initialData, normalizePointData, buildMailHtml, buildInteractiveHtml, applyJiraWeek, PreviewDashboard, defaultMarkets };\nexport { installLocalTransport } from "@/lib/app-transport";\n');
const rows = [
  { marketId: "a", label: "Marché A", color: "#128467", count: 6, source: "import", updatedAt: "2026-09-03" },
  { marketId: "b", label: "Marché B", color: "#7859C5", count: 2, source: "manual", updatedAt: "2026-09-03" },
  { marketId: "c", label: "Marché C", color: "#177FAD", count: 0, source: "import", updatedAt: "2026-09-03" },
  { marketId: "d", label: "Marché D", color: "#CF752A", count: null, source: "unavailable", updatedAt: "" },
];
const snapshot = { metric: "open-jira", year: 2026, week: 36, measuredAt: "2026-09-03T12:00:00Z", rows };
const analyst = { id: "analyst", name: "Jane DOE", email: "jane@example.test", role: "analyste-tarif-referentiel", marketIds: [] };
const stats = { contributions: [], simulations: 0, controls: 0, totalActivities: 0, distinctTasks: 0 };

test("empty points contain no sample tickets, dossiers or promotions", () => {
  for (const market of app.defaultMarkets) {
    const data = app.initialData(market.id);
    assert.deepEqual([data.jira, data.dossiers, data.operations, data.promotions], [[], [], [], []]);
  }
});

test("damaged legacy fields cannot crash point rendering or duplicate modules", () => {
  const market = app.defaultMarkets[0];
  const damaged = { meetingDate: "2026-02-31", dossiers: [null, 3, { title: 42, owner: null, progress: 200 }], jira: [null, { summary: 42, assignee: 17, link: "javascript:alert(1)" }], promotions: [null, "wrong"], mail: { to: 42, autoTo: [null, 12] }, preferences: { moduleOrder: ["dossiers", "dossiers", "invalid", "jira"] } };
  const normalized = app.normalizePointData(damaged, market.id);
  assert.equal(new Set(normalized.preferences.moduleOrder).size, normalized.preferences.moduleOrder.length);
  assert.notEqual(normalized.meetingDate, "2026-02-31");
  assert.equal(normalized.dossiers[0].progress, 100);
  assert.equal(normalized.jira[0].link, "");
  assert.equal(normalized.mail.to, "");
  assert.doesNotThrow(() => renderToStaticMarkup(createElement(app.PreviewDashboard, { data: normalized, market, archive: [] })));
  const analystData = point.normalizeAnalystPoint({ ...damaged, jiraResolved: damaged.jira, preferences: { order: ["dossiers", "dossiers"] } }, analyst);
  assert.equal(new Set(analystData.preferences.order).size, analystData.preferences.order.length);
  assert.doesNotThrow(() => analystExport.analystInteractiveHtml(analystData, analyst, stats, null));
});

test("standalone market and analyst pages respect saved block order and widths", () => {
  const market = app.defaultMarkets[0];
  const data = app.initialData(market.id);
  data.preferences.moduleOrder = ["promotions", "alerts", "operations", "dossiers", "jira", "comparison"];
  data.preferences.moduleWidths.promotions = "half";
  data.preferences.fontScalePercent = 125;
  data.preferences.density = "airy";
  data.preferences.readModules.comparison = true;
  const html = app.buildInteractiveHtml(data, market, []);
  assert.deepEqual([...html.matchAll(/data-module="([a-z]+)"/g)].map((match) => match[1]), data.preferences.moduleOrder);
  assert.match(html, /data-module="promotions" style="--columns:3"/);
  assert.match(html, /--point-scale:1\.25;--space:24px/);
  assert.match(html, /height:0%/);
  const analystData = point.initialAnalystPoint(analyst);
  analystData.preferences.order = ["dossiers", "overview", "planner", "jira", "cycle20"];
  analystData.preferences.widths.dossiers = "two-thirds";
  const analystHtml = analystExport.analystInteractiveHtml(analystData, analyst, stats, null);
  assert.deepEqual([...analystHtml.matchAll(/data-module="([a-z0-9]+)"/g)].map((match) => match[1]), ["dossiers", "overview", "planner", "jira"]);
  assert.match(analystHtml, /data-module="dossiers" style="--columns:4"/);
});

test("market comparison distinguishes unknown markets from zero and weights manual summaries", () => {
  assert.equal(comparison.openTicketCount([{ status: "En cours", count: 5 }, { status: "En attente" }, { status: "Fini" }, { status: "Abandonné" }]), 6);
  assert.deepEqual(comparison.comparisonTotals(rows), { total: 8, available: 3, missing: 1 });
  assert.deepEqual(comparison.comparisonSlices(rows).map(({ marketId, percent }) => ({ marketId, percent })), [{ marketId: "a", percent: 75 }, { marketId: "b", percent: 25 }]);
  const html = renderToStaticMarkup(createElement(MarketComparisonChart, { snapshot }));
  assert.match(html, /Marché C/);
  assert.match(html, /<b>0<\/b>/);
  assert.match(html, /Marché D/);
  assert.match(html, /<b>—<\/b>/);
  assert.match(html, /1 marché sans données/);
  assert.doesNotMatch(html, /NaN|Infinity/);
});

test("pie exports remain valid for a single market, zero tickets and hostile labels", () => {
  assert.equal(comparison.comparisonSlices([rows[0]])[0].percent, 100);
  assert.deepEqual(comparison.comparisonSlices([rows[2], rows[3]]), []);
  const normalized = comparison.normalizeMarketComparison({ ...snapshot, rows: [{ ...rows[0], label: '<img src=x onerror="alert(1)">', color: "red;display:none" }, rows[0], { ...rows[1], count: -2 }] });
  assert.equal(normalized.rows.length, 2);
  assert.equal(normalized.rows[1].count, null);
  const html = comparison.marketComparisonHtml(normalized);
  assert.match(html, /&lt;img/);
  assert.doesNotMatch(html, /<img src=x|display:none|NaN|Infinity/);
});

test("manual market Jira bypasses refresh and remains manual after normalization", async () => {
  const original = app.initialData();
  original.jiraMode = "manual";
  original.jira = [{ status: "En cours", count: 42, key: "", summary: "Synthèse manuelle" }];
  let requests = 0;
  app.installLocalTransport(async () => { requests += 1; throw new Error("Import unavailable"); }, { read: () => null, write: () => {} });
  const normalized = app.normalizePointData(original, app.defaultMarkets[0].id);
  const refreshed = await app.applyJiraWeek(normalized, app.defaultMarkets[0].id, true);
  assert.equal(requests, 0);
  assert.equal(refreshed.jira[0].count, 42);
  assert.equal(refreshed.jiraMode, "manual");
});

test("manual Planner values cannot be enriched or inserted into the imported registry", () => {
  const payload = { plannerMode: "manual", meetingDate: "2026-09-03", operations: [{ id: "manual", name: "Décision prise en réunion", state: "En attente", steps: [["Contrôle", "Fait"]], plannerSource: { externalId: "one", metrics: { purchases12m: 123 } } }] };
  const imported = [{ externalId: "one", effectiveMonth: "2026-09", labels: ["REV-PB"], metrics: { purchases12m: 999 } }];
  assert.strictEqual(enrichment.enrichPointPlannerHistory(payload, imported), payload);
  assert.strictEqual(enrichment.enrichMarketPointFromPlanner(payload, imported, ["REV-PB"]), payload);
  assert.deepEqual(plannerRegistry.recoverPlannerTasksFromPoints([{ marketId: "a", payload }], { a: ["REV-PB"] }), []);
});

test("mail and standalone comparison visibility follow the point despite legacy flags", () => {
  const market = app.defaultMarkets[0];
  const data = app.normalizePointData({ ...app.initialData(), jira: [], marketComparison: snapshot }, market.id);
  assert.equal(data.preferences.readModules.comparison, false);
  assert.doesNotMatch(app.buildMailHtml(data, market, []), /Comparaison des marchés|Marché A/);
  assert.doesNotMatch(app.buildInteractiveHtml(data, market, []), /Comparaison des marchés|Marché A/);
  data.preferences.mailModules.comparison = true;
  assert.doesNotMatch(app.buildMailHtml(data, market, []), /Comparaison des marchés|Marché A/);
  assert.doesNotMatch(app.buildInteractiveHtml(data, market, []), /Marché A/);
  data.preferences.htmlModules.comparison = true;
  assert.doesNotMatch(app.buildInteractiveHtml(data, market, []), /Marché A/);
  const actions = { updatePriority() {}, updateDossier() {}, addDossier() {}, removeDossier() {}, updateOperation() {}, resetOperation() {}, addOperation() {}, removeOperation() {}, updatePromotion() {}, addPromotion() {}, removePromotion() {}, updateJira() {}, resetJira() {}, addJira() {}, setSourceMode() {}, insertModule() {}, hideModule() {}, moveModule() {}, updateModuleWidth() {}, resetLayout() {} };
  const read = renderToStaticMarkup(createElement(app.PreviewDashboard, { data, market, archive: [], editing: true, actions }));
  assert.match(read, /Modification|Ajouter un dossier|Sources du point/);
  assert.doesNotMatch(read, /Modifier pendant le point/);
  assert.doesNotMatch(read, /Marché A/);
  data.preferences.readModules.comparison = true;
  assert.match(app.buildMailHtml(data, market, []), /Marché A/);
  assert.match(app.buildInteractiveHtml(data, market, []), /Marché A/);
  assert.match(renderToStaticMarkup(createElement(app.PreviewDashboard, { data, market, archive: [] })), /Marché A/);
});

test("separates legacy promotions from simulations and never exposes the Planner source badge", () => {
  const market = app.defaultMarkets[0];
  const legacy = app.normalizePointData({
    meetingDate: "2026-09-03",
    operations: [
      { id: "promo", name: "Promo rentrée", month: "Septembre 2026", state: "En cours", summary: "Remise achat", steps: [] },
      { id: "planner:sim", name: "Simulation fournisseur", month: "Septembre 2026", state: "Faite", summary: "", steps: [], plannerSource: { externalId: "sim", metrics: {} } },
    ],
  }, market.id);
  assert.deepEqual(legacy.operations.map((item) => item.name), ["Simulation fournisseur"]);
  assert.deepEqual(legacy.promotions.map((item) => item.name), ["Promo rentrée"]);
  assert.equal(legacy.promotions[0].purchaseNote, "Remise achat");
  assert.ok(legacy.preferences.moduleOrder.includes("promotions"));
  for (const html of [app.buildMailHtml(legacy, market, []), app.buildInteractiveHtml(legacy, market, []), renderToStaticMarkup(createElement(app.PreviewDashboard, { data: legacy, market, archive: [] }))]) {
    assert.match(html, /Promotions|Promo rentrée/);
    assert.doesNotMatch(html, /· Planner|planner-source-pill/);
  }
});

test("normalizes free font scale, airy density and three block widths", () => {
  const market = app.defaultMarkets[0];
  const normalized = app.normalizePointData({ preferences: { fontScalePercent: 127, density: "airy", moduleWidths: { promotions: "two-thirds" } } }, market.id);
  assert.equal(normalized.preferences.fontScalePercent, 127);
  assert.equal(normalized.preferences.fontScale, "large");
  assert.equal(normalized.preferences.density, "airy");
  assert.equal(normalized.preferences.moduleWidths.promotions, "two-thirds");
});

test("manual analyst totals, including zero, replace imported counts only in this point", () => {
  const data = point.normalizeAnalystPoint({ ...point.initialAnalystPoint(analyst), jiraMode: "manual", manualJiraCounts: { resolved: 37, open: 0 }, jiraResolved: [{ key: "GLOBAL-1", summary: "Détail du registre", status: "Fini", updatedAt: "2026-09-03", link: "https://example.test/1" }], dossiers: [{ id: "d", title: "Décision de réunion", action: "Relancer demain", status: "En cours", deadline: "", comment: "", progress: 0, showProgress: false }] }, analyst);
  assert.deepEqual(point.analystJiraCounts(data), { resolved: 37, open: 0 });
  for (const html of [analystExport.analystMailHtml(data, analyst, stats, stats, null), analystExport.analystInteractiveHtml(data, analyst, stats, null)]) {
    assert.match(html, /37 ticket/);
    assert.match(html, /saisi.*manuelle/);
    assert.match(html, /0 ticket\(s\) encore ouvert/);
    assert.match(html, /Décision de réunion/);
    assert.doesNotMatch(html, /Détail du registre|Moyenne par semaine/);
  }
  assert.equal(point.analystJiraCounts({ ...data, jiraMode: "automatic" }).resolved, 1);
  assert.deepEqual(point.analystJiraCounts({ ...data, manualJiraCounts: { resolved: 0, open: 0 } }), { resolved: 0, open: 0 });
});

test("email draft contains a formatted body, plain alternative, inline chart and exact page attachment", () => {
  const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+cE5sAAAAASUVORK5CYII=";
  const html = `<h1>Point café</h1><p>À décider</p><img src="data:image/png;base64,${png}">`;
  const page = '<!doctype html><h1>Page complète</h1><script>document.title="Point"</script>';
  const result = mail.buildMailDraft({ to: "jane@example.test; john@example.test", cc: "boss@example.test", subject: "Réunion été 🟢".repeat(10), html, attachment: { name: "point-reunion.html", html: page } });
  assert.match(result, /^X-Unsent: 1\r$/m);
  assert.match(result, /^To: jane@example.test, john@example.test\r$/m);
  assert.match(result, /Content-Type: multipart\/mixed/);
  assert.match(result, /Content-Type: multipart\/alternative/);
  assert.match(result, /Content-Disposition: attachment; filename="point-reunion.html"/);
  assert.match(result, /Content-ID: <chart-0-/);
  const payloads = [...result.matchAll(/Content-Transfer-Encoding: base64\r\n(?:[^\r]+\r\n)*\r\n([A-Za-z0-9+/=\r\n]+?)(?=\r\n--)/g)].map((match) => Buffer.from(match[1].replace(/\s/g, ""), "base64").toString("utf8"));
  assert.ok(payloads.some((part) => part === page));
  assert.ok(payloads.some((part) => /<h1>Point café<\/h1>/.test(part) && /src="cid:chart-0-/.test(part)));
  assert.ok(payloads.some((part) => part === mail.mailPlainText(html)));
  const subjectWords = [...result.matchAll(/=\?UTF-8\?B\?([^?]+)\?=/g)];
  assert.equal(subjectWords.map((word) => Buffer.from(word[1], "base64").toString("utf8")).join(""), "Réunion été 🟢".repeat(10));
  assert.ok(subjectWords.every((word) => word[0].length <= 75));
});

test("draft headers cannot be injected by a subject or attachment filename", () => {
  const result = mail.buildMailDraft({ to: "jane@example.test\r\nBcc: unwanted@example.test", cc: "", subject: "Point\r\nBcc: unwanted@example.test", html: "<p>Texte</p>", attachment: { name: 'point"\r\nBcc: unwanted@example.test.html', html: "<p>Page</p>" } });
  assert.doesNotMatch(result, /^Bcc:/mi);
  assert.match(result, /^To: jane@example.test\r$/m);
});
