import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers/promises";
import { moduleUrl, sourceUrl } from "./helpers/module-url.mjs";

const isoUrl = moduleUrl("../../lib/iso-week.ts");
const historyUrl = moduleUrl("../../lib/analyst-jira-history.ts", { "./iso-week": isoUrl });
const metricsUrl = moduleUrl("../../lib/analyst-jira-metrics.ts", { "./iso-week": isoUrl, "./analyst-jira-history": historyUrl });
const state = { value: undefined, dependencies: "", cleanup: null, requests: [], response: null, failure: "" };
globalThis.__jiraComparisonTest = state;
const reactUrl = sourceUrl(`
  export function useState(initial) {
    const state = globalThis.__jiraComparisonTest;
    if (state.value === undefined) state.value = initial;
    return [state.value, (value) => { state.value = value; }];
  }
  export function useEffect(effect, dependencies) {
    const state = globalThis.__jiraComparisonTest;
    const key = JSON.stringify(dependencies);
    if (state.dependencies === key) return;
    state.cleanup?.();
    state.dependencies = key;
    state.cleanup = effect();
  }
`);
const clientUrl = sourceUrl(`
  export async function fetchAnalystJiraHistory(analystId, range, signal) {
    const state = globalThis.__jiraComparisonTest;
    state.requests.push({ analystId, range, signal });
    if (state.failure) throw new Error(state.failure);
    return state.response;
  }
`);
const { usePreviousAnalystJiraWeek } = await import(moduleUrl("../../features/market-pulse/use-analyst-jira-history.ts", {
  react: reactUrl,
  "@/lib/analyst-jira-client": clientUrl,
  "@/lib/analyst-jira-history": historyUrl,
  "@/lib/analyst-jira-metrics": metricsUrl,
}));
const previous = { year: 2026, week: 34, from: "2026-08-17", to: "2026-08-23", count: 4 };
const current = { year: 2026, week: 35, from: "2026-08-24", to: "2026-08-30", count: 5 };
const history = (weeks) => ({ analystId: "analyst", from: weeks[0].from, to: weeks.at(-1).to, weeks, updatedAt: "2026-09-01" });
const chart = (weeks) => ({ history: history(weeks), loading: false, error: "" });

test.beforeEach(() => {
  state.cleanup?.();
  Object.assign(state, { value: undefined, dependencies: "", cleanup: null, requests: [], response: null, failure: "" });
});
test.after(() => { state.cleanup?.(); delete globalThis.__jiraComparisonTest; });

test("reuses a preceding week already present in the graph, including a real zero", () => {
  for (const count of [4, 0]) {
    const result = usePreviousAnalystJiraWeek("analyst", current.to, chart([{ ...previous, count }, current]), 0);
    assert.deepEqual(result, { count, loading: false, error: "" });
    assert.equal(state.requests.length, 0);
  }
});

test("loads only the preceding calendar week when it is outside the graph", async () => {
  state.response = history([previous]);
  const graph = chart([current]);
  assert.deepEqual(usePreviousAnalystJiraWeek("analyst", current.to, graph, 0), { count: null, loading: true, error: "" });
  await setImmediate();
  assert.deepEqual(usePreviousAnalystJiraWeek("analyst", current.to, graph, 0), { count: 4, loading: false, error: "" });
  assert.equal(state.requests.length, 1);
  assert.deepEqual(state.requests[0].range, { from: previous.from, to: previous.to });
  assert.deepEqual(graph.history.weeks, [current]);
});

test("does not display stale counts when changing analysts or ISO weeks", async () => {
  state.response = history([previous]);
  const graph = chart([current]);
  usePreviousAnalystJiraWeek("analyst", current.to, graph, 0);
  await setImmediate();
  const next = usePreviousAnalystJiraWeek("another-analyst", "2027-01-04", graph, 0);
  assert.equal(next.count, null);
  assert.equal(next.loading, true);
  assert.deepEqual(state.requests.at(-1).range, { from: "2026-12-28", to: "2027-01-03" });
  assert.equal(state.requests.at(-1).analystId, "another-analyst");
});

test("keeps missing imports and load failures distinct from zero", async () => {
  const absent = usePreviousAnalystJiraWeek("analyst", current.to, { history: null, loading: false, error: "" }, 0);
  assert.deepEqual(absent, { count: null, loading: false, error: "" });
  assert.equal(state.requests.length, 0);
  state.failure = "Registre indisponible";
  const graph = chart([current]);
  usePreviousAnalystJiraWeek("analyst", current.to, graph, 0);
  await setImmediate();
  assert.deepEqual(usePreviousAnalystJiraWeek("analyst", current.to, graph, 0), { count: null, loading: false, error: state.failure });
});

test("never reuses a cached count belonging to another analyst", () => {
  const result = usePreviousAnalystJiraWeek("another-analyst", current.to, chart([previous, current]), 0);
  assert.equal(result.count, null);
  assert.equal(result.loading, true);
  assert.equal(state.requests.at(-1).analystId, "another-analyst");
});
