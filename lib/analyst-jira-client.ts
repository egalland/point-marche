import type { AnalystPointData } from "./analyst-point";

export type AnalystJiraSnapshot = {
  analystId: string;
  year: number;
  week: number;
  rawText: string;
  tickets: AnalystPointData["jira"];
  resolvedTickets?: AnalystPointData["jiraResolved"];
  updatedAt: string;
};

export async function fetchAnalystJiraSnapshot(analystId: string, period: { year: number; week: number }, signal?: AbortSignal) {
  const response = await fetch(`/api/analyst-jira?analystId=${encodeURIComponent(analystId)}&year=${period.year}&week=${period.week}`, { cache: "no-store", signal });
  const payload = await response.json() as { snapshot?: AnalystJiraSnapshot | null; error?: string };
  if (!response.ok) throw new Error(payload.error || "Chargement Jira impossible.");
  return payload.snapshot ?? null;
}
