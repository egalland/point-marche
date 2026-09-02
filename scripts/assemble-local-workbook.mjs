import assert from "node:assert/strict";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { build } from "esbuild";

const source = process.argv[2];
const destination = process.argv[3];
if (!source || !destination) throw new Error("Usage : node scripts/assemble-local-workbook.mjs DOSSIER_EXPORT FICHIER.marketpulse.json");
const root = resolve(source);
const exported = JSON.parse(await readFile(resolve(root, "application-data.json"), "utf8"));

async function readTable(table) {
  const folder = resolve(root, "raw", table);
  const pages = (await readdir(folder)).filter((name) => /^\d{5}\.json$/.test(name)).sort();
  const result = [];
  for (const [index, name] of pages.entries()) {
    assert.equal(name, `${String(index).padStart(5, "0")}.json`, `Page manquante : ${table}`);
    const page = JSON.parse(await readFile(resolve(folder, name), "utf8"));
    assert.equal(page.table, table);
    assert.equal(page.offset, result.length, `Décalage incohérent : ${table}`);
    assert.ok(Array.isArray(page.rows));
    result.push(...page.rows);
  }
  return result;
}

const [rows, participantRows] = await Promise.all([readTable("jira_tickets"), readTable("jira_ticket_participants")]);
assert.equal(rows.length, exported.expectedJiraRegistry.ticketCount, "Export Jira incomplet");
assert.equal(participantRows.length, exported.expectedJiraRegistry.participantCount, "Export des participants incomplet");
const participants = new Map();
for (const row of participantRows) {
  const people = participants.get(row.ticket_key) ?? new Map();
  assert.match(row.usercode, /^[A-Z]\d{7}$/i, "USERCODE participant invalide");
  assert.ok(!people.has(row.usercode.toUpperCase()), "Participant dupliqué");
  people.set(row.usercode.toUpperCase(), { usercode: row.usercode.toUpperCase(), jiraUserId: row.jira_user_id ?? "" });
  participants.set(row.ticket_key, people);
}
const jiraTickets = rows.map((row) => ({
  key: row.ticket_key, internalId: row.internal_id ?? "", status: row.status, summary: row.summary,
  createdAt: row.jira_created_at ?? "", updatedAt: row.jira_updated_at ?? "", resolutionAt: row.resolution_at ?? "",
  assigneeUserCode: row.assignee_usercode ?? "", link: row.link ?? "",
  participants: Array.from(participants.get(row.ticket_key)?.values() ?? []),
}));
const keys = new Set(jiraTickets.map((ticket) => ticket.key));
assert.equal(keys.size, jiraTickets.length, "Tickets Jira dupliqués");
for (const key of participants.keys()) assert.ok(keys.has(key), "Participation sans ticket");
assert.equal(jiraTickets.reduce((total, ticket) => total + ticket.participants.length, 0), participantRows.length);

const bundled = await build({ entryPoints: [resolve("offline/workspace-data.ts")], bundle: true, platform: "node", format: "esm", write: false, logLevel: "silent" });
const { newWorkspace, encodeWorkspace, decodeWorkspace } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
const latestImport = exported.jiraImports.filter((batch) => batch.status === "completed").sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)))[0];
const data = {
  ...newWorkspace(), name: "Market Pulse GLOBAL",
  markets: exported.markets, users: exported.users, points: exported.points,
  analystPoints: exported.analystPoints, plannerTasks: exported.plannerTasks, plannerUpdatedAt: exported.plannerUpdatedAt,
  jiraTickets, jiraImports: exported.jiraImports, jiraUpdatedAt: latestImport?.completedAt ?? "",
  source: { exportedAt: new Date().toISOString(), siteUrl: exported.sourceUrl, version: 38, notes: ["Copie des données métier accessibles au moment de l’export ; aucun échange automatique avec le site.", "Les dates Jira conservées sont celles du registre existant ; elles ne sont pas réinterprétées."] },
};
const content = await encodeWorkspace(data);
assert.deepEqual(await decodeWorkspace(content), data, "Échec de relecture du classeur complet");
await writeFile(resolve(destination), content, { encoding: "utf8", flag: "wx" });
const summary = {
  exportedAt: data.source.exportedAt, bytes: Buffer.byteLength(content),
  markets: data.markets.length, users: data.users.length, marketPoints: data.points.length,
  analystPoints: data.analystPoints.length, plannerTasks: data.plannerTasks.length,
  jiraTickets: data.jiraTickets.length, jiraParticipants: participantRows.length,
  jiraImports: data.jiraImports.length, integrity: "SHA-256 et relecture intégrale validés",
};
await writeFile(resolve(dirname(destination), "verification-export.json"), JSON.stringify(summary, null, 2), "utf8");
console.log(JSON.stringify(summary));
