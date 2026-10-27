import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

async function loadModule(file) {
  const result = await build({ entryPoints: [new URL(file, import.meta.url).pathname], bundle: true, platform: "node", format: "esm", write: false, logLevel: "silent" });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}
const { WorkspaceStore } = await loadModule("../offline/workspace-store.ts");
const { createLocalApi: guardedApi } = await loadModule("../offline/local-api.ts");
const createLocalApi = store => { const api = guardedApi(store); return (input, init) => api(input, {...init, headers:{...init?.headers, "X-Market-USERCODE":"A0000001", "Content-Type":"application/json"}}); };
const { newWorkspace, encodeWorkspace, decodeWorkspace, validateWorkspace, isEmptyStarterWorkspace } = await loadModule("../offline/workspace-data.ts");
const { readWorkspaceFile, writeWorkspaceFile, fingerprint } = await loadModule("../offline/file-session.ts");
const { parseJiraCsv } = await loadModule("../lib/jira-csv.ts");

function ticket(key, patch = {}) {
  return { key, internalId: "100", status: "Fini", summary: "Fournisseur exemple", createdAt: "2026-08-01T10:00:00", updatedAt: "2026-08-28T10:00:00", resolutionAt: "", assigneeUserCode: "A1234567", participants: [], link: `https://jira.example.test/browse/${key}`, ...patch };
}
function fixture() {
  const data = newWorkspace();
  data.users = [
    { id: "analyst", name: "John Doe", email: "john@example.test", usercode: "A1234567", plannerAlias: "John", role: "analyste-tarif-referentiel", marketIds: ["market-local"] },
    { id: "chief", name: "Jane Doe", email: "jane@example.test", usercode: "B1234567", plannerAlias: "Jane", role: "chef-produit", marketIds: ["market-local"] },
  ];
  data.jiraUpdatedAt = "2026-09-01T10:00:00Z";
  return data;
}
async function call(api, path, body, method = "POST") {
  const response = await api(path, body === undefined ? undefined : { method, body: JSON.stringify(body) });
  return { status: response.status, ...(await response.json()) };
}
async function importTickets(api, tickets) {
  const started = await call(api, "/api/jira-imports", { action: "start", filename: "export.csv", rowCount: tickets.length });
  assert.equal(started.status, 201);
  for (let offset = 0; offset < tickets.length; offset += 250) {
    const chunk = await call(api, "/api/jira-imports", { action: "chunk", importId: started.batch.id, tickets: tickets.slice(offset, offset + 250) });
    assert.equal(chunk.status, 200);
  }
  return call(api, "/api/jira-imports", { action: "finish", importId: started.batch.id });
}

test("an incomplete Jira import keeps the registry intact until all tickets and participants arrive", async () => {
  const data = fixture();
  data.jiraTickets = [ticket("GLOBAL-9999")];
  const store = new WorkspaceStore(data);
  const api = createLocalApi(store);
  const started = await call(api, "/api/jira-imports", { action: "start", filename: "export.csv", rowCount: 2 });
  const importId = started.batch.id;
  await call(api, "/api/jira-imports", { action: "chunk", importId, tickets: [ticket("GLOBAL-1")] });
  const incomplete = await call(api, "/api/jira-imports", { action: "finish", importId, expectedTicketCount: 2, expectedParticipantCount: 60 });
  assert.equal(incomplete.status, 409);
  assert.deepEqual(store.read().jiraTickets, data.jiraTickets);
  const participants = Array.from({ length: 60 }, (_, index) => ({ usercode: `C${String(index).padStart(7, "0")}`, jiraUserId: String(index) }));
  await call(api, "/api/jira-imports", { action: "chunk", importId, tickets: [ticket("GLOBAL-2", { participants })] });
  const complete = await call(api, "/api/jira-imports", { action: "finish", importId, expectedTicketCount: 2, expectedParticipantCount: 60 });
  assert.equal(complete.status, 200);
  assert.equal(complete.batch.participantCount, 60);
  assert.equal(store.read().jiraTickets.find((item) => item.key === "GLOBAL-2").participants.length, 60);
});

