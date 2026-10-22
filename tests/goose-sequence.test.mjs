import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = ts.transpileModule(readFileSync(new URL("../lib/goose-sequence.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { gooseStageAt } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

test("holds the contemplative freeze for ten seconds, then each text for five seconds", () => {
  assert.equal(gooseStageAt(15500).id, "freeze");
  assert.equal(gooseStageAt(25499).id, "freeze");
  assert.equal(gooseStageAt(25500).text, "qu'est ce que je fais ici");
  assert.equal(gooseStageAt(30499).id, "question");
  assert.equal(gooseStageAt(30500).text, "...");
  assert.equal(gooseStageAt(35499).id, "dots");
  assert.equal(gooseStageAt(35500).text, "bref");
});

test("restarts with dancing, leaves abruptly and completes even after a suspended tab", () => {
  assert.equal(gooseStageAt(0).id, "dance");
  assert.equal(gooseStageAt(7000).id, "think");
  assert.equal(gooseStageAt(9500).id, "encore");
  assert.equal(gooseStageAt(37000).id, "finale");
  assert.equal(gooseStageAt(42000).id, "away");
  assert.equal(gooseStageAt(42800), null);
  assert.equal(gooseStageAt(120000), null);
});
