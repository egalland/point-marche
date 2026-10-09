import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { moduleUrl } from "./helpers/module-url.mjs";

const source = ts.transpileModule(readFileSync(new URL("../lib/analyst-jira-client.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText.replace('from "./app-transport"', `from "${moduleUrl("../../lib/app-transport.ts")}"`);
const { fetchAnalystJiraSnapshot, fetchAnalystJiraHistory } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

test("fetches the selected analyst week without cache and preserves both ticket lists", async (t) => {
  const controller = new AbortController();
  const snapshot = { analystId: "person/1", year: 2026, week: 35, tickets: [{ key: "GLOBAL-1" }], resolvedTickets: [{ key: "GLOBAL-2" }] };
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "/api/analyst-jira?analystId=person%2F1&year=2026&week=35");
    assert.equal(options.cache, "no-store");
    assert.equal(options.signal, controller.signal);
    return Response.json({ snapshot });
  });
  assert.deepEqual(await fetchAnalystJiraSnapshot("person/1", { year: 2026, week: 35 }, controller.signal), snapshot);
});

test("reports server and network failures rather than returning empty data", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () => Response.json({ error: "Registre indisponible" }, { status: 500 }));
  await assert.rejects(fetchAnalystJiraSnapshot("person", { year: 2026, week: 35 }), /Registre indisponible/);
  fetchMock.mock.mockImplementation(async () => { throw new TypeError("Network unavailable"); });
  await assert.rejects(fetchAnalystJiraSnapshot("person", { year: 2026, week: 35 }), /Network unavailable/);
});

test("accepts a successful response without an imported snapshot", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ snapshot: null }));
  assert.equal(await fetchAnalystJiraSnapshot("person", { year: 2026, week: 35 }), null);
});

test("fetches a single bounded range for the analyst history without relying on saved points", async (t) => {
  const signal = new AbortController().signal;
  const history = { analystId: "person/1", from: "2026-08-03", to: "2026-08-30", weeks: [{ year: 2026, week: 35, count: 13 }], updatedAt: "2026-09-01" };
  t.mock.method(globalThis, "fetch", async (url, options) => {
    const query = new URL(url, "https://example.test").searchParams;
    assert.equal(query.get("analystId"), "person/1");
    assert.equal(query.get("view"), "history");
    assert.equal(query.get("from"), "2026-08-03");
    assert.equal(query.get("to"), "2026-08-30");
    assert.equal(options.cache, "no-store");
    assert.equal(options.signal, signal);
    return Response.json({ history });
  });
  assert.deepEqual(await fetchAnalystJiraHistory("person/1", { from: "2026-08-03", to: "2026-08-30" }, signal), history);
});

test("distinguishes missing imports from failed history loads", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () => Response.json({ history: null }));
  assert.equal(await fetchAnalystJiraHistory("person", { from: "2026-08-03", to: "2026-08-30" }), null);
  fetchMock.mock.mockImplementation(async () => Response.json({ error: "Historique indisponible" }, { status: 500 }));
  await assert.rejects(fetchAnalystJiraHistory("person", { from: "2026-08-03", to: "2026-08-30" }), /Historique indisponible/);
});
