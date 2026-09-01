import { and, desc, eq, or } from "drizzle-orm";
import { getDb, getRawDb } from "../db";
import { globalUserMarkets, globalUsers, jiraImportBatches, jiraTickets } from "../db/schema";
import { isoWeekRange } from "./iso-week";
import { jiraActivityForAnalyst } from "./jira-analyst-activity";
import { canonicalJiraStatus, isClosedJiraStatus, jiraSummaryFromDetailedTickets, type JiraDetailedTicket, type JiraParticipant } from "./jira-import";

export async function latestCompletedJiraBatch() {
  const db = getDb();
  const [batch] = await db.select().from(jiraImportBatches)
    .where(eq(jiraImportBatches.status, "completed"))
    .orderBy(desc(jiraImportBatches.completedAt), desc(jiraImportBatches.createdAt))
    .limit(1);
  return batch ?? null;
}

type JiraTicketRow = Pick<typeof jiraTickets.$inferSelect, "key" | "internalId" | "status" | "summary" | "jiraCreatedAt" | "assigneeUserCode" | "jiraUpdatedAt" | "resolutionAt" | "link">;
type AnalystTicketRow = JiraTicketRow & { participantUserCode: string | null; participantJiraUserId: string | null };

const JIRA_READ_PAGE_SIZE = 1000;
const ticketColumns = `t.ticket_key AS key, t.internal_id AS internalId, t.status, t.summary,
  t.jira_created_at AS jiraCreatedAt, t.assignee_usercode AS assigneeUserCode,
  t.jira_updated_at AS jiraUpdatedAt, t.resolution_at AS resolutionAt, t.link`;

async function* ticketPages<T extends JiraTicketRow>(query: string, bindings: unknown[]) {
  const db = getRawDb();
  let afterKey = "";
  while (true) {
    const { results } = await db.prepare(`${query} AND t.ticket_key > ? ORDER BY t.ticket_key LIMIT ?`)
      .bind(...bindings, afterKey, JIRA_READ_PAGE_SIZE).all<T>();
    if (!results.length) return;
    yield results;
    if (results.length < JIRA_READ_PAGE_SIZE) return;
    afterKey = results[results.length - 1].key;
  }
}

function ticketFromRow(row: JiraTicketRow, participants: JiraParticipant[] = []): JiraDetailedTicket {
  return {
    key: row.key,
    internalId: row.internalId,
    status: canonicalJiraStatus(row.status),
    summary: row.summary,
    createdAt: row.jiraCreatedAt,
    assigneeUserCode: row.assigneeUserCode,
    updatedAt: row.jiraUpdatedAt,
    resolutionAt: row.resolutionAt,
    participants,
    link: row.link || `https://jira.example.test/browse/${row.key}`,
  };
}

export async function loadJiraActivityForAnalyst(usercode: string, year: number, week: number) {
  const normalizedUserCode = usercode.trim().toUpperCase();
  if (!/^[A-Z]\d{7}$/.test(normalizedUserCode)) return { open: [], resolved: [] };
  const range = isoWeekRange(year, week);
  const nextWeek = isoWeekRange(year, week + 1).from;
  const query = `SELECT ${ticketColumns}, p.usercode AS participantUserCode, p.jira_user_id AS participantJiraUserId
    FROM jira_tickets t
    LEFT JOIN jira_ticket_participants p ON p.ticket_key = t.ticket_key AND p.usercode = ?
    WHERE (t.assignee_usercode = ? OR (
      t.jira_updated_at >= ? AND t.jira_updated_at < ?
      AND t.ticket_key IN (SELECT ticket_key FROM jira_ticket_participants WHERE usercode = ?)
    ))`;
  const activity: ReturnType<typeof jiraActivityForAnalyst> = { open: [], resolved: [] };
  for await (const rows of ticketPages<AnalystTicketRow>(query, [normalizedUserCode, normalizedUserCode, range.from, nextWeek, normalizedUserCode])) {
    const tickets = rows.map((row) => ticketFromRow(row, row.participantUserCode ? [{ usercode: row.participantUserCode, jiraUserId: row.participantJiraUserId ?? "" }] : []));
    const page = jiraActivityForAnalyst(tickets, normalizedUserCode, year, week);
    activity.open.push(...page.open);
    activity.resolved.push(...page.resolved);
  }
  return {
    open: activity.open.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    resolved: activity.resolved.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
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
  const query = `SELECT ${ticketColumns} FROM jira_tickets t
    WHERE t.assignee_usercode IN (
      SELECT u.jira_name FROM global_user_markets m
      INNER JOIN global_users u ON u.id = m.user_id
      WHERE m.market_id = ? AND u.is_active = 1 AND u.role IN ('chef-produit', 'chef-marche')
    )`;
  const tickets: JiraDetailedTicket[] = [];
  for await (const rows of ticketPages<JiraTicketRow>(query, [marketId])) {
    tickets.push(...rows.filter((row) => !isClosedJiraStatus(row.status))
      .map((row) => ({ ...ticketFromRow(row), assigneeName: people.get(row.assigneeUserCode.toUpperCase()), marketId })));
  }
  return jiraSummaryFromDetailedTickets(tickets, "unknown");
}
