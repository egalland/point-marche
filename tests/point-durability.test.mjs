import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { build } from "esbuild";
const require = createRequire(import.meta.url);
const bundle = await build({
  stdin: { contents: 'export * from "./db/point-store"; export * from "./lib/hosted-point-drafts"; export * from "./lib/point-conflict"; export { runWithRuntimeEnv } from "./lib/runtime-env"; export * as draftsApi from "./app/api/point-drafts/route"; export * as marketsApi from "./app/api/points/route"; export * as analystsApi from "./app/api/analyst-points/route";', resolveDir: resolve("."), loader: "ts" },
  bundle: true, packages: "external", format: "cjs", platform: "node", write: false, logLevel: "silent",
  plugins: [{ name: "auth-fixture", setup(b) { b.onResolve({ filter: /simple-auth$/ }, () => ({ path: "auth", namespace: "fixture" })); b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: 'export async function getEditorUser() { return globalThis.pointTestEditor ? { username: globalThis.pointTestEditor } : null; }' })); } }],
});
const holder = { exports: {} };
new Function("require", "module", "exports", bundle.outputFiles[0].text)(require, holder, holder.exports);
const { HostedPointDrafts, runWithRuntimeEnv, readDraft, saveDraft, publishPoint, listPoints, draftsApi, marketsApi, analystsApi, pointDifferences } = holder.exports;
const date = "2026-09-08";
const point = (note = "Note initiale", meetingDate = date) => ({ meetingDate, priority: note, periodFrom: meetingDate, periodTo: meetingDate, themeColor: "mint", jiraMode: "manual", plannerMode: "manual", sourceFreshness: { jira: "2026-09-08T06:00:00Z" }, operations: [{ id: "simulation", state: "En attente fournisseur", plannerOverride: { state: "En attente fournisseur" } }] });
const ref = (record) => record ? { id: record.id, revision: record.revision } : null;
const edit = (data, scope = "market", ownerId = scope === "market" ? "panneaux" : "analyst-a") => ({ scope, ownerId, data });
function fixture(t) {
  const sqlite = new DatabaseSync(":memory:");
  const folder = new URL("../drizzle/", import.meta.url);
  for (const name of readdirSync(folder).filter((name) => name.endsWith(".sql")).sort()) sqlite.exec(readFileSync(new URL(name, folder), "utf8"));
  sqlite.exec("INSERT OR IGNORE INTO market_definitions (id,name,short_code) VALUES ('panneaux','Panneaux','PAN'); INSERT INTO global_users (id,name,email,jira_name,role) VALUES ('analyst-a','Analyste A','a@example.test','A1234567','analyste-tarif-referentiel');");
  const binding = {
    prepare(query) {
      assert.equal(query.replace(/;\s*$/, "").includes(";"), false, "one statement per D1 prepare");
      const statement = sqlite.prepare(query); let values = [];
      return { bind(...params) { assert.ok(params.length <= 100); values = params; return this; }, async first() { return statement.get(...values) ?? null; }, async all() { return { results: statement.all(...values) }; }, async run() { return statement.run(...values); } };
    },
    async batch(statements) { sqlite.exec("BEGIN"); try { const results = []; for (const statement of statements) results.push(await statement.all()); sqlite.exec("COMMIT"); return results; } catch (error) { sqlite.exec("ROLLBACK"); throw error; } },
  };
  let fail = false, writes = 0, hold = null;
  const run = (callback) => runWithRuntimeEnv({ DB: binding }, callback);
  const request = async (input, init) => {
    if (fail) throw new TypeError("Connexion interrompue");
    const req = new Request(new URL(input, "https://test.invalid"), init);
    const route = new URL(req.url).pathname;
    const api = route === "/api/point-drafts" ? draftsApi : route === "/api/points" ? marketsApi : analystsApi;
    if (req.method === "PUT") { writes++; if (hold) await hold; }
    return run(() => api[req.method](req));
  };
  const stores = [];
  const client = () => { const store = new HostedPointDrafts(request, 60_000); store.configure("GLOBAL"); stores.push(store); return store; };
  globalThis.pointTestEditor = "GLOBAL";
  t.after(() => { stores.forEach((store) => store.configure(null)); sqlite.close(); delete globalThis.pointTestEditor; });
  return { sqlite, run, request, client, writes: () => writes, fail(value) { fail = value; }, hold(value) { hold = value; } };
}

