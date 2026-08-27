import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { analystWeeklyPoints, globalUsers } from "../../../db/schema";
import { isoWeekParts } from "../../../lib/analyst-point";
import { getEditorUser } from "../../simple-auth";

function serialize(row: typeof analystWeeklyPoints.$inferSelect) {
  return { id: row.id, analystId: row.analystId, year: row.year, week: row.week, meetingDate: row.meetingDate, periodFrom: row.periodFrom, periodTo: row.periodTo, data: JSON.parse(row.payload), createdAt: row.createdAt, updatedAt: row.updatedAt };
}

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Erreur inattendue";
  if (/no such table|analyst_weekly_points/i.test(message)) return "Le registre des points analystes n’est pas encore disponible.";
  return message;
}

export async function GET(request: Request) {
  try {
    const editor = await getEditorUser();
    if (!editor) return Response.json({ error: "Connecte-toi pour consulter les points analystes." }, { status: 401 });
    const analystId = new URL(request.url).searchParams.get("analystId")?.trim() ?? "";
    if (!analystId) return Response.json({ error: "analystId est requis" }, { status: 400 });
    const db = getDb();
    const rows = await db.select().from(analystWeeklyPoints).where(eq(analystWeeklyPoints.analystId, analystId)).orderBy(desc(analystWeeklyPoints.year), desc(analystWeeklyPoints.week)).limit(260);
    return Response.json({ points: rows.map(serialize) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const editor = await getEditorUser();
    if (!editor) return Response.json({ error: "Connecte-toi pour enregistrer le point analyste." }, { status: 401 });
    const body = await request.json() as { analystId?: unknown; data?: Record<string, unknown> };
    const analystId = typeof body.analystId === "string" ? body.analystId.trim() : "";
    const data = body.data;
    const meetingDate = typeof data?.meetingDate === "string" ? data.meetingDate : "";
    const periodFrom = typeof data?.periodFrom === "string" ? data.periodFrom : "";
    const periodTo = typeof data?.periodTo === "string" ? data.periodTo : "";
    if (!analystId || !/^\d{4}-\d{2}-\d{2}$/.test(meetingDate) || !/^\d{4}-\d{2}-\d{2}$/.test(periodFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(periodTo) || !data) return Response.json({ error: "Analyste, semaine et contenu sont requis." }, { status: 400 });
    const payload = JSON.stringify(data);
    if (payload.length > 1_500_000) return Response.json({ error: "Le point analyste est trop volumineux." }, { status: 413 });
    const db = getDb();
    const [analyst] = await db.select({ id: globalUsers.id }).from(globalUsers).where(and(eq(globalUsers.id, analystId), eq(globalUsers.role, "analyste-tarif-referentiel"), eq(globalUsers.isActive, true))).limit(1);
    if (!analyst) return Response.json({ error: "Analyste actif introuvable dans l’annuaire GLOBAL." }, { status: 404 });
    const { year, week } = isoWeekParts(meetingDate);
    const [saved] = await db.insert(analystWeeklyPoints).values({ id: crypto.randomUUID(), analystId, year, week, meetingDate, periodFrom, periodTo, payload })
      .onConflictDoUpdate({ target: [analystWeeklyPoints.analystId, analystWeeklyPoints.year, analystWeeklyPoints.week], set: { meetingDate, periodFrom, periodTo, payload, updatedAt: sql`CURRENT_TIMESTAMP` } }).returning();
    return Response.json({ point: serialize(saved) }, { status: 201 });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}
