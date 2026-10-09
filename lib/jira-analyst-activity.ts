import { dateIsInIsoWeek } from "./iso-week";
import { isAbandonedJiraStatus, isClosedJiraStatus, type JiraDetailedTicket } from "./jira-import";

export function jiraActivityForAnalyst(tickets: JiraDetailedTicket[], usercode: string, year: number, week: number) {
  const normalizedUserCode = usercode.trim().toUpperCase();
  if (!/^[A-Z]\d{7}$/.test(normalizedUserCode)) return { open: [], resolved: [] };
  const assigned = (ticket: JiraDetailedTicket) => ticket.assigneeUserCode.toUpperCase() === normalizedUserCode;
  const participated = (ticket: JiraDetailedTicket) => ticket.participants?.some((participant) => participant.usercode.toUpperCase() === normalizedUserCode) ?? false;
  const relatedClosed = Array.from(new Map(tickets
    .filter((ticket) => isClosedJiraStatus(ticket.status) && !isAbandonedJiraStatus(ticket.status) && (assigned(ticket) || participated(ticket)))
    .map((ticket) => [ticket.key, ticket])).values());
  return {
    open: tickets.filter((ticket) => assigned(ticket) && !isClosedJiraStatus(ticket.status)).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    resolved: relatedClosed.filter((ticket) => dateIsInIsoWeek(ticket.updatedAt, year, week)).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
  };
}
