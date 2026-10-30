import {storedJiraAnalytics,jiraRegistryRevision,jiraAnalyticsCacheDb} from '../../../lib/jira-analytics-server';
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { jiraImportBatches, jiraImportParticipants, jiraImportTickets, jiraTicketParticipants, jiraTickets } from "../../../db/schema";
import type { JiraCsvTicket } from "../../../lib/jira-csv";
import { JIRA_DELETE_KEYS_PER_STATEMENT, JIRA_PARTICIPANT_ROWS_PER_STATEMENT, JIRA_STATEMENTS_PER_BATCH, JIRA_TICKET_ROWS_PER_STATEMENT, jiraImportChunks } from "../../../lib/jira-import-batching";
import { getRuntimeEnv } from "../../../lib/runtime-env";
import { getEditorUser } from "../../simple-auth";
import { jiraImportCountError } from "../../../lib/jira-import-integrity";
import { isIsoDate } from "../../../lib/iso-week";
import { safeExternalUrl } from "../../../lib/safe-link";

const MAX_CHUNK_SIZE = 250;

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Erreur inattendue";
  if (/no such table|jira_import_batches|jira_tickets|jira_ticket_participants/i.test(message)) return "Le nouveau registre Jira n’est pas encore disponible.";
  return message;
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function validDateTime(value: string) {
  return !value || (isIsoDate(value.slice(0, 10)) && /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(value));
}

function cleanTicket(value: unknown): JiraCsvTicket | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const key = cleanText(source.key, 40).toUpperCase();
  const createdAt = cleanText(source.createdAt, 19);
  const updatedAt = cleanText(source.updatedAt, 19);
  const resolutionAt = cleanText(source.resolutionAt, 19);
  const assigneeUserCode = cleanText(source.assigneeUserCode, 20).toUpperCase();
  if (!/^[A-Z][A-Z0-9]+-\d+$/.test(key) || !validDateTime(createdAt) || !validDateTime(updatedAt) || !validDateTime(resolutionAt)) return null;
  const participants = Array.isArray(source.participants) ? source.participants.flatMap((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const participant = value as Record<string, unknown>;
    const usercode = cleanText(participant.usercode, 20).toUpperCase();
    if (!/^[A-Z]\d{7}$/.test(usercode)) return [];
    return [{ usercode, jiraUserId: cleanText(participant.jiraUserId, 80) }];
  }) : [];
  return {
    key,
    internalId: cleanText(source.internalId, 60),
    status: cleanText(source.status, 120),
    summary: cleanText(source.summary, 4000),
    issueType: cleanText(source.issueType, 240),
    category: cleanText(source.category, 240),
    subcategory: cleanText(source.subcategory, 240),
    createdAt,
    assigneeUserCode: /^[A-Z]\d{7}$/.test(assigneeUserCode) ? assigneeUserCode : "",
    updatedAt,
    resolutionAt,
    participants: Array.from(new Map(participants.map((participant) => [participant.usercode, participant])).values()),
    link: safeExternalUrl(cleanText(source.link, 500)) || `https://jira.example.test/browse/${key}`,
  };
}

function serializeBatch(batch: typeof jiraImportBatches.$inferSelect) {
  return {
    id: batch.id,
    sourceProfile: batch.sourceProfile,
    filename: batch.filename,
    status: batch.status,
    rowCount: batch.rowCount,
    ticketCount: batch.ticketCount,
    participantCount: batch.participantCount,
    rejectedCount: batch.rejectedCount,
    repairedTextCount: batch.repairedTextCount,
    unknownUserCodeCount: batch.unknownUserCodeCount,
    createdAt: batch.createdAt,
    completedAt: batch.completedAt,
  };
}

function rawDb() {
  const db = getRuntimeEnv()?.DB;
  if (!db) throw new Error("Le registre D1 est indisponible.");
  return db;
}

