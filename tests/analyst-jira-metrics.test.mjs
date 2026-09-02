import assert from "node:assert/strict";
import test from "node:test";
import { moduleUrl } from "./helpers/module-url.mjs";

const isoUrl = moduleUrl("../../lib/iso-week.ts");
const historyUrl = moduleUrl("../../lib/analyst-jira-history.ts", { "./iso-week": isoUrl });
const metrics = await import(moduleUrl("../../lib/analyst-jira-metrics.ts", { "./iso-week": isoUrl, "./analyst-jira-history": historyUrl }));
const { jiraCompletionWeeks } = await import(historyUrl);
const { isoWeekForDate } = await import(isoUrl);
const normal = (value) => value.replace(/[\u00a0\u202f]/g, " ");

function history(counts, from = "2026-08-10") {
  const weeks = jiraCompletionWeeks({ from, to: "2026-08-30" }).slice(0, counts.length).map((week, index) => ({ ...week, count: counts[index] }));
  return { analystId: "analyst", from: weeks[0]?.from ?? from, to: weeks.at(-1)?.to ?? from, weeks, updatedAt: "2026-09-01" };
}

test("sums exactly the graph weeks and includes zero weeks in the denominator", () => {
  const data = history([0, 4, 5]);
  assert.deepEqual(metrics.jiraPeriodMetrics(data.weeks), { total: 9, weekCount: 3, averagePerWeek: 3 });
  assert.deepEqual(metrics.jiraPeriodMetrics(data.weeks.slice(1)), { total: 9, weekCount: 2, averagePerWeek: 4.5 });
  assert.deepEqual(metrics.jiraPeriodMetrics(history([0, 0, 0]).weeks), { total: 0, weekCount: 3, averagePerWeek: 0 });
  assert.equal(metrics.jiraPeriodMetrics([]), null);
  for (const count of [null, undefined, NaN, Infinity, -1]) {
    assert.equal(metrics.jiraPeriodMetrics([{ ...data.weeks[0], count }]), null);
  }
});

test("compares the selected ISO week, not the final or hovered bar", () => {
  const data = history([2, 4, 100]);
  const selected = data.weeks[1].to;
  assert.equal(metrics.previousJiraWeekCount(data, selected), 2);
  const cards = metrics.jiraMetricCards(data, selected, 4);
  assert.equal(normal(cards[2].value), "+100 %");
  assert.match(cards[2].label, /S34 · 2026/);
  assert.match(cards[2].detail, /S33 · 2026 : 2 → 4/);
});

test("handles increase, decrease and stable weeks without a false percentage from zero", () => {
  assert.deepEqual(metrics.jiraWeekChange(5, 4), { current: 5, previous: 4, difference: 1, percentage: .25, tone: "up" });
  assert.equal(metrics.jiraWeekChange(5, 10).percentage, -.5);
  assert.equal(metrics.jiraWeekChange(0, 5).percentage, -1);
  assert.equal(metrics.jiraWeekChange(5, 5).percentage, 0);
  assert.equal(metrics.jiraWeekChange(0, 0).percentage, 0);
  assert.equal(metrics.jiraWeekChange(5, 0).percentage, null);
  assert.equal(metrics.jiraWeekChange(5, null), null);
  assert.equal(metrics.jiraWeekChange(null, 5), null);
  const data = history([0, 0, 5]);
  assert.equal(metrics.jiraMetricCards(data, "2026-08-30", 5)[2].value, "+5 tickets");
  assert.match(metrics.jiraMetricCards(data, "2026-08-30", 5)[2].detail, /base zéro/);
  assert.equal(normal(metrics.jiraMetricCards(data, "2026-08-23", 0)[2].value), "0 %");
});

test("retains a real small percentage instead of rounding it to zero", () => {
  const card = metrics.jiraMetricCards(history([0]), "2026-08-30", 25001, 25000)[2];
  assert.equal(normal(card.value), "+0,004 %");
});

test("keeps missing preceding weeks separate from zero and from period totals", () => {
  const data = history([5], "2026-08-24");
  assert.equal(metrics.previousJiraWeekCount(data, "2026-08-30"), null);
  assert.equal(metrics.jiraMetricCards(data, "2026-08-30", 5)[2].value, "—");
  const cards = metrics.jiraMetricCards(data, "2026-08-30", 5, 4);
  assert.equal(cards[0].value, "5");
  assert.equal(cards[1].value, "5");
  assert.equal(normal(cards[2].value), "+25 %");
});

test("finds the preceding ISO week across New Year and accepts incomplete dates safely", () => {
  const previous = metrics.previousJiraWeek("2027-01-04");
  assert.deepEqual(previous, { year: 2026, week: 53, from: "2026-12-28", to: "2027-01-03" });
  const data = { ...history([]), weeks: [{ ...previous, count: 6 }, { ...isoWeekForDate("2027-01-04"), count: 3 }] };
  assert.equal(metrics.previousJiraWeekCount(data, "2027-01-04"), 6);
  assert.match(metrics.jiraMetricCards(data, "2027-01-04", 3)[2].detail, /S53 · 2026 : 6 → 3/);
  for (const date of ["", "2026-0", "2026-00-12", "2026-02-30"]) {
    assert.equal(metrics.previousJiraWeek(date), null);
    assert.equal(metrics.previousJiraWeekCount(data, date), null);
    assert.equal(metrics.jiraMetricCards(null, date, null)[2].value, "—");
  }
});
