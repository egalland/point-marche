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
const isoWeekUrl = `data:text/javascript;base64,${Buffer.from(transpile("../lib/iso-week.ts")).toString("base64")}`;
const activitySource = transpile("../lib/jira-analyst-activity.ts")
  .replace('from "./jira-import"', `from "${jiraUrl}"`)
  .replace('from "./iso-week"', `from "${isoWeekUrl}"`);
const activity = await import(`data:text/javascript;base64,${Buffer.from(activitySource).toString("base64")}`);

const ticket = (key, status, assigneeUserCode, updatedAt, participants = [], resolutionAt = "") => ({
  key,
  internalId: key,
  status,
  summary: key,
  createdAt: "2026-08-01T08:00:00",
  assigneeUserCode,
  updatedAt,
  resolutionAt,
  participants,
  link: `https://jira.example/${key}`,
});

test("counts open tickets as assigned only and weekly closed tickets by last update for assigned or participant", () => {
  const result = activity.jiraActivityForAnalyst([
    ticket("GLOBAL-1", "En cours", "A1234567", "2026-08-27T10:00:00"),
    ticket("GLOBAL-2", "En attente", "B1234567", "2026-08-27T10:00:00", [{ usercode: "A1234567", jiraUserId: "" }]),
    ticket("GLOBAL-3", "Résolu", "A1234567", "2026-08-25T09:00:00"),
    ticket("GLOBAL-4", "Terminé", "B1234567", "2026-08-26T09:00:00", [{ usercode: "A1234567", jiraUserId: "" }]),
    ticket("GLOBAL-5", "Résolu", "B1234567", "2026-08-27T09:00:00", [{ usercode: "A1234567", jiraUserId: "" }]),
    ticket("GLOBAL-6", "Résolu", "A1234567", "2026-08-18T09:00:00", [], "2026-08-25T09:00:00"),
    ticket("GLOBAL-4", "Terminé", "B1234567", "2026-08-26T09:00:00", [{ usercode: "A1234567", jiraUserId: "" }]),
  ], "A1234567", 2026, 35);

  assert.deepEqual(result.open.map((item) => item.key), ["GLOBAL-1"]);
  assert.deepEqual(result.resolved.map((item) => item.key), ["GLOBAL-5", "GLOBAL-4", "GLOBAL-3"]);
});
