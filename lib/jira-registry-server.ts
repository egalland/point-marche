import { and, desc, eq, inArray, or } from "drizzle-orm";
import { getDb } from "../db";
import { globalUserMarkets, globalUsers, jiraImportBatches, jiraTicketParticipants, jiraTickets } from "../db/schema";
import { dateIsInIsoWeek } from "./iso-week";
import { jiraSummaryFromDetailedTickets, type JiraDetailedTicket, type JiraParticipant } from "./jira-import";

export function isClosedJiraStatus(status: string) {
  return /(termin|cl[oô]tur|r[eé]solu|ferm|annul|done|closed)/i.test(status);
}

export async function latestCompletedJiraBatch() {
  const db = getDb();
  const [batch] = await db.select().from(jiraImportBatches)
    .where(eq(jiraImportBatches.status, "completed"))
    .orderBy(desc(jiraImportBatches.completedAt), desc(jiraImportBatches.createdAt))
    .limit(1);
  return batch ?? null;
}

type JiraTicketRow = typeof jiraTickets.$inferSelect;

function ticketFromRow(row: JiraTicketRow, participants: JiraParticipant[] = []): JiraDetailedTicket {
  return {
    key: row.key,
    internalId: row.internalId,
    status: row.status,
    summary: row.summary,
    createdAt: row.jiraCreatedAt,
    assigneeUserCode: row.assigneeUserCode,
    updatedAt: row.jiraUpdatedAt,
    resolutionAt: row.resolutionAt,
    participants,
    link: row.link || `https://jira.example.test/browse/${row.key}`,
  };
}

async function participantMap(ticketKeys: string[]) {
  if (!ticketKeys.length) return new Map<string, JiraParticipant[]>();
  const db = getDb();
  const rows = await db.select({ ticketKey: jiraTicketParticipants.ticketKey, usercode: jiraTicketParticipants.usercode, jiraUserId: jiraTicketParticipants.jiraUserId })
    .from(jiraTicketParticipants)
    .where(inArray(jiraTicketParticipants.ticketKey, ticketKeys));
  return rows.reduce((result, row) => {
    result.set(row.ticketKey, [...(result.get(row.ticketKey) ?? []), { usercode: row.usercode, jiraUserId: row.jiraUserId }]);
    return result;
  }, new Map<string, JiraParticipant[]>());
}

async function hydratedTickets(rows: JiraTicketRow[]) {
  const participants = await participantMap(rows.map((row) => row.key));
  return rows.map((row) => ticketFromRow(row, participants.get(row.key) ?? []));
}

async function loadJiraTicketsForAnalyst(usercode: string) {
  const normalizedUserCode = usercode.trim().toUpperCase();
  if (!/^[A-Z]\d{7}$/.test(normalizedUserCode)) return { assigned: [], related: [] };
  const db = getDb();
  const [assigned, participated] = await Promise.all([
    db.select().from(jiraTickets).where(eq(jiraTickets.assigneeUserCode, normalizedUserCode)),
    db.select({ ticketKey: jiraTicketParticipants.ticketKey }).from(jiraTicketParticipants).where(eq(jiraTicketParticipants.usercode, normalizedUserCode)),
  ]);
  const keys = Array.from(new Set([...assigned.map((row) => row.key), ...participated.map((row) => row.ticketKey)]));
  if (!keys.length) return { assigned: [], related: [] };
  const rows = await db.select().from(jiraTickets).where(inArray(jiraTickets.key, keys));
  const related = await hydratedTickets(rows);
  return {
    assigned: related.filter((ticket) => ticket.assigneeUserCode.toUpperCase() === normalizedUserCode),
    related,
  };
}

export async function loadJiraActivityForAnalyst(usercode: string, year: number, week: number) {
  const tickets = await loadJiraTicketsForAnalyst(usercode);
  return {
    open: tickets.assigned.filter((ticket) => !isClosedJiraStatus(ticket.status)).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    resolved: tickets.related.filter((ticket) => {
      if (!isClosedJiraStatus(ticket.status)) return false;
      return dateIsInIsoWeek(ticket.resolutionAt || ticket.updatedAt, year, week);
    }).sort((left, right) => (right.resolutionAt || right.updatedAt).localeCompare(left.resolutionAt || left.updatedAt)),
  };
}

export async function loadOpenMarketJiraSummary(marketId: string) {
  const db = getDb();
  const directory = await db.select({ usercode: globalUsers.usercode, name: globalUsers.name })
    .from(globalUserMarkets)
    .innerJoin(globalUsers, eq(globalUserMarkets.userId, globalUsers.id))
    .where(and(
      eq(globalUserMarkets.marketId, marketId),
      eq(globalUsers.isActive, true),
      or(eq(globalUsers.role, "chef-produit"), eq(globalUsers.role, "chef-marche")),
    ));
  const people = new Map(directory.map((person) => [person.usercode.toUpperCase(), person.name]));
  if (!people.size) return null;
  const rows = await db.select().from(jiraTickets).where(inArray(jiraTickets.assigneeUserCode, Array.from(people.keys())));
  const tickets = (await hydratedTickets(rows))
    .filter((ticket) => !isClosedJiraStatus(ticket.status))
    .map((ticket) => ({ ...ticket, assigneeName: people.get(ticket.assigneeUserCode.toUpperCase()), marketId }));
  return jiraSummaryFromDetailedTickets(tickets, "unknown");
}
