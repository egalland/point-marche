import { isoWeekForDate } from "./iso-week";
import { jiraWeekDateLabel, jiraWeekLabel, type AnalystJiraHistory } from "./analyst-jira-history";

export function analystJiraHistoryHtml(history: AnalystJiraHistory | null, pointDate: string) {
  if (!history?.weeks.length) return "";
  const selected = isoWeekForDate(pointDate).from;
  const maximum = Math.max(1, ...history.weeks.map((week) => week.count));
  const stride = Math.max(1, Math.ceil(history.weeks.length / 8));
  const bars = history.weeks.map((week) => {
    const height = Math.round(week.count / maximum * 100);
    const color = week.from === selected ? "#087F63" : "#77BDAA";
    const title = `${jiraWeekLabel(week)} · ${week.count} tickets terminés · ${jiraWeekDateLabel(week)}`;
    return `<td valign="bottom" align="center" height="110" title="${title}" style="height:110px;padding:0 2px;border-bottom:1px solid #CDDCD6">${height ? `<table role="presentation" width="100%" height="${height}" cellspacing="0" cellpadding="0"><tr><td height="${height}" bgcolor="${color}" style="height:${height}px;background:${color};font-size:0;line-height:0">&nbsp;</td></tr></table>` : ""}</td>`;
  }).join("");
  const labels = history.weeks.map((week, index) => `<td align="center" valign="top" style="padding:6px 0;color:#47615A;font-size:12px;line-height:16px">${index % stride === 0 || week.from === selected ? `S${String(week.week).padStart(2, "0")}<br>${week.year}<br><b>${week.count}</b>` : ""}</td>`).join("");
  return `<p style="margin:16px 0 8px;color:#253D36;font-size:14px;font-weight:700">Tickets terminés par semaine</p><table width="100%" role="presentation" cellspacing="0" cellpadding="0" style="table-layout:fixed"><tr>${bars}</tr><tr>${labels}</tr></table><p style="margin:8px 0 14px;color:#61736E;font-size:12px;line-height:18px">Semaines complètes : ${jiraWeekDateLabel(history)} · Dernière modification Jira.</p>`;
}