test("local file round-trip preserves every collection, zero values, accents, dates and drafts", async () => {
  const data = fixture();
  data.jiraTickets = [ticket("GLOBAL-1", { summary: "Échéance, réglage ; \"test\"\nDeuxième ligne", participants: [{ usercode: "C1234567", jiraUserId: "x" }] })];
  data.drafts = [{ scope: "market", ownerId: "market-local", data: { meetingDate: "2026-08-28", priority: "À traiter", progress: 0 } }];
  data.preferences = { "market-pulse:appearance:v1": "dark" };
  assert.deepEqual(await decodeWorkspace(await encodeWorkspace(data)), data);
});

test("refuses incomplete, incompatible and externally modified files before changing the workspace", async () => {
  const store = new WorkspaceStore(fixture());
  const original = store.snapshot();
  await assert.rejects(decodeWorkspace("{"), /illisible/);
  await assert.rejects(decodeWorkspace(JSON.stringify({ schemaVersion: 5, data: {} })), /seul point/);
  const envelope = JSON.parse(await encodeWorkspace(original));
  envelope.schemaVersion = 2;
  await assert.rejects(decodeWorkspace(JSON.stringify(envelope)), /version/);
  envelope.schemaVersion = 1;
  envelope.data.users[0].name = "Autre nom";
  await assert.rejects(decodeWorkspace(JSON.stringify(envelope)), /intégrité/);
  assert.deepEqual(store.snapshot(), original);
});

test("rejects duplicate ticket IDs, impossible dates and missing collections", () => {
  const data = fixture();
  data.jiraTickets = [ticket("GLOBAL-1"), ticket("GLOBAL-1")];
  assert.throws(() => validateWorkspace(data), /double/);
  data.jiraTickets = [];
  data.points = [{ id: "point", marketId: "market-local", year: 2026, week: 35, meetingDate: "2026-02-30", data: {} }];
  assert.throws(() => validateWorkspace(data), /hebdomadaire/);
  data.points = [];
  delete data.plannerTasks;
  assert.throws(() => validateWorkspace(data), /simulations/);
});

test("local API never falls back to network requests", async (t) => {
  t.mock.method(globalThis, "fetch", () => { throw new Error("Network is forbidden"); });
  const api = createLocalApi(new WorkspaceStore(fixture()));
  assert.equal((await call(api, "/api/session")).user.username, "GLOBAL");
  assert.equal((await call(api, "/api/markets")).markets.length, 1);
  assert.equal((await call(api, "/api/global-users")).users.length, 2);
  assert.equal((await call(api, "https://remote.example.test/api/markets")).status, 403);
  assert.equal((await call(api, "/api/unknown")).status, 404);
  const abort = new AbortController(); abort.abort();
  await assert.rejects(api("/api/markets", { signal: abort.signal }), { name: "AbortError" });
});

test("completed analyst tickets include assignee OR participant once; open stock is assignee-only", async () => {
  const data = fixture();
  data.jiraTickets = [
    ticket("GLOBAL-1"),
    ticket("GLOBAL-2", { status: "Résolu", assigneeUserCode: "B1234567", participants: [{ usercode: "A1234567", jiraUserId: "1" }] }),
    ticket("GLOBAL-3", { participants: [{ usercode: "A1234567", jiraUserId: "1" }] }),
    ticket("GLOBAL-4", { status: "En cours" }),
    ticket("GLOBAL-5", { status: "En attente du client" }),
    ticket("GLOBAL-6", { status: "En cours", assigneeUserCode: "B1234567", participants: [{ usercode: "A1234567", jiraUserId: "1" }] }),
    ticket("GLOBAL-7", { status: "Abandonnée" }),
    ticket("GLOBAL-8", { updatedAt: "2026-08-23T23:59:00" }),
    ticket("GLOBAL-9", { updatedAt: "2026-08-31T00:00:00" }),
  ];
  const api = createLocalApi(new WorkspaceStore(data));
  const result = await call(api, "/api/analyst-jira?analystId=analyst&year=2026&week=35");
  assert.deepEqual(result.snapshot.resolvedTickets.map((item) => item.key).sort(), ["GLOBAL-1", "GLOBAL-2", "GLOBAL-3"]);
  assert.deepEqual(result.snapshot.tickets.map((item) => item.key).sort(), ["GLOBAL-4", "GLOBAL-5"]);
});

