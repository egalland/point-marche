import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { weeklyPoints } from "../../../db/schema";
import { getEditorUser } from "../../simple-auth";

type SavePointRequest = {
  marketId?: string;
  marketName?: string;
  data?: {
    meetingDate?: string;
    pointName?: string;
    themeColor?: string;
    [key: string]: unknown;
  };
};

function isoWeekParts(dateString: string) {
  const date = new Date(`${dateString}T12:00:00Z`);
  const target = new Date(date.valueOf());
  const day = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - day + 3);
  const year = target.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(year, 0, 4, 12));
  const firstDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3);
  return { year, week: 1 + Math.round((target.valueOf() - firstThursday.valueOf()) / 604800000) };
}

function serializePoint(row: typeof weeklyPoints.$inferSelect) {
  return {
    id: row.id,
    marketId: row.marketId,
    year: row.year,
    week: row.week,
    meetingDate: row.meetingDate,
    pointName: row.pointName,
    themeColor: row.themeColor,
    data: JSON.parse(row.payload),
    createdAt: row.createdAt,
  };
}

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Erreur inattendue";
  if (/no such table|weekly_points/i.test(message)) {
    return "Le registre des points n’est pas encore disponible.";
  }
  return message;
}

export async function GET(request: Request) {
  try {
    const marketId = new URL(request.url).searchParams.get("marketId")?.trim();
    if (!marketId) return Response.json({ error: "marketId est requis" }, { status: 400 });

    const db = getDb();
    const rows = await db.select().from(weeklyPoints)
      .where(eq(weeklyPoints.marketId, marketId))
      .orderBy(desc(weeklyPoints.year), desc(weeklyPoints.week), desc(weeklyPoints.version))
      .limit(200);

    const latestByWeek = new Map<string, typeof weeklyPoints.$inferSelect>();
    rows.forEach((row) => {
      const key = `${row.year}-${row.week}`;
      if (!latestByWeek.has(key)) latestByWeek.set(key, row);
    });
    return Response.json({ points: Array.from(latestByWeek.values(), (row) => serializePoint(row)) });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getEditorUser();
    if (!user) return Response.json({ error: "Connecte-toi pour enregistrer le point." }, { status: 401 });
    const body = await request.json() as SavePointRequest;
    const marketId = body.marketId?.trim() ?? "";
    const data = body.data;
    const meetingDate = data?.meetingDate?.trim() ?? "";
    const pointName = body.marketName?.trim() || "Marché";
    const themeColor = data?.themeColor?.trim() || "mint";

    if (!marketId || !data || !/^\d{4}-\d{2}-\d{2}$/.test(meetingDate)) {
      return Response.json({ error: "Marché, date et contenu du point sont requis." }, { status: 400 });
    }

    const payload = JSON.stringify({ ...data, pointName: "Point marché", themeColor });
    if (payload.length > 1_500_000) {
      return Response.json({ error: "Le point est trop volumineux pour être enregistré." }, { status: 413 });
    }

    const { year, week } = isoWeekParts(meetingDate);
    const db = getDb();

    const [existing] = await db.select().from(weeklyPoints)
      .where(and(eq(weeklyPoints.marketId, marketId), eq(weeklyPoints.year, year), eq(weeklyPoints.week, week)))
      .orderBy(desc(weeklyPoints.version)).limit(1);

    if (existing) {
      const [saved] = await db.update(weeklyPoints).set({
        meetingDate,
        pointName,
        themeColor,
        payload,
        createdAt: sql`CURRENT_TIMESTAMP`,
      }).where(eq(weeklyPoints.id, existing.id)).returning();
      return Response.json({ point: serializePoint(saved) });
    }

    try {
      const [saved] = await db.insert(weeklyPoints).values({
        id: crypto.randomUUID(),
        marketId,
        year,
        week,
        version: 1,
        meetingDate,
        pointName,
        themeColor,
        payload,
      }).returning();
      return Response.json({ point: serializePoint(saved) }, { status: 201 });
    } catch (error) {
      if (!/unique|constraint/i.test(error instanceof Error ? error.message : "")) throw error;
      const [concurrent] = await db.select().from(weeklyPoints)
        .where(and(eq(weeklyPoints.marketId, marketId), eq(weeklyPoints.year, year), eq(weeklyPoints.week, week)))
        .orderBy(desc(weeklyPoints.version)).limit(1);
      if (!concurrent) throw error;
      const [saved] = await db.update(weeklyPoints).set({ meetingDate, pointName, themeColor, payload, createdAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(weeklyPoints.id, concurrent.id)).returning();
      return Response.json({ point: serializePoint(saved) });
    }
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}
