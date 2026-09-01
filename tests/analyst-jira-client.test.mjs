import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = ts.transpileModule(readFileSync(new URL("../lib/analyst-jira-client.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { fetchAnalystJiraSnapshot } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

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