test("history uses last modification rather than resolution date and includes unsaved zero weeks", async () => {
  const data = fixture();
  data.jiraTickets = [ticket("GLOBAL-1", { resolutionAt: "2026-08-01T09:00:00" }), ticket("GLOBAL-2", { updatedAt: "2026-08-23T10:00:00" }), ticket("GLOBAL-3", { status: "Abandonné" })];
  const api = createLocalApi(new WorkspaceStore(data));
  const result = await call(api, "/api/analyst-jira?analystId=analyst&view=history&from=2026-08-03&to=2026-08-30");
  assert.deepEqual(result.history.weeks.map((week) => [week.week, week.count]), [[32, 0], [33, 0], [34, 1], [35, 1]]);
  assert.equal((await call(api, "/api/analyst-jira?analystId=analyst&view=history&from=2026-0&to=2026-08-30")).status, 400);
});

test("market Jira excludes analysts and completed tickets, retaining stable market IDs after rename", async () => {
  const data = fixture();
  data.jiraTickets = [ticket("GLOBAL-1", { status: "En cours" }), ticket("GLOBAL-2", { status: "En cours", assigneeUserCode: "B1234567" }), ticket("GLOBAL-3", { assigneeUserCode: "B1234567" })];
  const api = createLocalApi(new WorkspaceStore(data));
  const changed = await call(api, "/api/markets", { id: "market-local", name: "Nouveau nom", shortCode: "TEST", jiraWarningDays: 10, jiraCriticalDays: 8, plannerTags: ["MEN-PB"] }, "PATCH");
  assert.equal(changed.market.id, "market-local");
  assert.equal(changed.market.jiraCriticalDays, 11);
  const result = await call(api, "/api/jira-week?marketId=market-local&year=2026&week=35");
  assert.deepEqual(result.snapshot.summary.detailedTickets.map((item) => item.key), ["GLOBAL-2"]);
  assert.deepEqual(result.assignments["market-local"], ["B1234567"]);
});

test("directory enforces unique USERCODEs and emails and a single tariff manager", async () => {
  const api = createLocalApi(new WorkspaceStore(fixture()));
  const person = { name: "Casey Doe", email: "casey@example.test", usercode: "A1234567", role: "chef-produit", marketIds: ["market-local"] };
  assert.equal((await call(api, "/api/global-users", person)).status, 409);
  assert.equal((await call(api, "/api/global-users", { ...person, usercode: "C1234567", email: "john@example.test" })).status, 409);
  assert.equal((await call(api, "/api/global-users", { ...person, usercode: "", role: "manager-tarif", marketIds: [] })).status, 201);
  assert.equal((await call(api, "/api/global-users", { ...person, usercode: "", role: "manager-tarif", email: "manager@example.test", marketIds: [] })).status, 409);
});

test("weekly point save updates a week without functional versioning", async () => {
  const store = new WorkspaceStore(fixture());
  const api = createLocalApi(store);
  const data = { meetingDate: "2026-08-28", priority: "Dossier initial", dossiers: [], operations: [], jira: [], themeColor: "mint" };
  const first = await call(api, "/api/points", { marketId: "market-local", data });
  const next = await call(api, "/api/points", { marketId: "market-local", data: { ...data, priority: "Dossier modifié" } });
  assert.equal(next.point.id, first.point.id);
  assert.equal(store.read().points.length, 1);
  assert.equal(store.read().points[0].week, 35);
  assert.equal((await call(api, "/api/points?marketId=market-local")).points[0].data.priority, "Dossier modifié");
});

