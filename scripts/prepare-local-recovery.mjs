import assert from "node:assert/strict";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";

const [source, destination] = process.argv.slice(2);
if (!source || !destination) throw new Error("Usage : node scripts/prepare-local-recovery.mjs DOSSIER_EXPORT FICHIER_REPRISE.json");
const root = resolve(source);
const exported = JSON.parse(await readFile(resolve(root, "application-data.json"), "utf8"));
const status = JSON.parse(await readFile(resolve(root, "export-status.json"), "utf8"));
const latestImport = exported.jiraImports.filter((batch) => batch.status === "completed").sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)))[0];
assert.ok(latestImport, "Aucun import Jira complet de référence");
assert.equal(latestImport.ticketCount, exported.expectedJiraRegistry.ticketCount, "Le dernier CSV ne couvre pas seul le registre");
assert.equal(latestImport.participantCount, exported.expectedJiraRegistry.participantCount, "Le dernier CSV ne couvre pas toutes les participations");

async function readTable(table) {
  const folder = resolve(root, "raw", table);
  const names = (await readdir(folder)).filter((name) => /^\d{5}\.json$/.test(name)).sort();
  const rows = [];
  for (const [index, name] of names.entries()) {
    assert.equal(name, `${String(index).padStart(5, "0")}.json`, `Page manquante : ${table}`);
    const page = JSON.parse(await readFile(resolve(folder, name), "utf8"));
    assert.equal(page.table, table);
    assert.equal(page.offset, rows.length, `Décalage incohérent : ${table}`);
    assert.ok(Array.isArray(page.rows));
    for (const key of ["truncated_values", "omitted_columns", "omitted_rows"]) assert.equal(page.model_projection?.[key] ?? 0, 0, `Page tronquée : ${table}/${name}`);
    for (const row of page.rows) assert.equal(row.last_import_id, latestImport.id, "Le registre contient un autre import que le CSV de référence");
    rows.push(...page.rows);
  }
  return rows;
}
async function load(file) {
  const result = await build({ entryPoints: [resolve(file)], bundle: true, platform: "node", format: "esm", write: false, logLevel: "silent" });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}
const [{ newWorkspace }, { encodeMigrationCheckpoint }, rows, people] = await Promise.all([
  load("offline/workspace-data.ts"), load("offline/migration-data.ts"), readTable("jira_tickets"), readTable("jira_ticket_participants"),
]);
const checkpoint = {
  csvFilename: latestImport.filename,
  expected: { tickets: exported.expectedJiraRegistry.ticketCount, participants: exported.expectedJiraRegistry.participantCount, rows: latestImport.rowCount },
  base: {
    ...newWorkspace(), name: "Market Pulse GLOBAL", updatedAt: exported.exportedAt,
    markets: exported.markets, users: exported.users, points: exported.points,
    analystPoints: exported.analystPoints, plannerTasks: exported.plannerTasks, plannerUpdatedAt: exported.plannerUpdatedAt,
    jiraImports: exported.jiraImports, jiraUpdatedAt: latestImport.completedAt ?? "",
    source: { exportedAt: exported.exportedAt, siteUrl: exported.sourceUrl, version: status.sourceVersion, notes: ["Copie des données métier au moment de l’export ; aucun échange automatique avec le site.", "Les dates Jira récupérées sont conservées exactement."] },
  },
  recoveredTickets: rows.map((row) => ({
    key: row.ticket_key, internalId: row.internal_id ?? "", status: row.status, summary: row.summary,
    createdAt: row.jira_created_at ?? "", updatedAt: row.jira_updated_at ?? "", resolutionAt: row.resolution_at ?? "",
    assigneeUserCode: row.assignee_usercode ?? "", link: row.link ?? "", participants: [],
  })),
  recoveredParticipants: people.map((row) => ({ ticketKey: row.ticket_key, usercode: row.usercode, jiraUserId: row.jira_user_id ?? "" })),
};
const content = await encodeMigrationCheckpoint(checkpoint);
await writeFile(resolve(destination), content, { encoding: "utf8", flag: "wx", mode: 0o600 });
console.log(JSON.stringify({ readyForCsv: true, csvFilename: checkpoint.csvFilename, expected: checkpoint.expected, recovered: { tickets: rows.length, participants: people.length }, bytes: Buffer.byteLength(content) }));
