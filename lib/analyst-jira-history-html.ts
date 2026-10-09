import { isoWeekForDate } from "./iso-week";
import { jiraWeekDateLabel, jiraWeekLabel, type AnalystJiraHistory } from "./analyst-jira-history";
import { jiraMetricCards } from "./analyst-jira-metrics";

export function analystJiraHistoryHtml(history: AnalystJiraHistory | null, pointDate: string, currentCount?: number | null, previousCount?: number | null) {
  if (!history?.weeks.length) return "";
  const selected = isoWeekForDate(pointDate).from;
  const cards = jiraMetricCards(history, pointDate, currentCount === undefined ? history.weeks.find((week) => week.from === selected)?.count ?? null : currentCount, previousCount);
  const metrics = `<table width="100%" role="presentation" cellspacing="0" cellpadding="0" style="table-layout:fixed;margin-bottom:18px"><tr>${cards.map((card) => `<td width="33%" valign="top" data-metric="${card.id}" style="padding:0 4px"><table width="100%" role="presentation" cellspacing="0" cellpadding="0" style="border:1px solid #DDE6E3;background:#F4F7F6"><tr><td style="padding:12px"><span style="display:block;color:#526D64;font-size:12px;line-height:18px">${card.label}</span><strong style="display:block;margin:6px 0;color:${card.tone === "up" ? "#087F63" : card.tone === "down" ? "#246480" : "#253D36"};font-size:24px;line-height:30px;font-variant-numeric:tabular-nums">${card.value}</strong><small style="display:block;color:#61736E;font-size:12px;line-height:18px">${card.detail}</small></td></tr></table></td>`).join("")}</tr></table>`;
  const maximum = Math.max(1, ...history.weeks.map((week) => week.count));
  const stride = Math.max(1, Math.ceil(history.weeks.length / 8));
  const bars = history.weeks.map((week) => {
    const height = Math.round(week.count / maximum * 100);
    const color = week.from === selected ? "#087F63" : "#77BDAA";
    const title = `${jiraWeekLabel(week)} · ${week.count} tickets terminés · ${jiraWeekDateLabel(week)}`;
    return `<td valign="bottom" align="center" height="110" title="${title}" style="height:110px;padding:0 2px;border-bottom:1px solid #CDDCD6">${height ? `<table role="presentation" width="100%" height="${height}" cellspacing="0" cellpadding="0"><tr><td height="${height}" bgcolor="${color}" style="height:${height}px;background:${color};font-size:0;line-height:0">&nbsp;</td></tr></table>` : ""}</td>`;
  }).join("");
  const labels = history.weeks.map((week, index) => `<td align="center" valign="top" style="padding:6px 0;color:#47615A;font-size:12px;line-height:16px">${index % stride === 0 || week.from === selected ? `S${String(week.week).padStart(2, "0")}<br>${week.year}<br><b>${week.count}</b>` : ""}</td>`).join("");
  return `<p style="margin:16px 0 8px;color:#253D36;font-size:14px;font-weight:700">Tickets terminés par semaine</p>${metrics}<table width="100%" role="presentation" cellspacing="0" cellpadding="0" style="table-layout:fixed"><tr>${bars}</tr><tr>${labels}</tr></table><p style="margin:8px 0 14px;color:#61736E;font-size:12px;line-height:18px">Semaines ISO : ${jiraWeekDateLabel(history)} · Dernière modification Jira.</p>`;
}