test("interrupted Jira imports do not overwrite the validated registry", async () => {
  const data = fixture(); data.jiraTickets = [ticket("GLOBAL-1")];
  const store = new WorkspaceStore(data); const api = createLocalApi(store);
  const start = await call(api, "/api/jira-imports", { action: "start", filename: "test.csv", rowCount: 1 });
  await call(api, "/api/jira-imports", { action: "chunk", importId: start.batch.id, tickets: [ticket("GLOBAL-1", { status: "En cours" })] });
  assert.equal(store.read().jiraTickets[0].status, "Fini");
  await call(api, "/api/jira-imports", { action: "fail", importId: start.batch.id });
  assert.equal(store.read().jiraTickets[0].status, "Fini");
  assert.equal(store.read().jiraImports.at(-1).status, "failed");
});

test("reimport replaces a ticket and its participants instead of accumulating duplicates", async () => {
  const store = new WorkspaceStore(fixture()); const api = createLocalApi(store);
  await importTickets(api, [ticket("GLOBAL-1", { participants: [{ usercode: "C1234567", jiraUserId: "c" }] })]);
  await importTickets(api, [ticket("GLOBAL-1", { status: "En cours", participants: [] })]);
  assert.equal(store.read().jiraTickets.length, 1);
  assert.equal(store.read().jiraTickets[0].status, "En cours");
  assert.equal(store.jiraForPerson("C1234567").length, 0);
});

test("imports and links 25,000 CSV rows with repeated participant columns without truncating", async () => {
  const header = "Clé de ticket,État,Résumé,Création,Personne assignée,Mise à jour,Participants,Participants";
  const csv = [header, ...Array.from({ length: 25000 }, (_, index) => `GLOBAL-${index + 1},Fini,Ticket ${index + 1},01/08/2026 10:00,B1234567,28/08/2026 10:00,A1234567(1),A1234567(1)`)].join("\n");
  const parsed = parseJiraCsv(csv);
  assert.equal(parsed.tickets.length, 25000);
  const store = new WorkspaceStore(fixture()); const api = createLocalApi(store);
  const imported = await importTickets(api, parsed.tickets);
  assert.equal(imported.batch.ticketCount, 25000);
  assert.equal(imported.batch.participantCount, 25000);
  const result = await call(api, "/api/analyst-jira?analystId=analyst&year=2026&week=35");
  assert.equal(result.snapshot.resolvedTickets.length, 25000);
  assert.ok(result.snapshot.resolvedTickets.some((item) => item.key === "GLOBAL-25000"));
  assert.equal(result.snapshot.tickets.length, 0);
  assert.equal((await decodeWorkspace(await encodeWorkspace(store.snapshot()))).jiraTickets.length, 25000);
});

test("Planner imports preserve per-simulation turnover without changing saved points on read", async () => {
  const data = fixture(); data.markets[0].plannerTags = ["MEN-PB"];
  const store = new WorkspaceStore(data); const api = createLocalApi(store);
  const rawText = "ID de tâche\tNom de tâche\tCatégorie\tStatut\tÉtiquettes\tCommentaires\nTASK1\t2026-08-AOUT-FOURNISSEUR TEST\tSimulation\tNon démarrées\tMEN-PB\tAchats 12 mG : 1 234,56 €;Code Fournisseur : X0001;Variation GLOBAL : 2%;Variation pondérée : 1,5%";
  const imported = await call(api, "/api/planner-tasks", { rawText });
  assert.equal(imported.status, 201);
  assert.equal(imported.imported, 1);
  assert.equal(imported.tasks[0].metrics.purchases12m, 1234.56);
  await call(api, "/api/planner-tasks", { rawText });
  assert.equal(store.read().plannerTasks.length, 1);
  await call(api, "/api/points", { marketId: "market-local", data: { meetingDate: "2026-08-28", operations: [], dossiers: [], jira: [] } });
  const points = await call(api, "/api/points?marketId=market-local");
  assert.deepEqual(points.points[0].data.operations, []);
  const planner = await call(api, "/api/planner-tasks");
  assert.equal(planner.tasks.length, 1);
  assert.equal(planner.tasks[0].metrics.purchases12m, 1234.56);
});

