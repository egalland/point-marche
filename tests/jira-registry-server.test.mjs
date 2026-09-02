import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import ts from "typescript";

function moduleUrl(path, replacements = {}) {
  let source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const [specifier, target] of Object.entries(replacements)) source = source.replaceAll(`from "${specifier}"`, `from "${target}"`);
  return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
}

const ormUrl = import.meta.resolve("drizzle-orm");
const runtimeUrl = moduleUrl("../lib/runtime-env.ts");
const jiraUrl = moduleUrl("../lib/jira-import.ts");
const isoUrl = moduleUrl("../lib/iso-week.ts");
const activityUrl = moduleUrl("../lib/jira-analyst-activity.ts", { "./iso-week": isoUrl, "./jira-import": jiraUrl });
const schemaUrl = moduleUrl("../db/schema.ts", { "drizzle-orm": ormUrl, "drizzle-orm/sqlite-core": import.meta.resolve("drizzle-orm/sqlite-core") });
const dbUrl = moduleUrl("../db/index.ts", { "drizzle-orm/d1": import.meta.resolve("drizzle-orm/d1"), "./schema": schemaUrl, "../lib/runtime-env": runtimeUrl });
const registryUrl = moduleUrl("../lib/jira-registry-server.ts", {
  "drizzle-orm": ormUrl, "../db": dbUrl, "../db/schema": schemaUrl,
  "./iso-week": isoUrl, "./jira-analyst-activity": activityUrl, "./jira-import": jiraUrl,
});
const { runWithRuntimeEnv } = await import(runtimeUrl);
const { loadJiraActivityForAnalyst, loadOpenMarketJiraSummary } = await import(registryUrl);

function fixture(t) {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  const migrations = new URL("../drizzle/", import.meta.url);
  for (const name of readdirSync(migrations).filter((name) => name.endsWith(".sql")).sort()) sqlite.exec(readFileSync(new URL(name, migrations), "utf8"));
  const queries = [];
  const binding = {
    prepare(query) {
      const statement = sqlite.prepare(query);
      let values = [];
      return {
        bind(...params) {
          assert.ok(params.length <= 100, `D1 supports at most 100 bindings, received ${params.length}`);
          values = params;
          queries.push({ query, bindings: params.length });
          return this;
        },
        async all() { return { results: statement.all(...values) }; },
        async raw() { return statement.all(...values).map((row) => Object.values(row)); },
      };
    },
  };
  const insertTicket = sqlite.prepare("INSERT INTO jira_tickets (ticket_key, status, summary, assignee_usercode, jira_created_at, jira_updated_at) VALUES (?, ?, ?, ?, ?, ?)");
  const insertParticipant = sqlite.prepare("INSERT INTO jira_ticket_participants (id, ticket_key, usercode) VALUES (?, ?, ?)");
  return {
    sqlite, queries,
    run: (callback) => runWithRuntimeEnv({ DB: binding }, callback),
    ticket: (key, status, assignee, updated = "2026-08-25T09:00:00") => insertTicket.run(key, status, "Ticket de test", assignee, "2026-08-01T08:00:00", updated),
    participant: (key, usercode) => insertParticipant.run(`${key}:${usercode}`, key, usercode),
  };
}

test("reads 25,000 related tickets through bounded queries without truncation or duplicate participation", async (t) => {
  const db = fixture(t);
  db.sqlite.exec("BEGIN");
  for (let index = 0; index < 25_000; index += 1) {
    const key = `GLOBAL-${100_000 + index}`;
    const kind = index % 5;
    const status = ["En cours", "Fini", "Résolu", "Terminé", "En attente du client"][kind];
    db.ticket(key, status, kind === 2 || kind === 4 ? "B1234567" : "A1234567");
    if (kind >= 2) db.participant(key, "A1234567");
    if (kind === 3) db.participant(key, "C1234567");
  }
  db.sqlite.exec("COMMIT");

  const activity = await db.run(() => loadJiraActivityForAnalyst(" a1234567 ", 2026, 35));
  assert.equal(activity.open.length, 5_000);
  assert.equal(activity.resolved.length, 15_000);
  assert.equal(new Set(activity.resolved.map((ticket) => ticket.key)).size, 15_000);
  assert.ok(activity.open.every((ticket) => ticket.assigneeUserCode === "A1234567" && ticket.status === "En cours"));
  assert.equal(activity.resolved.filter((ticket) => ticket.status === "Terminé").length, 10_000);
  assert.ok(db.queries.length >= 25);
  assert.ok(db.queries.every((query) => query.bindings <= 7));
});

