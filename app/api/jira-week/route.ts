import { and, asc, eq, or, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { globalUserMarkets, globalUsers, jiraMarketWeeklySnapshots, jiraWeeklySnapshots, marketDefinitions } from "../../../db/schema";
import { parseJiraAssigneeSummary, type JiraSummaryImport } from "../../../lib/jira-import";
import { latestCompletedJiraBatch, loadOpenMarketJiraSummary } from "../../../lib/jira-registry-server";
import { shouldPreferCentralJira } from "../../../lib/jira-source-priority";
import { getEditorUser } from "../../simple-auth";

function validPeriod(year: number, week: number) {
  return Number.isInteger(year) && year >= 2020 && year <= 2200 && Number.isInteger(week) && week >= 1 && week <= 53;
}

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Erreur inattendue";
  if (/no such table|jira_weekly_snapshots|jira_market_weekly_snapshots|jira_market_assignments|jira_import_batches|jira_tickets|jira_ticket_participants/i.test(message)) return "Le registre Jira hebdomadaire n’est pas encore disponible.";
  return message;
}

function assignmentMap(rows: { marketId: string; assignee: string }[]) {
  return rows.reduce<Record<string, string[]>>((result, row) => {
    if (!/^[A-Z]\d{7}$/i.test(row.assignee)) return result;
    result[row.marketId] = [...(result[row.marketId] ?? []), row.assignee];
    return result;
  }, {});
}