test("draft snapshots survive serialization and are isolated from caller mutations", async () => {
  const store = new WorkspaceStore(fixture());
  const draft = { scope: "analyst", ownerId: "analyst", data: { note: "À relancer", dossiers: [{ title: "Test" }] } };
  store.writeDraft(draft); draft.data.note = "Changed";
  assert.equal(store.readDraft("analyst", "analyst").data.note, "À relancer");
  const restored = new WorkspaceStore(await decodeWorkspace(await encodeWorkspace(store.snapshot())));
  assert.equal(restored.readDraft("analyst", "analyst").data.note, "À relancer");
});

test("saving an older revision never marks newer edits or unvalidated forms as saved", () => {
  const store = new WorkspaceStore(fixture());
  store.update((data) => ({ ...data, name: "First" })); const revision = store.version();
  store.update((data) => ({ ...data, name: "Second" })); store.markSaved(revision);
  assert.equal(store.isDirty(), true);
  store.markSaved(store.version()); assert.equal(store.isDirty(), false);
  store.setPendingForm("market", true); assert.equal(store.isDirty(), true);
  store.setPendingForm("market", false); assert.equal(store.isDirty(), false);
});

test("retains separate weekly drafts and local preferences when reopening a workbook", async () => {
  const store = new WorkspaceStore(fixture());
  store.writeDraft({ scope: "analyst", ownerId: "analyst", data: { meetingDate: "2026-08-23", note: "S34" } });
  store.writeDraft({ scope: "analyst", ownerId: "analyst", data: { meetingDate: "2026-08-30", note: "S35" } });
  store.writeDraft({ scope: "analyst", ownerId: "analyst", data: { meetingDate: "2026-08-28", note: "S35 corrigée" } });
  store.writeDraft({ scope: "market", ownerId: "market-local", data: { meetingDate: "2026-08-30", note: "Marché" } });
  store.writePreference("market-pulse:appearance:v1", "dark");
  assert.equal(store.isDirty(), true);
  const restored = new WorkspaceStore(await decodeWorkspace(await encodeWorkspace(store.snapshot())));
  assert.equal(restored.read().drafts.length, 3);
  assert.equal(restored.readDraft("analyst", "analyst", "2026-08-17").data.note, "S34");
  assert.equal(restored.readDraft("analyst", "analyst", "2026-08-30").data.note, "S35 corrigée");
  assert.equal(restored.readDraft("analyst", "analyst").data.note, "S35 corrigée");
  assert.equal(restored.readPreference("market-pulse:appearance:v1"), "dark");
  const copy = restored.readDraft("analyst", "analyst");
  copy.data.note = "Autre";
  assert.equal(restored.readDraft("analyst", "analyst").data.note, "S35 corrigée");
});

function fileHandle(content = "", failWrite = false) {
  let current = content; let modified = 1; let aborted = false;
  return {
    name: "test.marketpulse.json",
    getFile: async () => new File([current], "test.marketpulse.json", { lastModified: modified }),
    createWritable: async () => {
      let pending = current;
      return {
        write: async (value) => { if (failWrite) throw new Error("Disque plein"); pending = String(value); },
        close: async () => { current = pending; modified += 1; },
        abort: async () => { aborted = true; },
      };
    },
    read: () => current,
    wasAborted: () => aborted,
  };
}

test("writes and reopens a complete file and detects external changes before overwrite", async () => {
  const data = fixture(); const handle = fileHandle();
  const expected = await writeWorkspaceFile(handle, data);
  assert.deepEqual(await readWorkspaceFile(await handle.getFile()), data);
  const wrong = { ...expected, lastModified: 0 };
  await assert.rejects(writeWorkspaceFile(handle, { ...data, name: "Other" }, wrong), /modifié ailleurs/);
  assert.deepEqual(await readWorkspaceFile(await handle.getFile()), data);
});