export async function GET() {
  try {
    const editor = await getEditorUser();
    if (!editor) return Response.json({ error: "Connecte-toi pour consulter les imports." }, { status: 401 });
    const db = getDb();
    const [batches, [{ count: ticketCount }], [{ count: participantCount }]] = await Promise.all([
      db.select().from(jiraImportBatches).orderBy(desc(jiraImportBatches.createdAt)).limit(12),
      db.select({ count: sql<number>`count(*)` }).from(jiraTickets),
      db.select({ count: sql<number>`count(*)` }).from(jiraTicketParticipants),
    ]);
    return Response.json({ batches: batches.map(serializeBatch), registry: { ticketCount: Number(ticketCount) || 0, participantCount: Number(participantCount) || 0 } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const editor = await getEditorUser();
    if (!editor) return Response.json({ error: "Connecte-toi pour importer les tickets Jira." }, { status: 401 });
    const body = await request.json() as Record<string, unknown>;
    const action = cleanText(body.action, 20);
    const db = getDb();

    if (action === "start") {
      const rowCount = Math.max(0, Math.min(250_000, Math.round(Number(body.rowCount) || 0)));
      const [batch] = await db.insert(jiraImportBatches).values({
        id: crypto.randomUUID(),
        sourceProfile: "jira-participants",
        filename: cleanText(body.filename, 240),
        rowCount,
        importedBy: editor.username,
      }).returning();
      return Response.json({ batch: serializeBatch(batch), maxChunkSize: MAX_CHUNK_SIZE }, { status: 201 });
    }

    const importId = cleanText(body.importId, 80);
    const [batch] = importId ? await db.select().from(jiraImportBatches).where(eq(jiraImportBatches.id, importId)).limit(1) : [];
    if (!batch || batch.status !== "uploading") return Response.json({ error: "Session d’import introuvable ou déjà terminée." }, { status: 409 });

    if (action === "chunk") {
      const incoming = Array.isArray(body.tickets) ? body.tickets : [];
      if (!incoming.length || incoming.length > MAX_CHUNK_SIZE) return Response.json({ error: `Chaque lot doit contenir entre 1 et ${MAX_CHUNK_SIZE} tickets.` }, { status: 400 });
      const tickets = incoming.map(cleanTicket).filter((ticket): ticket is JiraCsvTicket => Boolean(ticket));
      if (tickets.length !== incoming.length) return Response.json({ error: "Une ou plusieurs lignes normalisées sont invalides." }, { status: 400 });
      const keys = tickets.map((ticket) => ticket.key);
      const ticketRows = tickets.map((ticket) => ({
        id: `${importId}:${ticket.key}`,
        importId,
        ticketKey: ticket.key,
        internalId: ticket.internalId,
        status: ticket.status,
        summary: ticket.summary,
        issueType: ticket.issueType ?? "",
        category: ticket.category ?? "",
        subcategory: ticket.subcategory ?? "",
        jiraCreatedAt: ticket.createdAt,
        assigneeUserCode: ticket.assigneeUserCode,
        jiraUpdatedAt: ticket.updatedAt,
        resolutionAt: ticket.resolutionAt,
        link: ticket.link,
      }));
      const participantRows = tickets.flatMap((ticket) => ticket.participants.map((participant) => ({
        id: `${importId}:${ticket.key}:${participant.usercode}`,
        importId,
        ticketKey: ticket.key,
        usercode: participant.usercode,
        jiraUserId: participant.jiraUserId,
      })));
      const operations = [
        ...jiraImportChunks(ticketRows, JIRA_TICKET_ROWS_PER_STATEMENT).map((rows) => db.insert(jiraImportTickets).values(rows).onConflictDoUpdate({
          target: [jiraImportTickets.importId, jiraImportTickets.ticketKey],
          set: {
            internalId: sql`excluded.internal_id`,
            status: sql`excluded.status`,
            summary: sql`excluded.summary`,
            issueType: sql`excluded.issue_type`,
            category: sql`excluded.category`,
            subcategory: sql`excluded.subcategory`,
            jiraCreatedAt: sql`excluded.jira_created_at`,
            assigneeUserCode: sql`excluded.assignee_usercode`,
            jiraUpdatedAt: sql`excluded.jira_updated_at`,
            resolutionAt: sql`excluded.resolution_at`,
            link: sql`excluded.link`,
          },
        })),
        ...jiraImportChunks(keys, JIRA_DELETE_KEYS_PER_STATEMENT).map((ticketKeys) => db.delete(jiraImportParticipants).where(and(eq(jiraImportParticipants.importId, importId), inArray(jiraImportParticipants.ticketKey, ticketKeys)))),
        ...jiraImportChunks(participantRows, JIRA_PARTICIPANT_ROWS_PER_STATEMENT).map((rows) => db.insert(jiraImportParticipants).values(rows)),
      ];
      for (const statements of jiraImportChunks(operations, JIRA_STATEMENTS_PER_BATCH)) {
        const [first, ...rest] = statements;
        if (first) await db.batch([first, ...rest]);
      }
      return Response.json({ accepted: tickets.length, participants: participantRows.length });
    }

    if (action === "finish") {
      const rejectedCount = Math.max(0, Math.round(Number(body.rejectedCount) || 0));
      const repairedTextCount = Math.max(0, Math.round(Number(body.repairedTextCount) || 0));
      const unknownUserCodeCount = Math.max(0, Math.round(Number(body.unknownUserCodeCount) || 0));
      const raw = rawDb();
      const [tickets, participants] = await Promise.all([
        raw.prepare("SELECT count(*) AS count FROM jira_import_tickets WHERE import_id = ?").bind(importId).first<{ count: number }>(),
        raw.prepare("SELECT count(*) AS count FROM jira_import_participants WHERE import_id = ?").bind(importId).first<{ count: number }>(),
      ]);
      const integrityError = jiraImportCountError({ tickets: body.expectedTicketCount, participants: body.expectedParticipantCount }, { tickets: Number(tickets?.count ?? 0), participants: Number(participants?.count ?? 0) });
      if (integrityError) return Response.json({ error: integrityError }, { status: 409 });
      let cacheAvailable=true;try{await jiraAnalyticsCacheDb();}catch{cacheAvailable=false;}
      await raw.batch([
        ...(cacheAvailable?[raw.prepare("INSERT INTO app_jira_analytics_cache(cache_key,part,revision,payload) VALUES ('registry',-1,'registry',?) ON CONFLICT(cache_key,part) DO UPDATE SET payload=excluded.payload").bind(crypto.randomUUID())]:[]),
        raw.prepare(`INSERT INTO jira_tickets (ticket_key, internal_id, status, summary, issue_type, category, subcategory, jira_created_at, assignee_usercode, jira_updated_at, resolution_at, link, last_import_id, imported_at)
          SELECT ticket_key, internal_id, status, summary, issue_type, category, subcategory, jira_created_at, assignee_usercode, jira_updated_at, resolution_at, link, import_id, CURRENT_TIMESTAMP
          FROM jira_import_tickets WHERE import_id = ?
          ON CONFLICT(ticket_key) DO UPDATE SET internal_id = excluded.internal_id, status = excluded.status, summary = excluded.summary, issue_type = excluded.issue_type, category = excluded.category, subcategory = excluded.subcategory,
          jira_created_at = excluded.jira_created_at, assignee_usercode = excluded.assignee_usercode, jira_updated_at = excluded.jira_updated_at,
          resolution_at = excluded.resolution_at, link = excluded.link, last_import_id = excluded.last_import_id, imported_at = CURRENT_TIMESTAMP`).bind(importId),
        raw.prepare(`DELETE FROM jira_ticket_participants WHERE ticket_key IN (SELECT ticket_key FROM jira_import_tickets WHERE import_id = ?)`).bind(importId),
        raw.prepare(`INSERT INTO jira_ticket_participants (id, ticket_key, usercode, jira_user_id, last_import_id, created_at, updated_at)
          SELECT ticket_key || ':' || usercode, ticket_key, usercode, jira_user_id, import_id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          FROM jira_import_participants WHERE import_id = ?`).bind(importId),
        raw.prepare(`UPDATE jira_import_batches SET status = 'completed',
          ticket_count = (SELECT count(*) FROM jira_import_tickets WHERE import_id = ?),
          participant_count = (SELECT count(*) FROM jira_import_participants WHERE import_id = ?),
          rejected_count = ?, repaired_text_count = ?, unknown_usercode_count = ?, completed_at = ?
          WHERE id = ? AND status = 'uploading'`).bind(importId, importId, rejectedCount, repairedTextCount, unknownUserCodeCount, new Date().toISOString(), importId),
        raw.prepare(`DELETE FROM jira_import_participants WHERE import_id = ?`).bind(importId),
        raw.prepare(`DELETE FROM jira_import_tickets WHERE import_id = ?`).bind(importId),
      ]);
      const [saved] = await db.select().from(jiraImportBatches).where(eq(jiraImportBatches.id, importId)).limit(1);
      // Cache failure must never turn a committed import into a reported failed import.
      let analyticsReady=false;
      try{analyticsReady=(await storedJiraAnalytics(await jiraRegistryRevision(saved),true)).persisted;}catch{}
      return Response.json({ batch: serializeBatch(saved),analyticsReady });
    }

    if (action === "fail") {
      const raw = rawDb();
      await raw.batch([
        raw.prepare(`UPDATE jira_import_batches SET status = 'failed', completed_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'uploading'`).bind(importId),
        raw.prepare(`DELETE FROM jira_import_participants WHERE import_id = ?`).bind(importId),
        raw.prepare(`DELETE FROM jira_import_tickets WHERE import_id = ?`).bind(importId),
      ]);
      return Response.json({ failed: true });
    }

    return Response.json({ error: "Action d’import inconnue." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}
