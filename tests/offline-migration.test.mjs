import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

async function load(file) {
  const result = await build({ entryPoints: [new URL(file, import.meta.url).pathname], bundle: true, platform: "node", format: "esm", write: false, logLevel: "silent" });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}
const { decodeMigrationCheckpoint, encodeMigrationCheckpoint, completeMigrationWithCsv, completeMigrationFromNative } = await load("../offline/migration-data.ts");
const { newWorkspace, encodeWorkspace, decodeWorkspace } = await load("../offline/workspace-data.ts");
const { parseJiraCsv } = await load("../lib/jira-csv.ts");

const header = "Clé de ticket,ID de ticket,État,Résumé,Création,Personne assignée,Mise à jour,Participants";
function fixture(total = 4, recovered = 2) {
  const lines = Array.from({ length: total }, (_, index) => `GLOBAL-${index + 1},${index + 1},Fini,Échéance ${index + 1},01/08/2026 10:00,B1234567,28/08/2026 11:00,A1234567(${index + 1})`);
  const csv = [header, ...lines].join("\n");
  const tickets = parseJiraCsv(csv).tickets;
  const base = newWorkspace();
  base.name = "Points à reprendre";
  base.points = [{ id: "point-1", marketId: "market-local", year: 2026, week: 35, meetingDate: "2026-08-28", pointName: "Réunion", themeColor: "mint", data: { note: "Préserver le texte\n0 %", operations: [], dossiers: [] }, createdAt: "2026-08-28T10:00:00Z" }];
  base.preferences = { theme: "dark" };
  base.drafts = [{ scope: "market", ownerId: "market-local", data: { meetingDate: "2026-08-28", note: "À conserver" } }];
  base.jiraImports = [{ id: "import-1", filename: "origine.csv", sourceProfile: "jira-participants", status: "completed", rowCount: total, ticketCount: total, participantCount: total, rejectedCount: 0, repairedTextCount: 0, unknownUserCodeCount: 0, createdAt: "2026-08-31T10:00:00Z", completedAt: "2026-08-31T10:01:00Z" }];
  base.jiraUpdatedAt = "2026-08-31T10:01:00Z";
  base.source = { exportedAt: "2026-09-02T10:00:00Z", version: 38, notes: ["Dates originales conservées."] };
  const checkpoint = {
    base, csvFilename: "origine.csv", expected: { tickets: total, participants: total, rows: total },
    recoveredTickets: tickets.slice(0, recovered).map((ticket) => ({ ...ticket, participants: [] })),
    // A recovered participation may belong to a ticket outside the recovered ticket page range.
    recoveredParticipants: tickets.slice(total - recovered).map((ticket) => ({ ticketKey: ticket.key, usercode: ticket.participants[0].usercode, jiraUserId: ticket.participants[0].jiraUserId })),
  };
  return { checkpoint, csv, lines, tickets };
}

test("checkpoint round-trip verifies its checksum and cannot open as a finished workbook", async () => {
  const { checkpoint } = fixture();
  const text = await encodeMigrationCheckpoint(checkpoint);
  assert.deepEqual(await decodeMigrationCheckpoint(text), checkpoint);
  await assert.rejects(decodeWorkspace(text), /classeur|point/);
  const envelope = JSON.parse(text);
  envelope.data.base.name = "Changed";
  await assert.rejects(decodeMigrationCheckpoint(JSON.stringify(envelope)), /modifiée/);
});

test("completes more than 12,000 tickets and reconciles participants beyond the native page range", async () => {
  const { checkpoint, csv, tickets } = fixture(12491, 10025);
  const before = structuredClone(checkpoint);
  const { data, report } = completeMigrationWithCsv(checkpoint, csv);
  assert.equal(report.tickets, 12491);
  assert.equal(report.completedTickets, 2466);
  assert.equal(report.checkedParticipants, 10025);
  assert.deepEqual(data.jiraTickets, tickets);
  for (const key of ["points", "users", "markets", "analystPoints", "plannerTasks", "drafts", "preferences", "jiraImports", "jiraUpdatedAt"]) assert.deepEqual(data[key], before.base[key]);
  assert.deepEqual(await decodeWorkspace(await encodeWorkspace(data)), data);
  assert.deepEqual(checkpoint, before);
});

test("matching counts cannot hide a changed ticket or a replaced recovered ticket key", () => {
  const { checkpoint, csv } = fixture();
  const original = structuredClone(checkpoint);
  assert.throws(() => completeMigrationWithCsv(checkpoint, csv.replace("Échéance 1", "Autre dossier")), /GLOBAL-1 diffère/);
  assert.throws(() => completeMigrationWithCsv(checkpoint, csv.replace("GLOBAL-1,", "GLOBAL-999,")), /GLOBAL-1 diffère/);
  assert.deepEqual(checkpoint, original);
});

test("matching participant totals cannot hide changed USERCODEs or Jira user identifiers", () => {
  const { checkpoint, csv } = fixture();
  assert.throws(() => completeMigrationWithCsv(checkpoint, csv.replace("A1234567(4)", "C1234567(4)")), /participants du ticket GLOBAL-4/);
  assert.throws(() => completeMigrationWithCsv(checkpoint, csv.replace("A1234567(4)", "A1234567(autre)")), /participants du ticket GLOBAL-4/);
});

test("refuses incomplete CSVs, missing participant columns, duplicate rows and invalid dates", () => {
  const { checkpoint, csv, lines } = fixture();
  assert.throws(() => completeMigrationWithCsv(checkpoint, [header, ...lines.slice(0, 3)].join("\n")), /attend/);
  assert.throws(() => completeMigrationWithCsv(checkpoint, csv.replace("Participants", "Autre colonne")), /attend/);
  assert.throws(() => completeMigrationWithCsv(checkpoint, `${csv}\n${lines[0]}`), /doublons/);
  assert.throws(() => completeMigrationWithCsv(checkpoint, csv.replace("28/08/2026", "31/02/2026")), /dates invalides/);
});

test("refuses a newer CSV when stored modification dates differ and retains the original checkpoint", () => {
  const { checkpoint, csv } = fixture();
  const before = structuredClone(checkpoint);
  assert.throws(() => completeMigrationWithCsv(checkpoint, csv.replace("28/08/2026 11:00", "29/08/2026 11:00")), /diffère/);
  assert.deepEqual(checkpoint, before);
});

test("native completion refuses partial extraction and reconstructs a complete extraction exactly", () => {
  const partial = fixture();
  assert.throws(() => completeMigrationFromNative(partial.checkpoint), /incomplet/);
  const full = fixture(4, 4);
  const { data, report } = completeMigrationFromNative(full.checkpoint);
  assert.deepEqual(data.jiraTickets, full.tickets);
  assert.equal(report.completedTickets, 0);
  assert.equal(report.csvFilename, null);
});

test("refuses inconsistent checkpoint counts and duplicate participant identities", async () => {
  const { checkpoint } = fixture();
  checkpoint.recoveredParticipants.push({ ...checkpoint.recoveredParticipants[0] });
  await assert.rejects(encodeMigrationCheckpoint(checkpoint), /double/);
  checkpoint.recoveredParticipants.pop();
  checkpoint.expected.tickets = 1;
  await assert.rejects(encodeMigrationCheckpoint(checkpoint), /incohérents/);
});
