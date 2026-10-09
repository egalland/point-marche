import assert from "node:assert/strict";
import test from "node:test";
import { moduleUrl } from "./helpers/module-url.mjs";

const analystPoint = await import(moduleUrl("../../lib/analyst-point.ts"));

const analyst = { id: "analyst", name: "Jane DOE", email: "jane@example.test", usercode: "A1234567", plannerAlias: "Jane", role: "analyste-tarif-referentiel", marketIds: [] };

test("keeps open En cours tickets for the selected analyst USERCODE", () => {
  const table = [
    "Clé de ticket\tID de ticket\tÉtat\tRésumé\tCréation\tPersonne assignée\tMise à jour",
    "GLOBAL-100\t1000001\tEn cours\tTicket analyste actif\t20/08/2026 09:00\tA1234567\t27/08/2026 10:00",
    "GLOBAL-101\t1000002\tRésolu\tTicket analyste terminé\t20/08/2026 09:00\tA1234567\t27/08/2026 10:00",
    "GLOBAL-102\t1000003\tEn cours\tTicket d’un autre analyste\t20/08/2026 09:00\tB1234567\t27/08/2026 10:00",
    "GLOBAL-103\t1000004\tFini\tTicket analyste fini\t20/08/2026 09:00\tA1234567\t27/08/2026 10:00",
    "GLOBAL-104\t1000005\tAbandonnée\tTicket analyste abandonné\t20/08/2026 09:00\tA1234567\t27/08/2026 10:00",
  ].join("\n");

  const tickets = analystPoint.analystJiraTickets(table, analyst);

  assert.equal(tickets.length, 1);
  assert.equal(tickets[0].key, "GLOBAL-100");
  assert.equal(tickets[0].status, "En cours");
});

test("keeps older saved analyst points compatible with weekly resolved tickets", () => {
  const normalized = analystPoint.normalizeAnalystPoint({ meetingDate: "2026-08-30", jira: [] }, analyst);

  assert.deepEqual(normalized.jiraResolved, []);
  assert.equal(normalized.preferences.jiraChart.horizon, "3");
});

test("preserves saved chart preferences and normalizes unknown horizons", () => {
  const preferences = { jiraChart: { horizon: "custom", from: "2026-01-01", to: "2026-06-30" } };
  assert.deepEqual(analystPoint.normalizeAnalystPoint({ preferences }, analyst).preferences.jiraChart, preferences.jiraChart);
  assert.equal(analystPoint.normalizeAnalystPoint({ preferences: { jiraChart: { horizon: "wrong" } } }, analyst).preferences.jiraChart.horizon, "3");
});

test("removes abandoned tickets from saved points without changing the imported data", () => {
  const saved = {
    meetingDate: "2026-08-30",
    jira: [{ key: "GLOBAL-10858", status: "Abandonnée" }, { key: "GLOBAL-10895", status: "Abandonnés" }, { key: "GLOBAL-10935", status: "ABANDONNEE" }, { key: "GLOBAL-1", status: "En cours" }],
    jiraResolved: [{ key: "GLOBAL-2", status: "Abandonné" }, { key: "GLOBAL-3", status: "Fini" }],
  };
  const before = structuredClone(saved);
  const normalized = analystPoint.normalizeAnalystPoint(saved, analyst);
  assert.deepEqual(normalized.jira.map((item) => item.key), ["GLOBAL-1"]);
  assert.deepEqual(normalized.jiraResolved.map((item) => item.key), ["GLOBAL-3"]);
  assert.deepEqual(saved, before);
  assert.deepEqual(analystPoint.jiraStatusBreakdown(saved.jira), [{ status: "En cours", count: 1 }]);
});

test("counts assigned non-closed tickets by their Jira status", () => {
  const tickets = [
    { status: "En attente d'un tiers" },
    { status: "En cours" },
    { status: "En attente d'un tiers" },
    { status: "À faire" },
  ];

  assert.deepEqual(analystPoint.jiraStatusBreakdown(tickets), [
    { status: "En cours", count: 1 },
    { status: "En attente d'un tiers", count: 2 },
    { status: "À faire", count: 1 },
  ]);
});
