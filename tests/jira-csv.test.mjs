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
    'GLOBAL-12515,1648151,En cours,"MEN : erreur, tarif",12/08/2026 09:15,B6549679,13/08/2026 11:20,B6549679(JIRAUSER70973),A8512790(JIRAUSER79013)',
  ].join("\n");
  const decoded = csv.decodeJiraCsv(new TextEncoder().encode(value));
  const result = csv.parseJiraCsv(decoded.text);

  assert.equal(decoded.encoding, "UTF-8");
  assert.ok(decoded.repairedTextCount > 0);
  assert.equal(result.tickets.length, 1);
  assert.equal(result.tickets[0].summary, "MEN : erreur, tarif");
  assert.deepEqual(result.tickets[0].participants, [
    { usercode: "B6549679", jiraUserId: "JIRAUSER70973" },
    { usercode: "A8512790", jiraUserId: "JIRAUSER79013" },
  ]);
});

test("keeps valid UTF-8 accents unchanged", () => {
  const value = [
    "Clé de ticket;État;Résumé;Création;Personne assignée;Mise à jour",
    "GLOBAL-1;Résolu;Référencement terminé;01/08/2026 08:00;A1234567;02/08/2026 09:00",
  ].join("\n");
  const decoded = csv.decodeJiraCsv(new TextEncoder().encode(value));
  const result = csv.parseJiraCsv(decoded.text);

  assert.equal(decoded.repairedTextCount, 0);
  assert.equal(result.repairedTextCount, 0);
  assert.equal(result.tickets[0].status, "Résolu");
  assert.equal(result.tickets[0].summary, "Référencement terminé");
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
