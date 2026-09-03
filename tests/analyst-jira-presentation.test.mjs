import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { moduleUrl, sourceUrl } from "./helpers/module-url.mjs";

const isoUrl = moduleUrl("../../lib/iso-week.ts");
const historyUrl = moduleUrl("../../lib/analyst-jira-history.ts", { "./iso-week": isoUrl });
const metricsUrl = moduleUrl("../../lib/analyst-jira-metrics.ts", { "./iso-week": isoUrl, "./analyst-jira-history": historyUrl });
const reactImports = { react: import.meta.resolve("react"), "react/jsx-runtime": import.meta.resolve("react/jsx-runtime") };
const dateInputUrl = moduleUrl("../../components/safe-date-input.tsx", { ...reactImports, "@/lib/iso-week": isoUrl });
const panelImports = { ...reactImports, "@/lib/iso-week": isoUrl, "@/components/safe-date-input": dateInputUrl, "@/lib/analyst-jira-history": historyUrl, "@/lib/analyst-jira-metrics": metricsUrl };
const panelUrl = moduleUrl("../../features/market-pulse/analyst-jira-panel.tsx", panelImports);
const chartHtmlUrl = moduleUrl("../../lib/analyst-jira-history-html.ts", { "./iso-week": isoUrl, "./analyst-jira-history": historyUrl, "./analyst-jira-metrics": metricsUrl });
const turnoverUrl = moduleUrl("../../lib/supplier-turnover.ts");
const pointUrl = moduleUrl("../../lib/analyst-point.ts", { "./iso-week": isoUrl, "./jira-import": moduleUrl("../../lib/jira-import.ts"), "./point-source-mode": moduleUrl("../../lib/point-source-mode.ts") });
const exportUrl = moduleUrl("../../lib/analyst-point-export.ts", { "./iso-week": isoUrl, "./analyst-jira-history": historyUrl, "./analyst-jira-history-html": chartHtmlUrl, "./supplier-turnover": turnoverUrl, "./analyst-point": pointUrl });

const { CompletedWeekChart, CompletedTicketDisclosure, AnalystJiraPanel, AnalystJiraMetrics } = await import(panelUrl);
const { analystMailHtml, analystInteractiveHtml } = await import(exportUrl);
const { initialAnalystPoint } = await import(pointUrl);
const weeks = [
  { year: 2026, week: 34, from: "2026-08-17", to: "2026-08-23", count: 0 },
  { year: 2026, week: 35, from: "2026-08-24", to: "2026-08-30", count: 13 },
];
const ticket = { key: "GLOBAL-1", id: "one", status: "Terminé", summary: "Titre <à vérifier>", link: "https://example.test/browse/GLOBAL-1", updatedAt: "2026-08-25T10:00:00" };

test("keeps graph totals, weekly average and selected week change aligned in the point and exports", () => {
  const history = { analystId: "analyst", from: "2026-08-17", to: "2026-08-30", weeks: weeks.map((week, index) => ({ ...week, count: index ? 5 : 4 })), updatedAt: "2026-09-01" };
  const analyst = { id: "analyst", name: "Jane DOE", role: "analyste-tarif-referentiel", marketIds: [] };
  const point = { ...initialAnalystPoint(analyst), meetingDate: "2026-08-30", jiraResolved: Array.from({ length: 5 }, (_, index) => ({ ...ticket, key: `GLOBAL-${index + 1}` })) };
  const stats = { contributions: [], simulations: 0, controls: 0, totalActivities: 0, distinctTasks: 0 };
  const outputs = [
    renderToStaticMarkup(createElement(AnalystJiraMetrics, { history, pointDate: point.meetingDate, currentCount: 5 })),
    analystMailHtml(point, analyst, stats, stats, history),
    analystInteractiveHtml(point, analyst, stats, history),
  ];
  for (const output of outputs) {
    const html = output.replace(/[\u00a0\u202f]/g, " ");
    assert.match(html, /Total sur la période/);
    assert.match(html, /Moyenne par semaine/);
    assert.match(html, /Semaines à zéro incluses/);
    assert.match(html, />9<\/strong>/);
    assert.match(html, />4,5<\/strong>/);
    assert.match(html, />\+25 %<\/strong>/);
    assert.match(html, /Évolution de S35 · 2026/);
    assert.match(html, /vs S34 · 2026 : 4 → 5 tickets/);
  }
});

test("exports the previous week comparison without including that week in graph totals", () => {
  const analyst = { id: "analyst", name: "Jane DOE", role: "analyste-tarif-referentiel", marketIds: [] };
  const point = { ...initialAnalystPoint(analyst), meetingDate: "2026-08-30", jiraResolved: Array.from({ length: 5 }, (_, index) => ({ ...ticket, key: `GLOBAL-${index + 1}` })) };
  const history = { analystId: "analyst", from: "2026-08-24", to: "2026-08-30", weeks: [{ ...weeks[1], count: 5 }], updatedAt: "2026-09-01" };
  const stats = { contributions: [], simulations: 0, controls: 0, totalActivities: 0, distinctTasks: 0 };
  for (const output of [analystMailHtml(point, analyst, stats, stats, history, 4), analystInteractiveHtml(point, analyst, stats, history, 4)]) {
    assert.match(output, /1 semaine affichée/);
    assert.match(output, /\+25\s%/);
    assert.doesNotMatch(output, />9<\/strong>/);
  }
});

