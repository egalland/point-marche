import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { jiraMarketAssignments, jiraWeeklySnapshots, marketDefinitions } from "../../../db/schema";
import { parseJiraAssigneeSummary } from "../../../lib/jira-import";
import { getChatGPTUser } from "../../chatgpt-auth";

type AssignmentPayload = Record<string, unknown>;

function validPeriod(year: number, week: number) {
  return Number.isInteger(year) && year >= 2020 && year <= 2200 && Number.isInteger(week) && week >= 1 && week <= 53;
}

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Erreur inattendue";
  if (/no such table|jira_weekly_snapshots|jira_market_assignments/i.test(message)) return "Le registre Jira hebdomadaire n’est pas encore disponible.";
  return message;
}

function assignmentMap(rows: (typeof jiraMarketAssignments.$inferSelect)[]) {
  return rows.reduce<Record<string, string[]>>((result, row) => {
    result[row.marketId] = [...(result[row.marketId] ?? []), row.assignee];
    return result;
  }, {});
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const year = Number(url.searchParams.get("year"));
    const week = Number(url.searchParams.get("week"));
    if (!validPeriod(year, week)) return Response.json({ error: "Année ou semaine ISO invalide." }, { status: 400 });

    const db = getDb();
    const [snapshot] = await db.select().from(jiraWeeklySnapshots)
      .where(and(eq(jiraWeeklySnapshots.year, year), eq(jiraWeeklySnapshots.week, week))).limit(1);
    const assignments = await db.select().from(jiraMarketAssignments)
      .orderBy(asc(jiraMarketAssignments.marketId), asc(jiraMarketAssignments.assignee));

    return Response.json({
      snapshot: snapshot ? {
        year: snapshot.year,
        week: snapshot.week,
        rawText: snapshot.rawText,
        summary: JSON.parse(snapshot.payload),
        updatedAt: snapshot.updatedAt,
      } : null,
      assignments: assignmentMap(assignments),
    });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: "Connecte-toi pour enregistrer le tableau Jira." }, { status: 401 });

    const body = await request.json() as { year?: unknown; week?: unknown; rawText?: unknown; assignments?: AssignmentPayload };
    const year = Number(body.year);
    const week = Number(body.week);
    const rawText = typeof body.rawText === "string" ? body.rawText.trim() : "";
    if (!validPeriod(year, week)) return Response.json({ error: "Année ou semaine ISO invalide." }, { status: 400 });
    if (!rawText) return Response.json({ error: "Colle d’abord le tableau Jira complet." }, { status: 400 });
    if (rawText.length > 1_500_000) return Response.json({ error: "Le tableau Jira est trop volumineux." }, { status: 413 });

    const summary = parseJiraAssigneeSummary(rawText);
    if (!summary.personCount) return Response.json({ error: "Aucune personne Jira reconnue dans le tableau." }, { status: 400 });

    const db = getDb();
    const now = sql`CURRENT_TIMESTAMP`;
    await db.insert(jiraWeeklySnapshots).values({
      id: crypto.randomUUID(),
      year,
      week,
      rawText,
      payload: JSON.stringify(summary),
      updatedBy: user.email,
    }).onConflictDoUpdate({
      target: [jiraWeeklySnapshots.year, jiraWeeklySnapshots.week],
      set: { rawText, payload: JSON.stringify(summary), updatedBy: user.email, updatedAt: now },
    });

    const activeMarkets = await db.select({ id: marketDefinitions.id }).from(marketDefinitions)
      .where(eq(marketDefinitions.isActive, true));
    const people = summary.people.map((person) => person.assignee);
    const knownPeople = new Set(people);
    for (const market of activeMarkets) {
      await db.delete(jiraMarketAssignments).where(and(
        eq(jiraMarketAssignments.marketId, market.id),
        inArray(jiraMarketAssignments.assignee, people),
      ));
      const selected = Array.isArray(body.assignments?.[market.id])
        ? (body.assignments?.[market.id] as unknown[]).filter((name): name is string => typeof name === "string" && knownPeople.has(name))
        : [];
      if (selected.length) {
        await db.insert(jiraMarketAssignments).values(selected.map((assignee) => ({
          id: crypto.randomUUID(),
          marketId: market.id,
          assignee,
        }))).onConflictDoNothing();
      }
    }

    const savedAssignments = await db.select().from(jiraMarketAssignments)
      .orderBy(asc(jiraMarketAssignments.marketId), asc(jiraMarketAssignments.assignee));
    return Response.json({
      snapshot: { year, week, rawText, summary, updatedAt: new Date().toISOString() },
      assignments: assignmentMap(savedAssignments),
    }, { status: 201 });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}
