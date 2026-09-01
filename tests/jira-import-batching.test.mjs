import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = ts.transpileModule(readFileSync(new URL("../lib/jira-import-batching.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const batching = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

test("keeps Jira import statements below D1 binding limits", () => {
  const tickets = batching.jiraImportChunks(Array.from({ length: 250 }, (_, index) => index), batching.JIRA_TICKET_ROWS_PER_STATEMENT);
  const participants = batching.jiraImportChunks(Array.from({ length: 3250 }, (_, index) => index), batching.JIRA_PARTICIPANT_ROWS_PER_STATEMENT);
  const deletes = batching.jiraImportChunks(Array.from({ length: 250 }, (_, index) => index), batching.JIRA_DELETE_KEYS_PER_STATEMENT);

  assert.ok(tickets.every((rows) => rows.length * 11 <= 100));
  assert.ok(participants.every((rows) => rows.length * 5 <= 100));
  assert.ok(deletes.every((rows) => rows.length + 1 <= 100));
  assert.ok(batching.jiraImportChunks([...tickets, ...participants, ...deletes], batching.JIRA_STATEMENTS_PER_BATCH).every((rows) => rows.length <= 50));
});
