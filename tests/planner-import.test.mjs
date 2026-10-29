import { moduleUrl } from "./helpers/module-url.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../lib/planner-import.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const planner = await import(moduleUrl("../../lib/planner-import.ts"));

const headers = [
  "ID de tâche",
  "Nom de tâche",
  "Catégorie",
  "But",
  "Statut",
  "Priorité",
  "Attribué à",
  "Créé par",
  "Date de création",
  "Date d’échéance",
  "Date de début",
  "Est périodique",
  "En retard",
  "Date de fin",
  "Exécuté par",
  "Éléments de la liste de contrôle effectués",
  "Éléments de la liste de contrôle",
  "Étiquettes",
  "Commentaires",
];

function exportTable(rows) {
  return [headers, ...rows].map((row) => row.join("\t")).join("\n");
}

test("parses Planner tasks, analyst names, tags and business completion", () => {
  const checklist = "1-Tarif fournisseur : 28/05/2026;3-Validation CDM : 29/05/2026;2-Simulation Zoé : 29/05/2026;4-Intégration : 01/06/2026;0-Avis de hausse : 02/04/2026;5-Controle Camille : 05/06/2026;Trame WORKSPACE envoyée : XX/XX/XXXX";
  const row = [
    "test-task-import-001",
    "2026-06-JUIN-SUPPLIER-GAMMA",
    "9-Tarif Vente terminÃ© - Attente Ctrl Marge",
    "",
    "Terminées",
    "Moyen",
    "Exemple, Alex",
    "Exemple, Camille",
    "2026-04-02",
    "2026-06-01",
    "",
    "",
    "false",
    "2026-06-08",
    "Exemple, Alex",
    "6/7",
    checklist,
    "TEST-A",
    "Achats 12 mG : 123 456,78€<br>Code Fournisseur : F0004<br>Variation GLOBAL : 4,5 %<br>Variation pondérée : 4.5 %<br>Structure tarifaire : TARIFS NET AU SKU",
  ];

  const result = planner.parsePlannerTasks(exportTable([row]));
  const task = result.tasks[0];

  assert.equal(result.format, "tabulated");
  assert.equal(task.effectiveMonth, "2026-06");
  assert.match(task.category, /terminé/);
  assert.deepEqual(task.labels, ["TEST-A"]);
  assert.equal(task.workflowState, "completed");
  assert.equal(task.checklist.find((item) => item.kind === "trame")?.nonApplicable, true);
  assert.equal(task.checklist.find((item) => item.kind === "simulation")?.analystName, "Zoé");
  assert.equal(task.checklist.find((item) => item.kind === "control")?.analystName, "Camille");
  assert.equal(task.metrics.supplierCode, "F0004");
  assert.equal(task.metrics.purchases12m, 123456.78);
  assert.equal(task.metrics.globalVariation, 4.5);
});

test("keeps old unnamed simulation and control steps without failure", () => {
  const row = [
    "legacy-task",
    "2026-05-MAI-EXEMPLE",
    "Tarif vente",
    "",
    "Terminées",
    "Moyen",
    "",
    "John DOE",
    "2026-04-10",
    "2026-05-15",
    "",
    "false",
    "false",
    "2026-05-18",
    "Jane DOE",
    "2/2",
    "2-Simulation : 13/05/2026;5-Controle : 18/05/2026",
    "TEST-B",
    "",
  ];

  const task = planner.parsePlannerTasks(exportTable([row])).tasks[0];
  const activities = task.checklist.filter((item) => item.kind === "simulation" || item.kind === "control");

  assert.equal(task.workflowState, "completed");
  assert.deepEqual(activities.map((item) => item.date), ["2026-05-13", "2026-05-18"]);
  assert.deepEqual(activities.map((item) => item.analystName), ["", ""]);
});

test("distinguishes a complete active task that still needs Planner closure", () => {
  const row = [
    "active-complete",
    "2026-07-JUILLET-SUPPLIER-DELTA",
    "9-Tarif Vente terminé - Attente Ctrl Marge",
    "",
    "Non démarrées",
    "Moyen",
    "",
    "Jane DOE",
    "2026-05-12",
    "2026-06-15",
    "",
    "true",
    "false",
    "",
    "",
    "2/2",
    "2-Simulation John : 15/06/2026;5-Controle Jane : 18/06/2026",
    "TEST-C",
    "",
  ];

  const task = planner.parsePlannerTasks(exportTable([row])).tasks[0];

  assert.equal(task.workflowState, "needs-closure");
  assert.equal(task.recurring, true);
  assert.equal(planner.plannerTaskMonthLabel(task), "Juillet 2026");
});

