import {marketJiraSummary} from "./jira-point-activity";
import {directoryUsersAt} from "./directory-store";
import { jiraMarketKpis } from "./jira-market-kpis";
import { selectMarketTickets } from "./jira-market-scope";
import { and, desc, eq, or } from "drizzle-orm";
import { getDb, getRawDb } from "../db";
import { globalUserMarkets, globalUsers, jiraImportBatches, jiraTickets, marketDefinitions } from "../db/schema";
import { addIsoDays, isIsoDate, isoWeekForDate, isoWeekRange } from "./iso-week";
import { jiraCompletionWeeks, validateJiraHistoryRange, type JiraHistoryRange } from "./analyst-jira-history";
import { jiraActivityForAnalyst } from "./jira-analyst-activity";
import { canonicalJiraStatus, isAbandonedJiraStatus, isClosedJiraStatus, jiraSummaryFromDetailedTickets, type JiraDetailedTicket, type JiraParticipant } from "./jira-import";

export async function latestCompletedJiraBatch() {
  const db = getDb();
  const [batch] = await db.select().from(jiraImportBatches)
    .where(eq(jiraImportBatches.status, "completed"))
    .orderBy(desc(jiraImportBatches.completedAt), desc(jiraImportBatches.createdAt))
    .limit(1);
  return batch ?? null;
}

type JiraTicketRow = Pick<typeof jiraTickets.$inferSelect, "key" | "internalId" | "status" | "summary" | "category" | "subcategory" | "jiraCreatedAt" | "assigneeUserCode" | "jiraUpdatedAt" | "resolutionAt" | "link">;
type AnalystTicketRow = JiraTicketRow & { participantUserCode: string | null; participantJiraUserId: string | null };

const JIRA_READ_PAGE_SIZE = 1000;
const ticketColumns = `t.ticket_key AS key, t.internal_id AS internalId, t.status, t.summary, t.category, t.subcategory,
  t.jira_created_at AS jiraCreatedAt, t.assignee_usercode AS assigneeUserCode,
  t.jira_updated_at AS jiraUpdatedAt, t.resolution_at AS resolutionAt, t.link`;

async function* ticketPages<T extends { key: string }>(query: string, bindings: unknown[]) {
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
    category: row.category,
    subcategory: row.subcategory,
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

export async function loadJiraCompletionHistory(usercode: string, requestedRange: JiraHistoryRange) {
  const normalizedUserCode = usercode.trim().toUpperCase();
  if (!/^[A-Z]\d{7}$/.test(normalizedUserCode)) throw new Error("USERCODE Jira invalide.");
  const rangeError = validateJiraHistoryRange(requestedRange);
  if (rangeError) throw new Error(rangeError);
  const weeks = jiraCompletionWeeks(requestedRange);
  const from = weeks[0].from;
  const to = weeks[weeks.length - 1].to;
  const byMonday = new Map(weeks.map((week) => [week.from, week]));
  const query = `SELECT t.ticket_key AS key, t.status, t.jira_updated_at AS jiraUpdatedAt
    FROM jira_tickets t
    WHERE t.jira_updated_at >= ? AND t.jira_updated_at < ?
      AND (t.assignee_usercode = ? OR t.ticket_key IN (
        SELECT ticket_key FROM jira_ticket_participants WHERE usercode = ?
      ))`;
  for await (const rows of ticketPages<Pick<JiraTicketRow, "key" | "status" | "jiraUpdatedAt">>(query, [from, addIsoDays(to, 1), normalizedUserCode, normalizedUserCode])) {
    for (const row of rows) {
      if (!isClosedJiraStatus(row.status) || isAbandonedJiraStatus(row.status) || !isIsoDate(row.jiraUpdatedAt.slice(0, 10))) continue;
      const week = byMonday.get(isoWeekForDate(row.jiraUpdatedAt.slice(0, 10)).from);
      if (week) week.count += 1;
    }
  }
  return { from, to, weeks };
}

export async function loadOpenMarketJiraSummary(marketId: string, reference = new Date().toISOString().slice(0,10)) {
  const db = getDb();
  const [directory, definitions] = await Promise.all([
    directoryUsersAt(reference).then(users=>users.filter(u=>u.marketIds.includes(marketId))),
    db.select().from(marketDefinitions).where(eq(marketDefinitions.isActive, true)),
  ]);
  const markets=definitions.map(m=>({id:m.id,shortLabel:m.shortCode,plannerTags:JSON.parse(m.plannerTags) as string[]}));
  const market=markets.find(m=>m.id===marketId);if(!market)return null;
  const people=new Map(directory.map(p=>[p.usercode.toUpperCase(),p.name]));
  const tickets:JiraDetailedTicket[]=[];
  for await(const rows of ticketPages<JiraTicketRow>(`SELECT ${ticketColumns} FROM jira_tickets t WHERE 1=1`,[]))tickets.push(...rows.map(row=>ticketFromRow(row)));
  const relevant=selectMarketTickets(tickets,market,markets,people).filter(t=>!isAbandonedJiraStatus(t.status));
  return marketJiraSummary(relevant,reference);
}

/** Page the registry and participants without truncating large imports or N+1 reads. */
export async function loadJiraAnalyticsTickets(){
 const result:JiraDetailedTicket[]=[];
 for await(const rows of ticketPages<JiraTicketRow>(`SELECT ${ticketColumns} FROM jira_tickets t WHERE 1=1`,[]))result.push(...rows.map(r=>ticketFromRow(r)));
 const byKey=new Map(result.map(t=>[t.key,t]));const db=getRawDb();let after='';
 for(;;){const page=(await db.prepare('SELECT id,ticket_key,usercode,jira_user_id FROM jira_ticket_participants WHERE id > ? ORDER BY id LIMIT 1000').bind(after).all<{id:string;ticket_key:string;usercode:string;jira_user_id:string}>()).results;
  for(const p of page)byKey.get(p.ticket_key)?.participants?.push({usercode:p.usercode,jiraUserId:p.jira_user_id});if(page.length<1000)break;after=page[page.length-1].id;
 }
 return result;
}


/** A cached KPI request hydrates at most two visible pages, never the whole registry. */
export async function loadJiraAnalyticsTicketPage(keys:string[]){
 const result:JiraDetailedTicket[]=[],db=getRawDb(),unique=[...new Set(keys)];
 for(let offset=0;offset<unique.length;offset+=50){const part=unique.slice(offset,offset+50),slots=part.map(()=>'?').join(',');
  const rows=(await db.prepare(`SELECT ${ticketColumns} FROM jira_tickets t WHERE t.ticket_key IN (${slots})`).bind(...part).all<JiraTicketRow>()).results;
  const byKey=new Map(rows.map(r=>{const t=ticketFromRow(r);result.push(t);return [t.key,t] as const;}));let after='';
  for(;;){const participants=(await db.prepare(`SELECT id,ticket_key,usercode,jira_user_id FROM jira_ticket_participants WHERE ticket_key IN (${slots}) AND id > ? ORDER BY id LIMIT 1000`).bind(...part,after).all<{id:string;ticket_key:string;usercode:string;jira_user_id:string}>()).results;
   for(const p of participants)byKey.get(p.ticket_key)?.participants?.push({usercode:p.usercode,jiraUserId:p.jira_user_id});if(participants.length<1000)break;after=participants.at(-1)!.id;
  }
 }
 return result;
}