test("write errors abort the file transaction without changing the previous file", async () => {
  const handle = fileHandle("original", true);
  await assert.rejects(writeWorkspaceFile(handle, fixture(), fingerprint(await handle.getFile())), /Disque plein/);
  assert.equal(handle.read(), "original");
  assert.equal(handle.wasAborted(), true);
});

test("an earlier recovery file accepts ordinary imports without its original CSV", async () => {
  const data = fixture();
  data.source = { exportedAt: "2026-09-02T10:00:00Z", pendingJira: { csvFilename: "origine.csv", expectedTickets: 12491, expectedParticipants: 11214, recoveredTickets: 10025, recoveredParticipants: 10025 } };
  data.jiraImports = [{ id: "remote-import", sourceProfile: "jira-participants", filename: "origine.csv", status: "completed", rowCount: 12491, ticketCount: 12491, participantCount: 11214, rejectedCount: 0, repairedTextCount: 0, unknownUserCodeCount: 0, createdAt: "2026-09-01T10:00:00Z", completedAt: "2026-09-01T10:01:00Z" }];
  data.points = [{ id: "saved", marketId: "market-local", year: 2026, week: 35, meetingDate: "2026-08-28", pointName: "Mon marché", themeColor: "mint", data: { jira: { total: 42 }, note: "Point conservé" }, createdAt: "2026-08-28T10:00:00Z" }];
  data.drafts = [{ scope: "market", ownerId: "market-local", data: { meetingDate: "2026-09-03", note: "Mes changements locaux" } }];
  data.preferences = { "market-pulse:appearance:v1": "dark" };
  const store = new WorkspaceStore(data);
  const api = createLocalApi(store);
  assert.equal(store.read().source.pendingJira, undefined);
  assert.equal(store.isDirty(), true);
  assert.deepEqual(store.read().points, data.points);
  assert.deepEqual(store.read().drafts, data.drafts);
  assert.deepEqual(store.read().preferences, data.preferences);
  assert.ok(data.source.pendingJira, "Opening leaves the original file untouched");
  const market = await call(api, "/api/jira-week?marketId=market-local&year=2026&week=35");
  assert.equal(market.snapshot, null);
  const stats = await call(api, "/api/analyst-jira?analystId=analyst&view=history&from=2026-08-03&to=2026-08-30");
  assert.equal(stats.status, 200);
  assert.equal(stats.history, null);
  const imports = await call(api, "/api/jira-imports");
  assert.deepEqual(imports.registry, { ticketCount: 0, participantCount: 0 });
  assert.deepEqual(imports.batches, []);
  assert.equal(imports.warning, undefined);
  const finished = await importTickets(api, [ticket("GLOBAL-1"), ticket("GLOBAL-2")]);
  assert.equal(finished.status, 200);
  assert.equal(finished.batch.filename, "export.csv");
  assert.equal(finished.batch.ticketCount, 2);
  const history = await call(api, "/api/analyst-jira?analystId=analyst&view=history&from=2026-08-03&to=2026-08-30");
  assert.equal(history.history.weeks.reduce((sum, week) => sum + week.count, 0), 2);
  const reopened = new WorkspaceStore(await decodeWorkspace(await encodeWorkspace(store.snapshot())));
  assert.deepEqual(reopened.snapshot(), store.snapshot());
  assert.equal(reopened.isDirty(), false);
  reopened.replace(data);
  assert.equal(reopened.read().source.pendingJira, undefined);
  assert.equal(reopened.isDirty(), true);
});

test("ordinary workbooks retain their existing Jira imports on open and replacement", () => {
  const data = fixture();
  data.jiraTickets = [ticket("GLOBAL-1")];
  data.source = { exportedAt: "2026-09-03T10:00:00Z", version: 38 };
  const store = new WorkspaceStore(data);
  assert.deepEqual(store.snapshot(), data);
  assert.equal(store.isDirty(), false);
  store.replace(data);
  assert.deepEqual(store.snapshot(), data);
  assert.equal(store.isDirty(), false);
});

