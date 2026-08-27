import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../lib/analyst-stats.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const analytics = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);

const baseTask = {
  externalId: "task-1",
  taskName: "2026-06-JUIN-EXEMPLE",
  effectiveMonth: "2026-06",
  category: "Tarif vente",
  goal: "",
  plannerStatus: "Terminées",
  priority: "Moyen",
  assignedTo: "",
  createdBy: "",
  createdAt: "2026-05-01",
  dueDate: "2026-06-01",
  startDate: "",
  recurring: false,
  overdue: false,
  completedAt: "2026-06-03",
  completedBy: "",
  checklistCompleted: 3,
  checklistTotal: 3,
  checklist: [
    { order: 1, label: "Simulation Anaïs", date: "2026-06-01", kind: "simulation", analystName: "Anaïs", nonApplicable: false },
    { order: 2, label: "Contrôle", date: "2026-06-02", kind: "control", analystName: "", nonApplicable: false },
    { order: 3, label: "Simulation Legacy Name", date: "2026-06-03", kind: "simulation", analystName: "Legacy Name", nonApplicable: false },
  ],
  labels: ["REV-PB"],
  comments: "",
  metrics: { purchases12m: null, supplierCode: "", announcedVariation: null, globalVariation: null, weightedVariation: null, tariffStructure: "" },
  workflowState: "completed",
};

const users = [
  { id: "analyst-1", name: "Anaïs MARTIN", email: "anais@example.test", usercode: "", plannerAlias: "Anaïs", role: "analyste-tarif-referentiel", marketIds: ["market-rev"] },
  { id: "lead-1", name: "John DOE", email: "john@example.test", usercode: "A1234567", plannerAlias: "John", role: "chef-produit", marketIds: ["market-rev"] },
];
const markets = [{ id: "market-rev", name: "Revêtements", plannerTags: ["REV-PB"] }];

test("counts old unnamed activities globally and matches configured Planner aliases", () => {
  const stats = analytics.buildAnalystStats([baseTask], users, markets, {
    from: "2026-06-01",
    to: "2026-06-30",
    marketId: "all",
    specialty: "all",
    analystIds: [],
  });

  assert.equal(stats.totalActivities, 3);
  assert.equal(stats.distinctTasks, 1);
  assert.equal(stats.simulations, 2);
  assert.equal(stats.controls, 1);
  assert.equal(stats.coverageRate, 1 / 3);
  assert.deepEqual(stats.unmatchedNames, ["Legacy Name"]);
  assert.equal(stats.contributions.find((item) => item.analystLabel === "Anaïs")?.analystId, "analyst-1");
  assert.equal(stats.contributions.find((item) => item.analystLabel === "")?.analystName, "Non attribué");
});

test("supports combined analyst, market and specialty filters", () => {
  const stats = analytics.buildAnalystStats([baseTask], users, markets, {
    from: "2026-06-01",
    to: "2026-06-30",
    marketId: "market-rev",
    specialty: "simulation",
    analystIds: ["analyst-1"],
  });

  assert.equal(stats.totalActivities, 1);
  assert.equal(stats.simulations, 1);
  assert.equal(stats.controls, 0);
  assert.equal(stats.byAnalyst[0].name, "Anaïs MARTIN");
});
