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
  checklistCompleted: 7,
  checklistTotal: 7,
  checklist: [
    { order: 0, label: "Avis de hausse", date: "2026-05-20", kind: "other", analystName: "", nonApplicable: false },
    { order: 1, label: "Tarif fournisseur", date: "2026-05-25", kind: "other", analystName: "", nonApplicable: false },
    { order: 2, label: "Simulation Anaïs", date: "2026-06-01", kind: "simulation", analystName: "Anaïs", nonApplicable: false },
    { order: 3, label: "Validation CDM", date: "2026-06-04", kind: "other", analystName: "", nonApplicable: false },
    { order: 4, label: "Intégration", date: "2026-06-05", kind: "other", analystName: "", nonApplicable: false },
    { order: 5, label: "Contrôle", date: "2026-06-07", kind: "control", analystName: "", nonApplicable: false },
    { order: 6, label: "Simulation Legacy Name", date: "2026-06-03", kind: "simulation", analystName: "Legacy Name", nonApplicable: false },
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

test("a freely chosen comparison period uses the same filters for volumes and delays", () => {
  const old = { ...baseTask, externalId: "old", checklist: baseTask.checklist.map((step) => ({ ...step, date: step.date.replace("2026", "2025") })) };
  const filters = { from: "2026-06-01", to: "2026-06-30", marketId: "market-rev", specialty: "simulation", analystIds: ["analyst-1"], comparisonRange: { from: "2025-06-01", to: "2025-06-30" } };
  const stats = analytics.buildAnalystStats([baseTask, old], users, markets, filters);
  assert.equal(stats.totalActivities, 1);
  assert.equal(stats.previousTotal, 1);
  assert.equal(stats.previousContributions[0].taskId, "old");
  assert.ok(stats.previousContributions.every((c) => c.analystId === "analyst-1" && c.specialty === "simulation"));
  assert.equal(stats.delaySummaries.find((s) => s.kind === "simulation").previousAverage, 7);
  const empty = analytics.buildAnalystStats([baseTask, old], users, markets, { ...filters, comparisonRange: { from: "2024-06-01", to: "2024-06-30" } });
  assert.equal(empty.previousTotal, 0);
  assert.equal(empty.delaySummaries.find((s) => s.kind === "simulation").previousAverage, null);
});

test("counts old unnamed activities globally and matches configured Planner aliases", () => {
  const stats = analytics.buildAnalystStats([baseTask], users, markets, {
    from: "2026-05-01",
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
  assert.deepEqual(stats.delaySummaries.map((item) => [item.kind, item.average, item.median, item.sampleCount]), [
    ["receipt", 5, 5, 1],
    ["simulation", 7, 7, 1],
    ["marketReturn", 3, 3, 1],
    ["control", 2, 2, 1],
  ]);
});

test("supports combined analyst, market and specialty filters", () => {
  const stats = analytics.buildAnalystStats([baseTask], users, markets, {
    from: "2026-05-01",
    to: "2026-06-30",
    marketId: "market-rev",
    specialty: "simulation",
    analystIds: ["analyst-1"],
  });

  assert.equal(stats.totalActivities, 1);
  assert.equal(stats.simulations, 1);
  assert.equal(stats.controls, 0);
  assert.equal(stats.byAnalyst[0].name, "Anaïs MARTIN");
  assert.equal(stats.delaySummaries.every((item) => item.sampleCount === 1), true);
});

test("keeps the imported supplier amount on each activity without a cumulative KPI", () => {
  const amounts = [473398.58, 89613.02, 0, null];
  const tasks = amounts.map((purchases12m, index) => ({
    ...baseTask,
    externalId: `simulation-${index}`,
    metrics: { ...baseTask.metrics, supplierCode: "F1000", purchases12m },
  }));
  const stats = analytics.buildAnalystStats(tasks, users, markets, {
    from: "2026-05-01", to: "2026-06-30", marketId: "all", specialty: "all", analystIds: [],
  });
  for (const [index, purchases12m] of amounts.entries()) {
    const activities = stats.contributions.filter((item) => item.taskId === `simulation-${index}`);
    assert.equal(activities.length, 3);
    assert.ok(activities.every((item) => item.purchases12m === purchases12m));
  }
  assert.equal(stats.distinctTasks, 4);
  assert.equal(stats.totalActivities, 12);
  assert.equal("purchases12m" in stats, false);
  assert.equal("totalTurnover" in stats, false);
  const legacy = analytics.plannerContributions([{ ...baseTask, metrics: undefined }], users, markets);
  assert.ok(legacy.every((item) => item.purchases12m === null));
});

test("ignores incomplete or chronologically inconsistent date pairs without creating a failure", () => {
  const incompleteTask = {
    ...baseTask,
    externalId: "task-2",
    taskName: "2026-06-JUIN-INCOMPLET",
    checklist: [
      { order: 0, label: "Avis de hausse", date: "2026-06-10", kind: "other", analystName: "", nonApplicable: false },
      { order: 1, label: "Tarif fournisseur", date: "", kind: "other", analystName: "", nonApplicable: false },
      { order: 2, label: "Simulation", date: "2026-06-08", kind: "simulation", analystName: "", nonApplicable: false },
    ],
  };
  const stats = analytics.buildAnalystStats([baseTask, incompleteTask], users, markets, {
    from: "2026-05-01",
    to: "2026-06-30",
    marketId: "all",
    specialty: "all",
    analystIds: [],
  });

  assert.equal(stats.delaySamples.length, 4);
  assert.equal(stats.delaySummaries.every((item) => item.sampleCount === 1), true);
});