for (const scope of ["market", "analyst"]) {
  test(`${scope}: autosaved edits survive a new client without changing the shared point`, async (t) => {
    const db = fixture(t), original = db.client(), draft = edit(point("Correction reçue en réunion"), scope);
    await original.load(scope, draft.ownerId, date);
    original.write(draft);
    assert.equal(await original.flushAll(), true);
    assert.equal((await db.run(() => listPoints(scope, draft.ownerId))).length, 0);
    const resumed = await db.client().load(scope, draft.ownerId, date);
    assert.deepEqual(resumed.data, draft.data);
    assert.equal(original.hasUnsaved(), false);
    assert.equal(db.writes(), 1);
  });
  test(`${scope}: two editors cannot overwrite either a draft or a shared point`, async (t) => {
    const db = fixture(t), owner = scope === "market" ? "panneaux" : "analyst-a";
    const first = await db.run(() => saveDraft("GLOBAL", scope, owner, point("A"), null, null));
    assert.ok(first);
    assert.equal(await db.run(() => saveDraft("GLOBAL", scope, owner, point("B"), null, null)), null);
    const shared = await db.run(() => publishPoint("GLOBAL", scope, owner, first.data, null, first.revision));
    assert.ok(shared);
    assert.equal(await db.run(() => publishPoint("GLOBAL", scope, owner, point("Copie ancienne"), null, first.revision)), null);
    const edited = await db.run(() => saveDraft("GLOBAL", scope, owner, point("A modifié"), shared.draft.revision, ref(shared.point)));
    const second = await db.run(() => publishPoint("GLOBAL", scope, owner, edited.data, ref(shared.point), edited.revision));
    assert.equal(second.point.id, shared.point.id);
    assert.notEqual(second.point.revision, shared.point.revision);
    assert.equal(await db.run(() => publishPoint("GLOBAL", scope, owner, point("Ancienne révision"), ref(shared.point), second.draft.revision)), null);
    const loaded = await db.run(() => readDraft("GLOBAL", scope, owner, date));
    assert.equal(loaded.point.data.priority, "A modifié");
    assert.deepEqual(loaded.draft.basePoint, ref(second.point));
  });
}

test("a failed autosave keeps local edits, retries, and restores all weeks independently", async (t) => {
  const db = fixture(t), store = db.client();
  store.write(edit(point("Semaine A")));
  db.fail(true);
  assert.equal(await store.flushAll(), false);
  assert.equal(store.state("market", "panneaux", date).status, "error");
  assert.equal(store.read("market", "panneaux", date).data.priority, "Semaine A");
  db.fail(false);
  assert.equal(await store.flushAll(), true);
  store.write(edit(point("Semaine B", "2026-09-15")));
  assert.equal(await store.flushAll(), true);
  const fresh = db.client();
  assert.equal((await fresh.load("market", "panneaux", date)).data.priority, "Semaine A");
  assert.equal((await fresh.load("market", "panneaux", "2026-09-15")).data.priority, "Semaine B");
});

test("edits typed during an autosave are sent after the acknowledged snapshot", async (t) => {
  const db = fixture(t), store = db.client();
  store.write(edit(point("Envoyé")));
  let release; db.hold(new Promise((done) => { release = done; }));
  const saving = store.flushAll();
  await new Promise((resolve) => setImmediate(resolve));
  store.write(edit(point("Ajout pendant l’envoi")));
  release(); db.hold(null); await saving;
  assert.equal(store.hasUnsaved(), true);
  assert.equal(await store.flushAll(), true);
  assert.equal((await db.client().load("market", "panneaux", date)).data.priority, "Ajout pendant l’envoi");
});

test("publishing waits for its draft and preserves edits typed during the shared save", async (t) => {
  const db = fixture(t), store = db.client(), submitted = edit(point("Version partagée"));
  store.write(submitted);
  const guard = await store.beginPublish(submitted);
  store.write(edit(point("Ajout après le clic")));
  const response = await db.request("/api/points", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ marketId: "panneaux", data: submitted.data, ...guard }) });
  assert.equal(response.status, 200);
  const saved = await response.json();
  store.finishPublish(submitted, saved);
  assert.equal(store.read("market", "panneaux", date).data.priority, "Ajout après le clic");
  assert.equal(await store.flushAll(), true);
  const remote = await db.run(() => readDraft("GLOBAL", "market", "panneaux", date));
  assert.equal(remote.point.data.priority, "Version partagée");
  assert.equal(remote.draft.data.priority, "Ajout après le clic");
  assert.deepEqual(remote.draft.basePoint, ref(remote.point));
});

