import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../lib/global-directory.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const directory = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);

test("maps GLOBAL operational roles to Jira and primary mail recipients", () => {
  for (const role of ["chef-produit", "chef-marche", "analyste-tarif-referentiel"]) {
    assert.equal(directory.roleUsesAutomaticJira(role), true);
    assert.equal(directory.roleMailMode(role), "to");
  }
});

test("keeps the Tarif manager in copy only and other roles inactive", () => {
  assert.equal(directory.roleUsesAutomaticJira("manager-tarif"), false);
  assert.equal(directory.roleMailMode("manager-tarif"), "cc");
  assert.equal(directory.roleUsesAutomaticJira("autre"), false);
  assert.equal(directory.roleMailMode("autre"), "none");
});
