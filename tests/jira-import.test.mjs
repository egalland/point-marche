import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../lib/jira-import.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const parser = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);

test("parses a Jira tab-separated assignee summary with links", () => {
  const table = [
    "Personne assignée\tÀ faire\tRéouvert\tEn cours\tEn attente du client\tEn attente d'un tiers\tEn attente de changement\tT :",
    "Jerome Fernandez\t[11](https://jira.example/todo)\t0\t[2](https://jira.example/doing)\t1\t0\t0\t14",
    "Louise Pepin\t1\t0\t3\t0\t2\t0\t6",
  ].join("\n");

  const result = parser.parseJiraAssigneeSummary(table);

  assert.equal(result.format, "tabulated");
  assert.equal(result.personCount, 2);
  assert.equal(result.tickets, 20);
  assert.equal(result.people[0].assignee, "Jerome Fernandez");
  assert.equal(result.people[0].statuses[0].count, 11);
  assert.equal(result.people[0].statuses[0].link, "https://jira.example/todo");
  assert.equal(result.people[1].total, 6);
});

test("parses the markdown form produced by a copied Jira table", () => {
  const table = [
    "| Personne assignéeÀ faireRéouvertEn coursEn attente du clientEn attente d'un tiersEn attente de changementT : | | | | | | | |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    "| Sarah Daniel | [2](https://jira.example/a) | 1 | [4](https://jira.example/c) | 0 | 0 | 3 | 10 |",
    "| Nombre total | 2 | 1 | 4 | 0 | 0 | 3 | 10 |",
  ].join("\n");

  const result = parser.parseJiraAssigneeSummary(table);

  assert.equal(result.format, "markdown");
  assert.equal(result.personCount, 1);
  assert.equal(result.tickets, 10);
  assert.deepEqual(result.people[0].statuses.map((item) => item.count), [2, 1, 4, 0, 0, 3]);
  assert.equal(result.items.length, 4);
});

test("keeps a reported remainder as other Jira statuses", () => {
  const table = "Baptiste Plaisir;2;0;1;0;0;0;5";
  const result = parser.parseJiraAssigneeSummary(table);
  const other = result.items.find((item) => item.status === "Autres statuts");

  assert.equal(result.personCount, 1);
  assert.equal(result.tickets, 5);
  assert.equal(other?.count, 2);
});

test("parses detailed Jira tickets, USERCODEs and activity dates", () => {
  const table = [
    "ClÃ© de ticket\tID de ticket\tÃ‰tat\tRÃ©sumÃ©\tCrÃ©ation\tPersonne assignÃ©e\tMise Ã  jour",
    "GLOBAL-12472\t1638106\tA faire\tQUINC : code 1017244 SINTO\t12/08/2026 12:27\tB4166056\t12/08/2026 14:17",
    "GLOBAL-11835\t1575181\tRÃ©ouvert\tBOIC : Mise Ã  jour incidence transport\t02/06/2026 11:30\tJ9535152\t25/08/2026 09:44",
  ].join("\n");

  const result = parser.parseJiraAssigneeSummary(table);

  assert.equal(result.mode, "detailed");
  assert.equal(result.format, "tabulated");
  assert.equal(result.personCount, 2);
  assert.equal(result.tickets, 2);
  assert.equal(result.detailedTickets[0].key, "GLOBAL-12472");
  assert.equal(result.detailedTickets[0].internalId, "1638106");
  assert.equal(result.detailedTickets[0].assigneeUserCode, "B4166056");
  assert.equal(result.detailedTickets[0].createdAt, "2026-08-12T12:27:00");
  assert.equal(result.detailedTickets[0].updatedAt, "2026-08-12T14:17:00");
  assert.equal(result.detailedTickets[0].link, "https://jira.example.test/browse/GLOBAL-12472");
  assert.equal(result.detailedTickets[1].status, "Réouvert");
  assert.match(result.detailedTickets[1].summary, /Mise à jour/);
});