function serializedSnapshot(snapshot: typeof jiraMarketWeeklySnapshots.$inferSelect | typeof jiraWeeklySnapshots.$inferSelect, summary: JiraSummaryImport) {
  return {
    year: snapshot.year,
    week: snapshot.week,
    rawText: snapshot.rawText,
    summary,
    updatedAt: snapshot.updatedAt,
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const marketId = url.searchParams.get("marketId")?.trim() ?? "";
    const preferCentral = url.searchParams.get("preferCentral") === "1";
    const year = Number(url.searchParams.get("year"));
    const week = Number(url.searchParams.get("week"));
    if (!marketId || !validPeriod(year, week)) return Response.json({ error: "Marché, année ou semaine ISO invalide." }, { status: 400 });

    const db = getDb();
    const [[marketSnapshot], assignments, batch] = await Promise.all([
      db.select().from(jiraMarketWeeklySnapshots)
        .where(and(eq(jiraMarketWeeklySnapshots.marketId, marketId), eq(jiraMarketWeeklySnapshots.year, year), eq(jiraMarketWeeklySnapshots.week, week))).limit(1),
      db.select({ marketId: globalUserMarkets.marketId, assignee: globalUsers.usercode })
        .from(globalUserMarkets)
        .innerJoin(globalUsers, eq(globalUserMarkets.userId, globalUsers.id))
        .where(and(eq(globalUsers.isActive, true), or(eq(globalUsers.role, "chef-produit"), eq(globalUsers.role, "chef-marche"))))
        .orderBy(asc(globalUserMarkets.marketId), asc(globalUsers.usercode)),
      latestCompletedJiraBatch(),
    ]);
    const centralUpdatedAt = batch?.completedAt ?? batch?.createdAt;
    const centralResponse = async (weeklyUpdatedAt?: string) => {
      if (!batch || !shouldPreferCentralJira(centralUpdatedAt, weeklyUpdatedAt, preferCentral)) return null;
      const centralSummary = await loadOpenMarketJiraSummary(marketId);
      return centralSummary ? Response.json({
        snapshot: { year, week, rawText: "", summary: centralSummary, updatedAt: centralUpdatedAt, source: "central" },
        assignments: assignmentMap(assignments),
      }) : null;
    };
    if (marketSnapshot) {
      const newerCentral = await centralResponse(marketSnapshot.updatedAt);
      if (newerCentral) return newerCentral;
      return Response.json({
        snapshot: { ...serializedSnapshot(marketSnapshot, JSON.parse(marketSnapshot.payload) as JiraSummaryImport), source: "weekly" },
        assignments: assignmentMap(assignments),
      });
    }

    const [legacySnapshot] = await db.select().from(jiraWeeklySnapshots)
      .where(and(eq(jiraWeeklySnapshots.year, year), eq(jiraWeeklySnapshots.week, week))).limit(1);
    const centralOverLegacy = await centralResponse(legacySnapshot?.updatedAt);
    if (centralOverLegacy) return centralOverLegacy;
    if (legacySnapshot) return Response.json({
      snapshot: { ...serializedSnapshot(legacySnapshot, JSON.parse(legacySnapshot.payload) as JiraSummaryImport), source: "weekly" },
      assignments: assignmentMap(assignments),
    });
    return Response.json({
      snapshot: null,
      assignments: assignmentMap(assignments),
    });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const editor = await getEditorUser();
    if (!editor) return Response.json({ error: "Connecte-toi pour enregistrer le tableau Jira." }, { status: 401 });

    const body = await request.json() as { marketId?: unknown; year?: unknown; week?: unknown; rawText?: unknown };
    const marketId = typeof body.marketId === "string" ? body.marketId.trim() : "";
    const year = Number(body.year);
    const week = Number(body.week);
    const rawText = typeof body.rawText === "string" ? body.rawText.trim() : "";
    if (!marketId || !validPeriod(year, week)) return Response.json({ error: "Marché, année ou semaine ISO invalide." }, { status: 400 });
    if (!rawText) return Response.json({ error: "Colle d’abord le tableau Jira détaillé." }, { status: 400 });
    if (rawText.length > 1_500_000) return Response.json({ error: "Le tableau Jira est trop volumineux." }, { status: 413 });

    const parsed = parseJiraAssigneeSummary(rawText);
    if (parsed.mode !== "detailed" || !parsed.detailedTickets.length) {
      return Response.json({ error: "Le tableau détaillé avec ticket, état, résumé, création, USERCODE et mise à jour n’a pas été reconnu." }, { status: 400 });
    }

    const db = getDb();
    const [market] = await db.select({ id: marketDefinitions.id }).from(marketDefinitions)
      .where(and(eq(marketDefinitions.id, marketId), eq(marketDefinitions.isActive, true))).limit(1);
    if (!market) return Response.json({ error: "Marché introuvable." }, { status: 404 });

    const directory = await db.select({ usercode: globalUsers.usercode, name: globalUsers.name })
      .from(globalUserMarkets)
      .innerJoin(globalUsers, eq(globalUserMarkets.userId, globalUsers.id))
      .where(and(
        eq(globalUserMarkets.marketId, marketId),
        eq(globalUsers.isActive, true),
        or(eq(globalUsers.role, "chef-produit"), eq(globalUsers.role, "chef-marche")),
      ));
    const directoryByUserCode = new Map(directory.map((person) => [person.usercode.toUpperCase(), person]));
    if (!directoryByUserCode.size) return Response.json({ error: "Ajoute d’abord un chef de produit ou un chef de marché avec son USERCODE dans l’annuaire." }, { status: 409 });

    const summary: JiraSummaryImport = {
      ...parsed,
      people: parsed.people.map((person) => {
        const known = directoryByUserCode.get(person.assignee.toUpperCase());
        return { ...person, displayName: known?.name, marketId: known ? marketId : undefined };
      }),
      detailedTickets: parsed.detailedTickets.map((ticket) => {
        const known = directoryByUserCode.get(ticket.assigneeUserCode.toUpperCase());
        return { ...ticket, assigneeName: known?.name, marketId: known ? marketId : undefined };
      }),
    };
    const recognizedTickets = summary.detailedTickets.filter((ticket) => ticket.marketId === marketId);
    if (!recognizedTickets.length) return Response.json({ error: "Aucun USERCODE de cet export ne correspond aux personnes du marché." }, { status: 409 });

    const now = sql`CURRENT_TIMESTAMP`;
    await db.insert(jiraMarketWeeklySnapshots).values({
      id: crypto.randomUUID(), marketId, year, week, rawText, payload: JSON.stringify(summary), updatedBy: editor.username,
    }).onConflictDoUpdate({
      target: [jiraMarketWeeklySnapshots.marketId, jiraMarketWeeklySnapshots.year, jiraMarketWeeklySnapshots.week],
      set: { rawText, payload: JSON.stringify(summary), updatedBy: editor.username, updatedAt: now },
    });

    return Response.json({
      snapshot: { year, week, rawText, summary, updatedAt: new Date().toISOString() },
      assignments: { [marketId]: Array.from(directoryByUserCode.keys()) },
      recognizedTickets: recognizedTickets.length,
    }, { status: 201 });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}
