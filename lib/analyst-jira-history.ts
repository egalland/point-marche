import { addIsoDays, isIsoDate, isoWeekForDate } from "./iso-week";

export type JiraChartHorizon = "1" | "3" | "6" | "12" | "custom";
export type JiraChartSettings = { horizon: JiraChartHorizon; from: string; to: string };
export type JiraHistoryRange = { from: string; to: string };
export type JiraCompletionWeek = JiraHistoryRange & { year: number; week: number; count: number };
export type AnalystJiraHistory = JiraHistoryRange & {
  analystId: string;
  weeks: JiraCompletionWeek[];
  updatedAt: string;
};

export function validateJiraHistoryRange(range: JiraHistoryRange) {
  if (!isIsoDate(range.from) || !isIsoDate(range.to)) return "Choisis deux dates complètes et valides.";
  if (range.from > range.to) return "La date de début doit précéder la date de fin.";
  if (range.from < "2020-01-01" || range.to > "2200-12-31") return "Choisis une période entre 2020 et 2200.";
  const days = (Date.parse(range.to) - Date.parse(range.from)) / 86400000;
  return days > 366 * 5 ? "Choisis une période de cinq ans maximum." : "";
}

export function jiraHistoryRange(reference: string, settings: JiraChartSettings): JiraHistoryRange {
  if (settings.horizon === "custom") return { from: settings.from, to: settings.to };
  const end = isoWeekForDate(reference).to;
  const date = new Date(`${end}T12:00:00Z`);
  const day = date.getUTCDate();
  date.setUTCMonth(date.getUTCMonth() - Number(settings.horizon), 1);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return { from: date.toISOString().slice(0, 10), to: end };
}

export function jiraCompletionWeeks(range: JiraHistoryRange): JiraCompletionWeek[] {
  if (validateJiraHistoryRange(range)) return [];
  const weeks: JiraCompletionWeek[] = [];
  for (let day = isoWeekForDate(range.from).from; day <= range.to; day = addIsoDays(day, 7)) {
    weeks.push({ ...isoWeekForDate(day), count: 0 });
  }
  return weeks;
}

export function jiraWeekLabel(week: Pick<JiraCompletionWeek, "year" | "week">) {
  return `S${String(week.week).padStart(2, "0")} · ${week.year}`;
}

export function jiraWeekDateLabel(week: JiraHistoryRange) {
  const format = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return `${format.format(new Date(`${week.from}T12:00:00Z`))} → ${format.format(new Date(`${week.to}T12:00:00Z`))}`;
}
