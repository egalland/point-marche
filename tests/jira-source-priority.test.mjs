import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = ts.transpileModule(readFileSync(new URL("../lib/jira-source-priority.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const priority = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

test("uses a newer global Jira import instead of a stale weekly snapshot", () => {
  assert.equal(priority.shouldPreferCentralJira("2026-08-31 10:00:00", "2026-08-27 14:00:00"), true);
});

test("keeps a later manual weekly import and supports an explicit refresh", () => {
  assert.equal(priority.shouldPreferCentralJira("2026-08-27 14:00:00", "2026-08-31 10:00:00"), false);
  assert.equal(priority.shouldPreferCentralJira("2026-08-27 14:00:00", "2026-08-31 10:00:00", true), true);
});
