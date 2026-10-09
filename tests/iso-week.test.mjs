import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = ts.transpileModule(readFileSync(new URL("../lib/iso-week.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const isoWeek = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

test("builds the selected ISO week from Monday to Sunday", () => {
  assert.deepEqual(isoWeek.isoWeekRange(2026, 35), { from: "2026-08-24", to: "2026-08-30" });
});

test("uses resolution date or update fallback inside the selected week", () => {
  assert.equal(isoWeek.dateIsInIsoWeek("2026-08-25T09:49:00", 2026, 35), true);
  assert.equal(isoWeek.dateIsInIsoWeek("2026-08-31T09:49:00", 2026, 35), false);
});
