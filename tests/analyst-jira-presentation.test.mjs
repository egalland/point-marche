import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { moduleUrl } from "./helpers/module-url.mjs";

const isoUrl = moduleUrl("../../lib/iso-week.ts");
const historyUrl = moduleUrl("../../lib/analyst-jira-history.ts", { "./iso-week": isoUrl });
const reactImports = { react: import.meta.resolve("react"), "react/jsx-runtime": import.meta.resolve("react/jsx-runtime") };
const dateInputUrl = moduleUrl("../../components/safe-date-input.tsx", { ...reactImports, "@/lib/iso-week": isoUrl });
const panelUrl = moduleUrl("../../features/market-pulse/analyst-jira-panel.tsx", { ...reactImports, "@/lib/iso-week": isoUrl, "@/components/safe-date-input": dateInputUrl, "@/lib/analyst-jira-history": historyUrl });
const chartHtmlUrl = moduleUrl("../../lib/analyst-jira-history-html.ts", { "./iso-week": isoUrl, "./analyst-jira-history": historyUrl });
const exportUrl = moduleUrl("../../lib/analyst-point-export.ts", { "./iso-week": isoUrl, "./analyst-jira-history": historyUrl, "./analyst-jira-history-html": chartHtmlUrl });
const pointUrl = moduleUrl("../../lib/analyst-point.ts", { "./iso-week": isoUrl, "./jira-import": moduleUrl("../../lib/jira-import.ts") });
const { CompletedWeekChart, CompletedTicketDisclosure, AnalystJiraPanel } = await import(panelUrl);
const { analystMailHtml, analystInteractiveHtml } = await import(exportUrl);
const { initialAnalystPoint } = await import(pointUrl);
const weeks = [
  { year: 2026, week: 34, from: "2026-08-17", to: "2026-08-23", count: 0 },
  { year: 2026, week: 35, from: "2026-08-24", to: "2026-08-30", count: 13 },
];
const ticket = { key: "GLOBAL-1", id: "one", status: "Terminé", summary: "Titre <à vérifier>", link: "https://example.test/browse/GLOBAL-1", updatedAt: "2026-08-25T10:00:00" };

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
    assert.doesNotMatch(output, /OPEN-1|Non terminés attribués|tickets non terminés/);
  }
  assert.match(mail, /background:#FFFFFF/);
  assert.match(html, /<details><summary>Voir les 1 tickets terminés/);
  assert.doesNotMatch(html, /<details open/);
});