test("parses supplier metrics when Planner flattens the comments into one line", () => {
  const row = [
    "flat-comments",
    "2026-08-AOUT-EXEMPLE",
    "Tarif vente",
    "",
    "Non démarrées",
    "Moyen",
    "",
    "John DOE",
    "2026-08-01",
    "2026-08-20",
    "",
    "false",
    "false",
    "",
    "",
    "0/0",
    "",
    "TEST-A",
    "Achats 12 mG : 23 456,12 € Code Fournisseur : F0005 Annoncé : 4% Variation GLOBAL : 3,53% Variation pondérée : 3,36% Structure tarifaire : PAB + Remise CGV CPV",
  ];

  const task = planner.parsePlannerTasks(exportTable([row])).tasks[0];

  assert.equal(task.metrics.purchases12m, 23456.12);
  assert.equal(task.metrics.supplierCode, "F0005");
  assert.equal(task.metrics.announcedVariation, 4);
  assert.equal(task.metrics.globalVariation, 3.53);
  assert.equal(task.metrics.weightedVariation, 3.36);
  assert.equal(task.metrics.tariffStructure, "PAB + Remise CGV CPV");
});

test("keeps quoted and unquoted multiline Planner comments in their task row", () => {
  const prefix = [
    "multiline-comments",
    "2026-09-SEPTEMBRE-EXEMPLE",
    "Tarif vente",
    "",
    "Non démarrées",
    "Moyen",
    "",
    "Jane DOE",
    "2026-08-10",
    "2026-09-15",
    "",
    "false",
    "false",
    "",
    "",
    "0/0",
    "",
    "TEST-B",
  ];
  const comments = "Achats 12 mG : 100 000 €\nCode Fournisseur : B1234\nVariation GLOBAL : 2,7%\nVariation pondérée : 2,4%";
  const quoted = [headers.join("\t"), [...prefix, `"${comments}"`].join("\t")].join("\n");
  const unquoted = [headers.join("\t"), [...prefix, comments].join("\t")].join("\n");

  for (const text of [quoted, unquoted]) {
    const result = planner.parsePlannerTasks(text);
    assert.equal(result.tasks.length, 1);
    assert.equal(result.tasks[0].metrics.supplierCode, "B1234");
    assert.equal(result.tasks[0].metrics.globalVariation, 2.7);
    assert.equal(result.tasks[0].metrics.weightedVariation, 2.4);
  }
});

test("recognizes the reversed Supplier-Alpha title month without using integration month", () => {
  assert.equal(planner.plannerTaskEffectiveMonth("2026-AVRIL-04-SUPPLIER-ALPHA"), "2026-04");
  assert.equal(planner.plannerTaskEffectiveMonth("2026-04-AVRIL-SUPPLIER-ALPHA"), "2026-04");
  assert.equal(planner.plannerTaskEffectiveMonth("2026-FÉVRIER-02-SUPPLIER-ALPHA"), "2026-02");
  assert.equal(planner.plannerTaskEffectiveMonth("2026-AVRIL-05-SUPPLIER-ALPHA"), "");
  const data = planner.parsePlannerTasks("ID de tâche\tNom de tâche\tNotes\niso-avr\t2026-AVRIL-04-SUPPLIER-ALPHA\tCode Fournisseur : F0001 Variation GLOBAL : 5 % Variation pondérée : 5 %");
  assert.equal(data.tasks[0].effectiveMonth,"2026-04");
});

test("SUPPLIER-EPSILON uses the percentage after agency 1234, not the agency number or the later agency breakdown", () => {
  const notes = "Achats 12 mG : €\nCode Fournisseur : F0006\nVariation GLOBAL :\n1234 -1.43%\nAGENCES -0.12%\nPONDERE AU CA -1.69%\nStructure tarifaire :";
  const result = planner.parsePlannerTaskMetrics(notes);
  assert.equal(result.globalVariation, -1.43);
  assert.equal(result.weightedVariation, -1.69);
  assert.equal(result.supplierCode, "F0006");
  assert.equal(result.purchases12m, null);
  const repaired = planner.rehydratePlannerTaskMetrics(notes, { ...result, globalVariation: 1234, weightedVariation: null });
  assert.equal(repaired.globalVariation, -1.43);
  assert.equal(repaired.weightedVariation, -1.69);
  const flat = planner.parsePlannerTaskMetrics(notes.replace(/\n/g, " "));
  assert.equal(flat.globalVariation, -1.43);
  assert.equal(flat.weightedVariation, -1.69);
});

test("percentage parsing preserves signs, zero and bare legacy rates without inventing rates from annotations", () => {
  for (const [text, expected] of [["Agence 1234 : +2,7 %",2.7],["1234 − 1,43 %",-1.43],["1234 : 0 %",0],["-2.3",-2.3],["Agence 1234",null],["1234 : à compléter",null]]) {
    assert.equal(planner.parsePlannerTaskMetrics(`Variation GLOBAL : ${text}`).globalVariation, expected, text);
  }
  assert.equal(planner.parsePlannerTaskMetrics("Variation GLOBAL : 1,2 % Variation pondérée : 1,5 %").weightedVariation, 1.5);
  const weightedOnly = planner.parsePlannerTaskMetrics("Variation GLOBAL :\nPONDERE AU CA -1.69%");
  assert.equal(weightedOnly.globalVariation, null);
  assert.equal(weightedOnly.weightedVariation, -1.69);
});
