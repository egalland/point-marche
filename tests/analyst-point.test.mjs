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
const analystSource = transpile("../lib/analyst-point.ts").replace('from "./jira-import"', `from "${jiraUrl}"`);
const analystPoint = await import(`data:text/javascript;base64,${Buffer.from(analystSource).toString("base64")}`);

const analyst = { id: "analyst", name: "Jane DOE", email: "jane@example.test", usercode: "A1234567", plannerAlias: "Jane", role: "analyste-tarif-referentiel", marketIds: [] };

test("keeps open En cours tickets for the selected analyst USERCODE", () => {
  const table = [
    "Clé de ticket\tID de ticket\tÉtat\tRésumé\tCréation\tPersonne assignée\tMise à jour",
    "GLOBAL-100\t1000001\tEn cours\tTicket analyste actif\t20/08/2026 09:00\tA1234567\t27/08/2026 10:00",
    "GLOBAL-101\t1000002\tRésolu\tTicket analyste terminé\t20/08/2026 09:00\tA1234567\t27/08/2026 10:00",
    "GLOBAL-102\t1000003\tEn cours\tTicket d’un autre analyste\t20/08/2026 09:00\tB1234567\t27/08/2026 10:00",
  ].join("\n");

  const tickets = analystPoint.analystJiraTickets(table, analyst);

  assert.equal(tickets.length, 1);
  assert.equal(tickets[0].key, "GLOBAL-100");
  assert.equal(tickets[0].status, "En cours");
});
