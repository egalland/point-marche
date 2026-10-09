import { addIsoDays, isIsoDate, isoWeekForDate } from "./iso-week";
import { jiraWeekLabel, type AnalystJiraHistory, type JiraCompletionWeek } from "./analyst-jira-history";

export type JiraMetricCard = {
  id: "total" | "average" | "change";
  label: string;
  value: string;
  detail: string;
  tone: "neutral" | "up" | "down";
};

const integer = new Intl.NumberFormat("fr-FR");
const average = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const percentage = new Intl.NumberFormat("fr-FR", { style: "percent", maximumSignificantDigits: 3, signDisplay: "exceptZero" });

function validCount(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function jiraPeriodMetrics(weeks: JiraCompletionWeek[]) {
  if (!weeks.length || weeks.some((week) => !validCount(week.count))) return null;
  const total = weeks.reduce((sum, week) => sum + week.count, 0);
  return { total, weekCount: weeks.length, averagePerWeek: total / weeks.length };
}

export function previousJiraWeek(pointDate: string) {
  return isIsoDate(pointDate) ? isoWeekForDate(addIsoDays(isoWeekForDate(pointDate).from, -7)) : null;
}

export function previousJiraWeekCount(history: AnalystJiraHistory | null, pointDate: string) {
  const previous = previousJiraWeek(pointDate);
  const count = history?.weeks.find((week) => week.from === previous?.from)?.count;
  return validCount(count) ? count : null;
}

export function jiraWeekChange(current: number | null, previous: number | null) {
  if (!validCount(current) || !validCount(previous)) return null;
  const difference = current - previous;
  return {
    current,
    previous,
    difference,
    percentage: previous === 0 ? difference === 0 ? 0 : null : difference / previous,
    tone: difference > 0 ? "up" as const : difference < 0 ? "down" as const : "neutral" as const,
  };
}

export function jiraMetricCards(history: AnalystJiraHistory | null, pointDate: string, currentCount: number | null, previousCount: number | null = previousJiraWeekCount(history, pointDate)): JiraMetricCard[] {
  const period = jiraPeriodMetrics(history?.weeks ?? []);
  const previous = previousJiraWeek(pointDate);
  const selected = isIsoDate(pointDate) ? isoWeekForDate(pointDate) : null;
  const change = jiraWeekChange(currentCount, previousCount);
  return [
    {
      id: "total", label: "Total sur la période", value: period ? integer.format(period.total) : "—",
      detail: period ? `${period.weekCount} semaine${period.weekCount > 1 ? "s" : ""} affichée${period.weekCount > 1 ? "s" : ""}` : "Période indisponible", tone: "neutral",
    },
    {
      id: "average", label: "Moyenne par semaine", value: period ? average.format(period.averagePerWeek) : "—",
      detail: "Semaines à zéro incluses", tone: "neutral",
    },
    {
      id: "change", label: selected ? `Évolution de ${jiraWeekLabel(selected)}` : "Évolution de la semaine",
      value: change ? change.percentage === null ? `+${integer.format(change.difference)} ticket${change.difference > 1 ? "s" : ""}` : percentage.format(change.percentage) : "—",
      detail: change && previous ? `vs ${jiraWeekLabel(previous)} : ${integer.format(change.previous)} → ${integer.format(change.current)} tickets${change.percentage === null ? " · base zéro" : ""}` : "Comparaison indisponible",
      tone: change?.tone ?? "neutral",
    },
  ];
}