test("only a pristine empty starter yields to the embedded site at startup", () => {
  const empty = newWorkspace();
  assert.equal(isEmptyStarterWorkspace(empty), true);
  const renamed = structuredClone(empty); renamed.markets[0].name = "Mon marché personnalisé";
  assert.equal(isEmptyStarterWorkspace(renamed), false);
  const edited = structuredClone(empty); edited.drafts.push({ scope: "market", ownerId: "market-local", data: { note: "Conserver ce travail" } });
  assert.equal(isEmptyStarterWorkspace(edited), false);
  assert.equal(isEmptyStarterWorkspace(fixture()), false);
});

test("imports and file reopening preserve meeting edits and manual source choices", async () => {
  const data = fixture();
  const store = new WorkspaceStore(data);
  const api = createLocalApi(store);
  const marketPoint = { meetingDate: "2026-09-03", pointName: "Point marché", jiraMode: "manual", plannerMode: "manual", priority: "Décision prise en réunion", dossiers: [], jira: [{ status: "En cours", count: 42, summary: "Synthèse manuelle" }], operations: [{ id: "manual", name: "Suivi corrigé", steps: [["Contrôle", "Fait"]] }], preferences: { readModules: { comparison: false } } };
  const analystPoint = { meetingDate: "2026-09-03", periodFrom: "2026-08-31", periodTo: "2026-09-06", jiraMode: "manual", manualJiraCounts: { resolved: 7, open: 0 }, jira: [], jiraResolved: [], note: "Arbitrage confirmé", dossiers: [] };
  assert.equal((await call(api, "/api/points", { marketId: "market-local", data: marketPoint })).status, 201);
  assert.equal((await call(api, "/api/analyst-points", { analystId: "analyst", data: analystPoint })).status, 201);
  await importTickets(api, [ticket("GLOBAL-20")]);
  const reopened = new WorkspaceStore(await decodeWorkspace(await encodeWorkspace(store.snapshot())));
  const next = createLocalApi(reopened);
  assert.deepEqual((await call(next, "/api/points?marketId=market-local")).points[0].data, marketPoint);
  assert.deepEqual((await call(next, "/api/analyst-points?analystId=analyst")).points[0].data, analystPoint);
  assert.equal((await call(next, "/api/jira-imports")).registry.ticketCount, 1);
});

test('feedback tickets, screenshots and status history survive workbook reopening; retries do not duplicate tickets', async () => {
  const store = new WorkspaceStore(newWorkspace());
  const api = createLocalApi(store);
  const draft = { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', kind: 'idea', title: 'Nouvelle idée', detail: 'Une capture', context: 'Statistiques', reporterUserCode: 'A1234567', captures: [{ name: 'capture.png', dataUrl: 'data:image/png;base64,aA==' }] };
  const create = () => api('/api/feedback', { method: 'POST', body: JSON.stringify(draft) });
  assert.equal((await create()).status, 201);
  assert.equal((await create()).status, 200);
  let payload = await (await api('/api/feedback')).json();
  assert.equal(payload.items.length, 1);
  const item = payload.items[0];
  const updated = await api('/api/feedback', { method: 'PATCH', body: JSON.stringify({ id: item.id, status: 'Résolu', by: 'B7654321', expectedUpdatedAt: item.updatedAt }) });
  assert.equal(updated.status, 200);
  const reopened = new WorkspaceStore(await decodeWorkspace(await encodeWorkspace(store.snapshot())));
  const detail = await (await createLocalApi(reopened)(`/api/feedback?id=${item.id}`)).json();
  assert.equal(detail.item.status, 'Résolu');
  assert.equal(detail.item.reporterUserCode, 'A1234567');
  assert.equal(detail.item.captures[0].dataUrl, draft.captures[0].dataUrl);
  assert.equal(detail.item.history.length, 2);
});
