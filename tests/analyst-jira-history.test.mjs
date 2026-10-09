import assert from "node:assert/strict";
import test from "node:test";
import { moduleUrl } from "./helpers/module-url.mjs";

const isoUrl = moduleUrl("../../lib/iso-week.ts");
const historyUrl = moduleUrl("../../lib/analyst-jira-history.ts", { "./iso-week": isoUrl });
const iso = await import(isoUrl);
const history = await import(historyUrl);

test("rejects partial and impossible dates without throwing while typing", () => {
  for (const value of ["", "0", "2026-0", "2026-00-12", "2026-13-12", "2026-02-30", "2026-08-", "2026-99-99"]) {
    assert.equal(iso.isIsoDate(value), false);
    assert.match(history.validateJiraHistoryRange({ from: value, to: "2026-08-30" }), /dates complètes/);
  }
  assert.equal(iso.isIsoDate("2024-02-29"), true);
  assert.equal(iso.isIsoDate("2026-02-29"), false);
});

test("provides every ISO week in chronological order including weeks without a saved point", () => {
  const weeks = history.jiraCompletionWeeks({ from: "2026-03-09", to: "2026-08-30" });
  assert.equal(weeks.length, 25);
  assert.deepEqual(weeks.map((week) => week.week), Array.from({ length: 25 }, (_, index) => index + 11));
  assert.ok(weeks.every((week) => week.count === 0 && week.year === 2026));
  assert.deepEqual(history.jiraCompletionWeeks({ from: "2026-08-30", to: "2026-03-09" }), []);
});

test("keeps ISO year and Sunday boundaries consistent through New Year", () => {
  assert.deepEqual(iso.isoWeekForDate("2027-01-03"), { year: 2026, week: 53, from: "2026-12-28", to: "2027-01-03" });
  assert.deepEqual(iso.isoWeekForDate("2027-01-04"), { year: 2027, week: 1, from: "2027-01-04", to: "2027-01-10" });
  assert.equal(history.jiraWeekLabel(iso.isoWeekForDate("2027-01-03")), "S53 · 2026");
});

test("offers whole calendar week rows, including adjacent-month days and saved ISO years", () => {
  const weeks = iso.calendarWeeks(2027, 0);
  assert.equal(weeks.length, 5);
  assert.equal(weeks[0].from, "2026-12-28");
  assert.equal(weeks[0].year, 2026);
  assert.equal(weeks.at(-1).to, "2027-01-31");
  assert.equal(iso.calendarWeeks(2026, 2).length, 6);
});

test("keeps month presets and custom dates stable without month overflow", () => {
  const settings = { horizon: "1", from: "2026-01-01", to: "2026-01-31" };
  assert.deepEqual(history.jiraHistoryRange("2026-03-29", settings), { from: "2026-02-28", to: "2026-03-29" });
  assert.deepEqual(history.jiraHistoryRange("2026-08-26", { ...settings, horizon: "3" }), { from: "2026-05-30", to: "2026-08-30" });
  assert.deepEqual(history.jiraHistoryRange("2026-08-26", { ...settings, horizon: "custom" }), { from: "2026-01-01", to: "2026-01-31" });
  assert.match(history.validateJiraHistoryRange({ from: "2020-01-01", to: "2026-01-01" }), /cinq ans/);
  assert.match(history.validateJiraHistoryRange({ from: "2026-01-31", to: "2026-01-01" }), /précéder/);
});