test("does not turn a loading or unavailable comparison into a zero percent change", () => {
  const history = { analystId: "analyst", from: "2026-08-24", to: "2026-08-30", weeks: [{ ...weeks[1], count: 5 }], updatedAt: "2026-09-01" };
  const props = {
    analystName: "Jane DOE", pointDate: "2026-08-30", tickets: Array(5).fill(ticket), unavailable: false,
    history: { history, loading: false, error: "" }, settings: { horizon: "custom", from: history.from, to: history.to },
    onSettingsChange() {}, onSelectWeek() {}, onRetry() {},
  };
  for (const previousWeek of [{ count: null, loading: true, error: "" }, { count: null, loading: false, error: "Registre indisponible" }]) {
    const html = renderToStaticMarkup(createElement(AnalystJiraPanel, { ...props, previousWeek }));
    assert.match(html, /Comparaison indisponible/);
    assert.doesNotMatch(html, />0\s%<|Infinity|NaN/);
  }
});

test("renders chronological clickable weeks and a true zero-height bar", () => {
  const html = renderToStaticMarkup(createElement(CompletedWeekChart, { weeks, selectedDate: "2026-08-30", onSelectWeek() {} }));
  assert.ok(html.indexOf("S34 · 2026") < html.indexOf("S35 · 2026"));
  assert.match(html, /height:0%/);
  assert.match(html, /13 tickets terminés/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /Ouvrir ce point/);
});

test("keeps the completed ticket list closed and avoids rendering thousands of links before opening", () => {
  const html = renderToStaticMarkup(createElement(CompletedTicketDisclosure, { tickets: [ticket] }));
  assert.match(html, /<details class="analyst-completed-disclosure">/);
  assert.match(html, /Voir le ticket terminé/);
  assert.doesNotMatch(html, / open|href=/);
});

test("shows only the last-modified date on expanded completed tickets", async () => {
  const expandedReact = sourceUrl(`export * from "${reactImports.react}"; export const useState = value => [value === false ? true : value, () => {}];`);
  const { CompletedTicketDisclosure: ExpandedTickets } = await import(moduleUrl("../../features/market-pulse/analyst-jira-panel.tsx", { ...panelImports, react: expandedReact }));
  const html = renderToStaticMarkup(createElement(ExpandedTickets, { tickets: [{ ...ticket, createdAt: "2026-08-01", resolvedAt: "2026-08-20" }] }));
  assert.match(html, /<b>25 août 2026<\/b>/);
  assert.match(html, /href="https:\/\/example\.test\/browse\/GLOBAL-1"/);
  assert.doesNotMatch(html, /Modifié le|Terminé le/);
});

test("shows completion only, with independent error states for history", () => {
  const html = renderToStaticMarkup(createElement(AnalystJiraPanel, {
    analystName: "Jane DOE", pointDate: "2026-08-30", tickets: [ticket], unavailable: false,
    history: { history: null, loading: false, error: "Historique indisponible" },
    settings: { horizon: "3", from: "2026-06-01", to: "2026-08-30" }, onSettingsChange() {}, onSelectWeek() {}, onRetry() {},
  }));
  assert.match(html, /Tickets terminés/);
  assert.match(html, /Historique indisponible/);
  assert.doesNotMatch(html, /Stock Jira|À surveiller|attention forte|Non terminés attribués/);
});

test("keeps the white mail and interactive HTML aligned without exposing open stock", () => {
  const analyst = { id: "analyst", name: "Jane DOE", email: "jane@example.test", usercode: "A1234567", role: "analyste-tarif-referentiel", marketIds: [] };
  const point = { ...initialAnalystPoint(analyst), meetingDate: "2026-08-30", jira: [{ ...ticket, key: "OPEN-1", status: "En cours" }], jiraResolved: [ticket] };
  const history = { analystId: "analyst", from: "2026-08-17", to: "2026-08-30", weeks, updatedAt: "2026-09-01" };
  const stats = { contributions: [], simulations: 2, controls: 3, totalActivities: 5, distinctTasks: 4 };
  const mail = analystMailHtml(point, analyst, stats, stats, history);
  const html = analystInteractiveHtml(point, analyst, stats, history);
  for (const output of [mail, html]) {
    assert.match(output, /Tickets terminés par semaine/);
    assert.match(output, /S35 · 2026/);
    assert.match(output, /GLOBAL-1/);
    assert.match(output, /Titre &lt;à vérifier&gt;/);
    assert.match(output, />25 août 2026<\//);
    assert.doesNotMatch(output, /Modifié le|Terminé le/);
    assert.doesNotMatch(output, /OPEN-1|Non terminés attribués|tickets non terminés/);
  }
  assert.match(mail, /background:#FFFFFF/);
  assert.match(html, /<details><summary>Voir les 1 tickets terminés/);
  assert.doesNotMatch(html, /<details open/);
});

test("exports the supplier amount of each simulation without cumulating it", () => {
  const analyst = { id: "analyst", name: "Jane DOE", role: "analyste-tarif-referentiel", marketIds: [] };
  const point = initialAnalystPoint(analyst);
  const amounts = [473398.58, 89613.02, 0, null];
  const stats = {
    contributions: amounts.map((purchases12m, index) => ({
      taskId: `simulation-${index}`, taskName: `Fournisseur exemple · simulation ${index}`,
      date: "2026-08-25", specialty: "simulation", purchases12m,
    })),
    simulations: 4, controls: 0, totalActivities: 4, distinctTasks: 4,
  };
  for (const output of [analystMailHtml(point, analyst, stats, stats, null), analystInteractiveHtml(point, analyst, stats, null)]) {
    const normalized = output.replace(/[\u00a0\u202f]/g, " ");
    assert.equal(output.split("CA fournisseur · 12 mG").length - 1, 4);
    assert.match(normalized, /473 398,58 €/);
    assert.match(normalized, /89 613,02 €/);
    assert.match(normalized, />0,00 €</);
    assert.match(normalized, />—</);
    assert.doesNotMatch(normalized, /563 011,60/);
  }
});
