import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../lib/planner-import.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const planner = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);

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
  const checklist = "1-Tarif fournisseur : 28/05/2026;3-Validation CDM : 29/05/2026;2-Simulation Anaïs : 29/05/2026;4-Intégration : 01/06/2026;0-Avis de hausse : 02/04/2026;5-Controle Ismahane : 05/06/2026;Trame WORKSPACE envoyée : XX/XX/XXXX";
  const row = [
    "NaIUAKs6o0G24dNV-UCVypYAI6t0",
    "2026-06-JUIN-UNILIN FLOORING",
    "9-Tarif Vente terminÃ© - Attente Ctrl Marge",
    "",
    "Terminées",
    "Moyen",
    "Willefert, Xavier",
    "Dufresne, Nicolas",
    "2026-04-02",
    "2026-06-01",
    "",
    "",
    "false",
    "2026-06-08",
    "Willefert, Xavier",
    "6/7",
    checklist,
    "REV-PB",
    "Achats 12 mG : 473 398,58€<br>Code Fournisseur : B0854<br>Variation GLOBAL : 4,5 %<br>Variation pondérée : 4.5 %<br>Structure tarifaire : TARIFS NET AU SKU",
  ];

  const result = planner.parsePlannerTasks(exportTable([row]));
  const task = result.tasks[0];

  assert.equal(result.format, "tabulated");
  assert.equal(task.effectiveMonth, "2026-06");
  assert.match(task.category, /terminé/);
  assert.deepEqual(task.labels, ["REV-PB"]);
  assert.equal(task.workflowState, "completed");
  assert.equal(task.checklist.find((item) => item.kind === "trame")?.nonApplicable, true);
  assert.equal(task.checklist.find((item) => item.kind === "simulation")?.analystName, "Anaïs");
  assert.equal(task.checklist.find((item) => item.kind === "control")?.analystName, "Ismahane");
  assert.equal(task.metrics.supplierCode, "B0854");
  assert.equal(task.metrics.purchases12m, 473398.58);
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
    "MEN-PB",
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
    "2026-07-JUILLET-ARPA France",
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
    "PAN-GM",
    "",
  ];

  const task = planner.parsePlannerTasks(exportTable([row])).tasks[0];

  assert.equal(task.workflowState, "needs-closure");
  assert.equal(task.recurring, true);
  assert.equal(planner.plannerTaskMonthLabel(task), "Juillet 2026");
});
