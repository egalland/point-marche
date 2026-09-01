import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { globalUsers, jiraAnalystWeeklySnapshots } from "../../../db/schema";
import { analystJiraTickets, type AnalystJiraTicket } from "../../../lib/analyst-point";
import type { GlobalDirectoryUser } from "../../../lib/global-directory";
import { latestCompletedJiraBatch, loadJiraActivityForAnalyst } from "../../../lib/jira-registry-server";
import { shouldPreferCentralJira } from "../../../lib/jira-source-priority";
import { getEditorUser } from "../../simple-auth";

function validPeriod(year: number, week: number) {
  return Number.isInteger(year) && year >= 2020 && year <= 2200 && Number.isInteger(week) && week >= 1 && week <= 53;
}

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Erreur inattendue";
  if (/no such table|jira_analyst_weekly_snapshots|jira_import_batches|jira_tickets|jira_ticket_participants/i.test(message)) return "Le registre Jira des analystes n’est pas encore disponible.";
  return message;
}

function serialize(snapshot: typeof jiraAnalystWeeklySnapshots.$inferSelect) {
  return {
    analystId: snapshot.analystId,
    year: snapshot.year,
    week: snapshot.week,
    rawText: snapshot.rawText,
    tickets: JSON.parse(snapshot.payload) as AnalystJiraTicket[],
    updatedAt: snapshot.updatedAt,
  };
}

function serializeCentralTicket(ticket: Awaited<ReturnType<typeof loadJiraActivityForAnalyst>>["open"][number]): AnalystJiraTicket {
  return {
    id: `${ticket.key}:${ticket.updatedAt}`,
    key: ticket.key,
    internalId: ticket.internalId,
    summary: ticket.summary,
    status: ticket.status,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    link: ticket.link,
  };
}

async function activeAnalyst(analystId: string) {
  const db = getDb();
  const [row] = await db.select({
    id: globalUsers.id,
    name: globalUsers.name,
    email: globalUsers.email,
    usercode: globalUsers.usercode,
    plannerAlias: globalUsers.plannerAlias,
  }).from(globalUsers).where(and(
    eq(globalUsers.id, analystId),
    eq(globalUsers.role, "analyste-tarif-referentiel"),
    eq(globalUsers.isActive, true),
  )).limit(1);
  if (!row) return null;
  return { ...row, role: "analyste-tarif-referentiel", marketIds: [] } satisfies GlobalDirectoryUser;
}

export async function GET(request: Request) {
  try {
    const editor = await getEditorUser();
    if (!editor) return Response.json({ error: "Connecte-toi pour consulter les tickets de l’analyste." }, { status: 401 });
    const url = new URL(request.url);
    const analystId = url.searchParams.get("analystId")?.trim() ?? "";
    const year = Number(url.searchParams.get("year"));
    const week = Number(url.searchParams.get("week"));
    if (!analystId || !validPeriod(year, week)) return Response.json({ error: "Analyste, année ou semaine ISO invalide." }, { status: 400 });
    const analyst = await activeAnalyst(analystId);
    if (!analyst) return Response.json({ error: "Analyste actif introuvable dans l’annuaire GLOBAL." }, { status: 404 });
    const db = getDb();
    const [[snapshot], batch] = await Promise.all([
      db.select().from(jiraAnalystWeeklySnapshots).where(and(
        eq(jiraAnalystWeeklySnapshots.analystId, analystId),
        eq(jiraAnalystWeeklySnapshots.year, year),
        eq(jiraAnalystWeeklySnapshots.week, week),
      )).limit(1),
      latestCompletedJiraBatch(),
    ]);
    const centralUpdatedAt = batch?.completedAt ?? batch?.createdAt;
    const centralActivity = batch ? await loadJiraActivityForAnalyst(analyst.usercode, year, week) : null;
    if (batch && shouldPreferCentralJira(centralUpdatedAt, snapshot?.updatedAt)) {
      return Response.json({
        snapshot: {
          analystId,
          year,
          week,
          rawText: "",
          tickets: centralActivity?.open.map(serializeCentralTicket) ?? [],
          resolvedTickets: centralActivity?.resolved.map(serializeCentralTicket) ?? [],
          updatedAt: centralUpdatedAt,
          source: "central",
        },
      }, { headers: { "Cache-Control": "no-store" } });
    }
    return Response.json({
      snapshot: snapshot ? { ...serialize(snapshot), resolvedTickets: centralActivity?.resolved.map(serializeCentralTicket) ?? [], source: "weekly" } : null,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const editor = await getEditorUser();
    if (!editor) return Response.json({ error: "Connecte-toi pour enregistrer les tickets de l’analyste." }, { status: 401 });
    const body = await request.json() as { analystId?: unknown; year?: unknown; week?: unknown; rawText?: unknown };
    const analystId = typeof body.analystId === "string" ? body.analystId.trim() : "";
    const year = Number(body.year);
    const week = Number(body.week);
    const rawText = typeof body.rawText === "string" ? body.rawText.trim() : "";
    if (!analystId || !validPeriod(year, week)) return Response.json({ error: "Analyste, année ou semaine ISO invalide." }, { status: 400 });
    if (!rawText) return Response.json({ error: "Colle d’abord l’export Jira détaillé." }, { status: 400 });
    if (rawText.length > 1_500_000) return Response.json({ error: "Le tableau Jira est trop volumineux." }, { status: 413 });
    const analyst = await activeAnalyst(analystId);
    if (!analyst) return Response.json({ error: "Analyste actif introuvable dans l’annuaire GLOBAL." }, { status: 404 });
    const tickets = analystJiraTickets(rawText, analyst);
    if (!tickets.length) return Response.json({ error: `Aucun ticket ouvert ne correspond au USERCODE ${analyst.usercode}.` }, { status: 409 });
    const db = getDb();
    const [saved] = await db.insert(jiraAnalystWeeklySnapshots).values({
      id: crypto.randomUUID(), analystId, year, week, rawText, payload: JSON.stringify(tickets), updatedBy: editor.username,
    }).onConflictDoUpdate({
      target: [jiraAnalystWeeklySnapshots.analystId, jiraAnalystWeeklySnapshots.year, jiraAnalystWeeklySnapshots.week],
      set: { rawText, payload: JSON.stringify(tickets), updatedBy: editor.username, updatedAt: sql`CURRENT_TIMESTAMP` },
    }).returning();
    return Response.json({ snapshot: serialize(saved), imported: tickets.length }, { status: 201 });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}
