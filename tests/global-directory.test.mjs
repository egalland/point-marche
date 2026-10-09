import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../lib/global-directory.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const directory = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);

test("limits Jira automation to product and market leads", () => {
  for (const role of ["chef-produit", "chef-marche"]) {
    assert.equal(directory.roleUsesAutomaticJira(role), true);
    assert.equal(directory.roleMailMode(role), "to");
  }
  assert.equal(directory.roleUsesAutomaticJira("analyste-tarif-referentiel"), false);
  assert.equal(directory.roleMailMode("analyste-tarif-referentiel"), "to");
});

test("keeps the Tarif manager in the main mail and other roles inactive", () => {
  assert.equal(directory.roleUsesAutomaticJira("manager-tarif"), false);
  assert.equal(directory.roleMailMode("manager-tarif"), "to");
  assert.equal(directory.roleUsesAutomaticJira("autre"), false);
  assert.equal(directory.roleMailMode("autre"), "none");
});

test("builds the Jira query from valid USERCODEs of the selected market only", () => {
  const users = [
    { id: "1", name: "John DOE", email: "john@example.test", usercode: "A1234567", role: "chef-produit", marketIds: ["market-a"] },
    { id: "2", name: "Jane DOE", email: "jane@example.test", usercode: "B7654321", role: "chef-marche", marketIds: ["market-a"] },
    { id: "3", name: "Alex MARTIN", email: "alex@example.test", usercode: "C1111111", role: "chef-produit", marketIds: ["market-b"] },
    { id: "4", name: "Invalid", email: "invalid@example.test", usercode: "Nom Jira", role: "autre", marketIds: ["market-a"] },
    { id: "5", name: "Analyst", email: "analyst@example.test", usercode: "D2222222", role: "analyste-tarif-referentiel", marketIds: ["market-a"] },
  ];

  const jql = directory.buildMarketJql(users, "market-a");

  assert.match(jql, /project = "JSD-Distribution Matériaux Bois Panneaux"/);
  assert.match(jql, /assignee in \(A1234567, B7654321\)/);
  assert.doesNotMatch(jql, /C1111111|D2222222|J9535152|B4166056|Nom Jira/);
  assert.equal(directory.buildMarketJql(users, "unknown"), "");
});

test("builds an open-ticket Jira query for one configured analyst", () => {
  const analyst = { id: "analyst-1", name: "Jane DOE", email: "jane@example.test", usercode: "E1234567", role: "analyste-tarif-referentiel", marketIds: [] };
  const jql = directory.buildAnalystJql(analyst);

  assert.match(jql, /statusCategory != Done/);
  assert.match(jql, /assignee = E1234567/);
  assert.doesNotMatch(jql, /J9535152|B4166056/);
  assert.equal(directory.buildAnalystJql({ ...analyst, role: "chef-produit" }), "");
  assert.equal(directory.buildAnalystJql({ ...analyst, usercode: "Jane" }), "");
});

test("builds the global Jira import query with open and recently resolved tickets", () => {
  const jql = directory.buildGlobalJiraImportJql();

  assert.match(jql, /statusCategory != Done/);
  assert.match(jql, /resolved >= startOfYear\(-1\)/);
  assert.match(jql, /ORDER BY updated DESC/);
  assert.doesNotMatch(jql, /assignee in/);
});