test("unchanged saved points can be saved safely even without an existing draft row", async (t) => {
  const db = fixture(t);
  db.sqlite.prepare("INSERT INTO weekly_points (id,market_id,year,week,version,meeting_date,point_name,theme_color,payload) VALUES ('old','panneaux',2026,37,1,?,'Point','mint',?)").run(date, JSON.stringify(point()));
  const shared = (await db.run(() => listPoints("market", "panneaux")))[0], store = db.client();
  store.observe("market", "panneaux", shared);
  const draft = edit(shared.data);
  store.write(draft);
  const guard = await store.beginPublish(draft);
  assert.ok(guard.draftRevision);
  assert.deepEqual(guard.expectedPoint, { id: "old", revision: "initial" });
  store.finishPublish(draft);
});

test("conflicts preserve both copies and a reviewed choice is still checked atomically", async (t) => {
  const db = fixture(t), a = db.client(), b = db.client();
  a.write(edit(point("Origine"))); await a.flushAll();
  await b.load("market", "panneaux", date);
  a.write(edit(point("Copie A"))); await a.flushAll();
  b.write(edit(point("Copie B")));
  assert.equal(await b.flushAll(), false);
  assert.equal(b.state("market", "panneaux", date).status, "conflict");
  assert.equal(b.read("market", "panneaux", date).data.priority, "Copie B");
  const review = await b.review("market", "panneaux", date);
  a.write(edit(point("A évolue encore"))); await a.flushAll();
  await assert.rejects(b.resolve("market", "panneaux", date, review, true));
  const updatedReview = await b.review("market", "panneaux", date);
  await b.resolve("market", "panneaux", date, updatedReview, false);
  assert.equal(b.read("market", "panneaux", date).data.priority, "A évolue encore");
  assert.equal(b.state("market", "panneaux", date).status, "saved");
});

test("a lost autosave response is recovered without a spurious conflict", async (t) => {
  const db = fixture(t); let lose = true;
  const store = new HostedPointDrafts(async (input, init) => { const response = await db.request(input, init); if (init?.method === "PUT" && lose) { lose = false; throw new Error("Réponse perdue"); } return response; }, 60_000);
  store.configure("GLOBAL"); t.after(() => store.configure(null));
  store.write(edit(point())); assert.equal(await store.flushAll(), false);
  assert.equal(await store.flushAll(), true);
  assert.equal(store.state("market", "panneaux", date).status, "saved");
});

test("draft routes require an editor, isolate accounts, and reject invalid and legacy writes", async (t) => {
  const db = fixture(t);
  globalThis.pointTestEditor = null;
  assert.equal((await db.request("/api/point-drafts?scope=market&ownerId=panneaux")).status, 401);
  assert.equal((await db.request("/api/point-drafts", { method: "PUT", body: "{}" })).status, 401);
  globalThis.pointTestEditor = "GLOBAL";
  const store = db.client(); store.write(edit(point("Privé"))); await store.flushAll();
  globalThis.pointTestEditor = "autre-compte";
  assert.equal((await (await db.request("/api/point-drafts?scope=market&ownerId=panneaux")).json()).draft, null);
  globalThis.pointTestEditor = "GLOBAL";
  const legacy = await db.request("/api/points", { method: "POST", body: JSON.stringify({ marketId: "panneaux", data: point() }) });
  assert.equal(legacy.status, 428);
  const invalid = await db.request("/api/point-drafts", { method: "PUT", body: JSON.stringify({ ...edit(point("Faux", "2026-02-30")), expectedRevision: null, basePoint: null }) });
  assert.equal(invalid.status, 400);
  assert.equal((await db.run(() => listPoints("market", "panneaux"))).length, 0);
});

test("the comparison includes edited text, simulation status, and block ordering", () => {
  const a = { ...point("Note A"), preferences: { moduleOrder: ["jira", "operations"] } };
  const b = { ...point("Note B"), operations: [{ id: "simulation", state: "Simulation faite" }], preferences: { moduleOrder: ["operations", "jira"] } };
  const differences = pointDifferences(a, b);
  assert.ok(differences.some((row) => row.label === "Priorité" && row.mine === "Note A" && row.remote === "Note B"));
  assert.ok(differences.some((row) => row.remote === "Simulation faite"));
  assert.ok(differences.some((row) => row.label.includes("Ordre des blocs")));
});


test("typing a burst automatically saves just the latest draft after the debounce", async (t) => {
  const db = fixture(t), store = new HostedPointDrafts(db.request, 5);
  store.configure("GLOBAL"); t.after(() => store.configure(null));
  for (const priority of ["C", "Cl", "Clair"]) store.write(edit(point(priority)));
  for (let i = 0; i < 20 && store.hasUnsaved(); i++) await new Promise((done) => setTimeout(done, 10));
  assert.equal(store.hasUnsaved(), false);
  assert.equal(db.writes(), 1);
  assert.equal((await db.client().load("market", "panneaux", date)).data.priority, "Clair");
});
