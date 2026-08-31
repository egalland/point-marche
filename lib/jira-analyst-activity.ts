import { dateIsInIsoWeek } from "./iso-week";
import { isClosedJiraStatus, type JiraDetailedTicket } from "./jira-import";

export function jiraActivityForAnalyst(tickets: JiraDetailedTicket[], usercode: string, year: number, week: number) {
  const normalizedUserCode = usercode.trim().toUpperCase();
  if (!/^[A-Z]\d{7}$/.test(normalizedUserCode)) return { open: [], resolved: [], closedWithoutResolutionDate: 0 };
  const assigned = (ticket: JiraDetailedTicket) => ticket.assigneeUserCode.toUpperCase() === normalizedUserCode;
  const participated = (ticket: JiraDetailedTicket) => ticket.participants?.some((participant) => participant.usercode.toUpperCase() === normalizedUserCode) ?? false;
  const relatedClosed = tickets.filter((ticket) => isClosedJiraStatus(ticket.status) && (assigned(ticket) || participated(ticket)));
  return {
    open: tickets.filter((ticket) => assigned(ticket) && !isClosedJiraStatus(ticket.status)).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    resolved: relatedClosed.filter((ticket) => Boolean(ticket.resolutionAt) && dateIsInIsoWeek(ticket.resolutionAt ?? "", year, week)).sort((left, right) => (right.resolutionAt ?? "").localeCompare(left.resolutionAt ?? "")),
    closedWithoutResolutionDate: relatedClosed.filter((ticket) => !ticket.resolutionAt).length,
  };
}
