import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function transpile(path) {
  return ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}

const jiraUrl = `data:text/javascript;base64,${Buffer.from(transpile("../lib/jira-import.ts")).toString("base64")}`;
const csvSource = transpile("../lib/jira-csv.ts").replace('from "./jira-import"', `from "${jiraUrl}"`);
const csv = await import(`data:text/javascript;base64,${Buffer.from(csvSource).toString("base64")}`);

test("parses repeated Jira participant columns and repairs mojibake only when present", () => {
  const value = [
    'ClÃ© de ticket,ID de ticket,Ã‰tat,RÃ©sumÃ©,CrÃ©ation,Personne assignÃ©e,Mise Ã  jour,Participants Ã  la requÃªte,Participants Ã  la requÃªte',
    'TEST-101,100001,En cours,"MEN : erreur, tarif",12/08/2026 09:15,T0000003,13/08/2026 11:20,T0000003(JIRAUSER001),T0000001(JIRAUSER002)',
  ].join("\n");
  const decoded = csv.decodeJiraCsv(new TextEncoder().encode(value));
  const result = csv.parseJiraCsv(decoded.text);

  assert.equal(decoded.encoding, "UTF-8");
  assert.ok(decoded.repairedTextCount > 0);
  assert.equal(result.tickets.length, 1);
  assert.equal(result.tickets[0].summary, "MEN : erreur, tarif");
  assert.equal(result.tickets[0].createdAt, "2026-08-12T09:15:00");
  assert.equal(result.tickets[0].updatedAt, "2026-08-13T11:20:00");
  assert.deepEqual(result.tickets[0].participants, [
    { usercode: "T0000003", jiraUserId: "JIRAUSER001" },
    { usercode: "T0000001", jiraUserId: "JIRAUSER002" },
  ]);
});

test("keeps valid UTF-8 accents unchanged", () => {
  const value = [
    "Clé de ticket;État;Résumé;Création;Personne assignée;Mise à jour;Date de résolution",
    "GLOBAL-1;Résolu;Référencement terminé;01/08/2026 08:00;A1234567;02/08/2026 09:00;02/08/2026 08:30",
  ].join("\n");
  const decoded = csv.decodeJiraCsv(new TextEncoder().encode(value));
  const result = csv.parseJiraCsv(decoded.text);

  assert.equal(decoded.repairedTextCount, 0);
  assert.equal(result.repairedTextCount, 0);
  assert.equal(result.tickets[0].status, "Résolu");
  assert.equal(result.tickets[0].summary, "Référencement terminé");
  assert.equal(result.hasResolutionColumn, true);
  assert.equal(result.closedTicketCount, 1);
  assert.equal(result.resolvedDatedCount, 1);
  assert.equal(result.closedWithoutResolutionDate, 0);
  assert.equal(result.tickets[0].resolutionAt, "2026-08-02T08:30:00");
});

test("reads complete four-digit years and short years without truncation", () => {
  const header = "Clé de ticket;État;Résumé;Création;Personne assignée;Mise à jour";
  const result = csv.parseJiraCsv([
    header,
    "GLOBAL-1;Fini;Année complète;01/08/2026 08:15;A1234567;28/08/2026 10:45",
    "GLOBAL-2;Fini;Année courte;01/08/26 08:15;A1234567;28/08/26 10:45",
    "GLOBAL-3;Fini;Date invalide;31/02/2026 08:15;A1234567;28/08/2026 10:77",
  ].join("\n"));
  for (const ticket of result.tickets.slice(0, 2)) {
    assert.equal(ticket.createdAt, "2026-08-01T08:15:00");
    assert.equal(ticket.updatedAt, "2026-08-28T10:45:00");
  }
  assert.equal(result.tickets[2].createdAt, "");
  assert.equal(result.tickets[2].updatedAt, "");
  assert.equal(result.invalidDateRows, 1);
});

test("flags an open-only Jira export without a resolution column", () => {
  const value = [
    "Clé de ticket;État;Résumé;Création;Personne assignée;Mise à jour",
    "GLOBAL-2;En cours;Ticket ouvert;01/08/2026 08:00;A1234567;02/08/2026 09:00",
  ].join("\n");
  const result = csv.parseJiraCsv(value);

  assert.equal(result.hasResolutionColumn, false);
  assert.equal(result.openTicketCount, 1);
  assert.equal(result.closedTicketCount, 0);
});

test("preserves abandoned import rows without counting them as open or completed", () => {
  const value = [
    "Clé de ticket;État;Résumé;Création;Personne assignée;Mise à jour",
    "GLOBAL-1;Abandonnée;Ticket abandonné;01/08/2026 08:00;A1234567;25/08/2026 09:00",
    "GLOBAL-2;En cours;Ticket ouvert;01/08/2026 08:00;A1234567;25/08/2026 09:00",
    "GLOBAL-3;Fini;Ticket terminé;01/08/2026 08:00;A1234567;25/08/2026 09:00",
  ].join("\n");
  const result = csv.parseJiraCsv(value);
  assert.equal(result.tickets.length, 3);
  assert.equal(result.rejectedRows, 0);
  assert.equal(result.openTicketCount, 1);
  assert.equal(result.closedTicketCount, 1);
  assert.equal(result.abandonedTicketCount, 1);
  assert.equal(result.closedWithoutResolutionDate, 1);
});

test("recognizes the full Jira custom-field participant header", () => {
  const value = [
    "Clé de ticket;ID de ticket;État;Résumé;Création;Personne assignée;Mise à jour;Champs personnalisés (Participants à la requête)",
    "TEST-102;100002;En attente de changement;CAT : Fournisseur exemple;12/08/2026 09:00;X0000002;27/08/2026 13:38;A0000001(JIRAUSER003)",
  ].join("\n");
  const result = csv.parseJiraCsv(value);

  assert.equal(result.tickets.length, 1);
  assert.deepEqual(result.tickets[0].participants, [{ usercode: "A0000001", jiraUserId: "JIRAUSER003" }]);
});

test("handles more than twelve thousand Jira rows", () => {
  const header = "Clé de ticket;ID de ticket;État;Résumé;Création;Personne assignée;Mise à jour;Participants à la requête";
  const rows = Array.from({ length: 12_050 }, (_, index) => `GLOBAL-${index + 1};${1_600_000 + index};En cours;Ticket ${index + 1};01/08/2026 08:00;A1234567;02/08/2026 09:00;B1234567(JIRAUSER${index + 1})`);
  const result = csv.parseJiraCsv([header, ...rows].join("\n"));

  assert.equal(result.rows, 12_050);
  assert.equal(result.tickets.length, 12_050);
  assert.equal(result.participantCount, 12_050);
  assert.equal(result.rejectedRows, 0);
});
