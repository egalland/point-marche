import assert from "node:assert/strict";
import test from "node:test";
import { moduleUrl, sourceUrl } from "./helpers/module-url.mjs";

const ormUrl = import.meta.resolve("drizzle-orm");
const isoUrl = moduleUrl("../../lib/iso-week.ts");
const jiraUrl = moduleUrl("../../lib/jira-import.ts");
const historyUrl = moduleUrl("../../lib/analyst-jira-history.ts", { "./iso-week": isoUrl });
const pointUrl = moduleUrl("../../lib/analyst-point.ts", { "./iso-week": isoUrl, "./jira-import": jiraUrl, "./point-source-mode": moduleUrl("../../lib/point-source-mode.ts") });
const schemaUrl = moduleUrl("../../db/schema.ts", { "drizzle-orm": ormUrl, "drizzle-orm/sqlite-core": import.meta.resolve("drizzle-orm/sqlite-core") });
const state = { editor: { username: "test" }, analyst: { id: "analyst", name: "Jane DOE", email: "jane@example.test", usercode: "A1234567", plannerAlias: "Jane" }, batch: { completedAt: "2026-09-01T10:00:00" }, calls: [], fail: false };
globalThis.__analystHistoryRouteTest = state;
const authUrl = sourceUrl('export async function getEditorUser() { return globalThis.__analystHistoryRouteTest.editor; }');
const dbUrl = sourceUrl('export function getDb() { const query = { from() { return this; }, where() { return this; }, async limit() { const analyst = globalThis.__analystHistoryRouteTest.analyst; return analyst ? [analyst] : []; } }; return { select() { return query; } }; }');
const registryUrl = sourceUrl(`
  export async function latestCompletedJiraBatch() { return globalThis.__analystHistoryRouteTest.batch; }
  export async function loadJiraActivityForAnalyst() { throw new Error("Weekly snapshots must not provide chart history"); }
  export async function loadJiraCompletionHistory(usercode, range) {
    const state = globalThis.__analystHistoryRouteTest;
    if (state.fail) throw new Error("Database unavailable");
    state.calls.push({ usercode, range });
    return { ...range, weeks: [{ year: 2026, week: 35, from: "2026-08-24", to: "2026-08-30", count: 13 }] };
  }
`);
const routeUrl = moduleUrl("../../app/api/analyst-jira/route.ts", {
  "../../../lib/directory-store":sourceUrl(`export async function directoryUsersAt(){const p=globalThis.__analystHistoryRouteTest.analyst;return p?[{...p,role:"analyste-tarif-referentiel",marketIds:[]}]:[]}`),
  "drizzle-orm": ormUrl, "../../../db": dbUrl, "../../../db/schema": schemaUrl,
  "../../../lib/analyst-point": pointUrl, "../../../lib/jira-import": jiraUrl,
  "../../../lib/jira-registry-server": registryUrl, "../../../lib/analyst-jira-history": historyUrl,
  "../../../lib/jira-source-priority": moduleUrl("../../lib/jira-source-priority.ts"), "../../simple-auth": authUrl,
});
const { GET } = await import(routeUrl);
const request = (query = "") => new Request(`https://example.test/api/analyst-jira?analystId=analyst&view=history&from=2026-08-24&to=2026-08-30${query}`);

test("serves analyst history from the global registry with no caching", async () => {
  const response = await GET(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  const payload = await response.json();
  assert.equal(payload.history.analystId, "analyst");
  assert.equal(payload.history.weeks[0].count, 13);
  assert.equal(payload.history.updatedAt, state.batch.completedAt);
  assert.deepEqual(state.calls.at(-1), { usercode: "A1234567", range: { from: "2026-08-24", to: "2026-08-30" } });
});

test("requires GLOBAL authentication before looking up the analyst", async () => {
  state.editor = null;
  assert.equal((await GET(request())).status, 401);
  state.editor = { username: "test" };
});

test("validates analyst identity and date range instead of returning a false zero", async () => {
  const analyst = state.analyst;
  state.analyst = null;
  assert.equal((await GET(request())).status, 404);
  state.analyst = { ...analyst, usercode: "" };
  assert.equal((await GET(request())).status, 409);
  state.analyst = analyst;
  assert.equal((await GET(new Request("https://example.test/api/analyst-jira?analystId=analyst&view=history&from=2026-00-02&to=2026-08-30"))).status, 400);
});

test("distinguishes no import from a central registry failure", async () => {
  const batch = state.batch;
  state.batch = null;
  assert.deepEqual(await (await GET(request())).json(), { history: null });
  state.batch = batch;
  state.fail = true;
  const failure = await GET(request());
  assert.equal(failure.status, 500);
  assert.ok((await failure.json()).error);
  state.fail = false;
});