test("limits completed participation to the selected week and keeps older assigned open tickets", async (t) => {
  const db = fixture(t);
  db.ticket("GLOBAL-1", "Fini", "B1234567", "2026-08-24T00:00:00");
  db.ticket("GLOBAL-2", "Fini", "B1234567", "2026-08-30T23:59:59.999Z");
  db.ticket("GLOBAL-3", "Résolu", "B1234567", "2026-08-23T23:59:59");
  db.ticket("GLOBAL-4", "Résolu", "B1234567", "2026-08-31T00:00:00");
  db.ticket("GLOBAL-5", "En attente d’un tiers", "A1234567", "2026-07-01T09:00:00");
  db.ticket("GLOBAL-6", "En cours", "B1234567");
  db.ticket("GLOBAL-7", "Fini", "A1234567", "");
  for (const key of ["GLOBAL-1", "GLOBAL-2", "GLOBAL-3", "GLOBAL-4", "GLOBAL-6"]) db.participant(key, "A1234567");

  const activity = await db.run(() => loadJiraActivityForAnalyst("A1234567", 2026, 35));
  assert.deepEqual(activity.open.map((ticket) => ticket.key), ["GLOBAL-5"]);
  assert.deepEqual(activity.resolved.map((ticket) => ticket.key), ["GLOBAL-2", "GLOBAL-1"]);
});

test("excludes imported abandoned tickets from the analyst stock and weekly completions without deleting them", async (t) => {
  const db = fixture(t);
  db.ticket("GLOBAL-10858", "Abandonnée", "A1234567", "2026-02-19T09:00:00");
  db.ticket("GLOBAL-10895", "Abandonnée", "A1234567", "2026-02-24T09:00:00");
  db.ticket("GLOBAL-10935", "Abandonnée", "A1234567", "2026-02-26T09:00:00");
  db.ticket("GLOBAL-1", "Abandonné", "B1234567");
  db.participant("GLOBAL-1", "A1234567");
  db.ticket("GLOBAL-2", "Abandonnées", "A1234567");
  db.ticket("GLOBAL-3", "Fini", "A1234567");
  const activity = await db.run(() => loadJiraActivityForAnalyst("A1234567", 2026, 35));
  assert.deepEqual(activity.open, []);
  assert.deepEqual(activity.resolved.map((ticket) => ticket.key), ["GLOBAL-3"]);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS count FROM jira_tickets").get().count, 6);
});

test("reads a market with 150 people and 13,000 tickets without participant hydration or unbounded bindings", async (t) => {
  const db = fixture(t);
  db.sqlite.exec("INSERT INTO market_definitions (id, name, short_code) VALUES ('scale-market', 'Marché test', 'TEST')");
  const insertPerson = db.sqlite.prepare("INSERT INTO global_users (id, name, email, jira_name, role) VALUES (?, ?, ?, ?, ?)");
  const linkPerson = db.sqlite.prepare("INSERT INTO global_user_markets (id, user_id, market_id) VALUES (?, ?, 'scale-market')");
  db.sqlite.exec("BEGIN");
  for (let index = 0; index < 151; index += 1) {
    const id = `person-${index}`;
    insertPerson.run(id, `Personne ${index}`, `person${index}@example.test`, `A${String(index).padStart(7, "0")}`, index === 150 ? "analyste-tarif-referentiel" : index % 2 ? "chef-produit" : "chef-marche");
    linkPerson.run(id, id);
  }
  for (let index = 0; index < 13_000; index += 1) {
    db.ticket(`GLOBAL-${100_000 + index}`, index % 4 ? "En cours" : "Fini", `A${String(index % 150).padStart(7, "0")}`);
  }
  db.ticket("GLOBAL-99998", "En cours", "A0000150");
  db.ticket("GLOBAL-99999", "En cours", "B1234567");
  db.participant("GLOBAL-99999", "A0000001");
  db.ticket("GLOBAL-99996", "Abandonnée", "A0000001");
  db.ticket("GLOBAL-99997", "Abandonnés", "A0000002");
  db.sqlite.exec("COMMIT");

  const summary = await db.run(() => loadOpenMarketJiraSummary("scale-market"));
  assert.equal(summary.tickets, 9_750);
  assert.equal(summary.detailedTickets.length, 9_750);
  assert.equal(summary.people.length, 150);
  assert.ok(summary.detailedTickets.every((ticket) => ticket.status === "En cours" && ticket.marketId === "scale-market"));
  assert.ok(summary.detailedTickets.every((ticket) => ticket.key !== "GLOBAL-99998" && ticket.key !== "GLOBAL-99999"));
  assert.ok(db.queries.every((query) => query.bindings <= 4));
  assert.ok(db.queries.every((query) => !query.query.includes("jira_ticket_participants")));
});

test("propagates registry failures instead of reporting zero tickets", async () => {
  const failingDb = { prepare() { throw new Error("Database unavailable"); } };
  await assert.rejects(runWithRuntimeEnv({ DB: failingDb }, () => loadJiraActivityForAnalyst("A1234567", 2026, 35)), /Database unavailable/);
});
