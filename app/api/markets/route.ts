import { and, asc, eq, max, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { marketDefinitions } from "../../../db/schema";
import { getEditorUser } from "../../simple-auth";

const tones = new Set(["mint", "violet", "aqua", "peach", "red"]);

function cleanName(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 80) : "";
}

function cleanShort(value: unknown, name: string) {
  const source = typeof value === "string" && value.trim() ? value : name;
  return source.trim().toLocaleUpperCase("fr-FR").replace(/\s+/g, "–").slice(0, 12);
}

function cleanTone(value: unknown) {
  return typeof value === "string" && tones.has(value) ? value : "mint";
}

function cleanHex(value: unknown) {
  if (typeof value !== "string") return "";
  const hex = value.trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(hex) ? hex : "";
}

function cleanPlannerTags(value: unknown) {
  const values = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[;,\n]/) : [];
  return Array.from(new Set(values
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().toLocaleUpperCase("fr-FR").replace(/\s+/g, " ").slice(0, 40))
    .filter(Boolean))).slice(0, 20);
}

function serializeMarket(row: typeof marketDefinitions.$inferSelect) {
  let plannerTags: string[] = [];
  try {
    const parsed = JSON.parse(row.plannerTags) as unknown;
    if (Array.isArray(parsed)) plannerTags = cleanPlannerTags(parsed);
  } catch {
    plannerTags = cleanPlannerTags(row.plannerTags);
  }
  return { ...row, plannerTags };
}

function cleanDays(value: unknown, fallback: number) {
  const days = Number(value);
  return Number.isInteger(days) && days >= 1 && days <= 365 ? days : fallback;
}

async function requireEditor() {
  const user = await getEditorUser();
  return user ? null : Response.json({ error: "Connecte-toi pour modifier les marchés." }, { status: 401 });
}

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Erreur inattendue";
  if (/unique|constraint/i.test(message)) return "Un marché porte déjà ce nom.";
  if (/no such table|market_definitions/i.test(message)) return "La liste des marchés n’est pas encore disponible.";
  return message;
}

export async function GET() {
  try {
    const db = getDb();
    const markets = await db.select().from(marketDefinitions)
      .where(eq(marketDefinitions.isActive, true))
      .orderBy(asc(marketDefinitions.position), asc(marketDefinitions.name));
    return Response.json({ markets: markets.map(serializeMarket) });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const denied = await requireEditor();
    if (denied) return denied;
    const body = await request.json() as { name?: unknown; shortCode?: unknown; tone?: unknown; colorHex?: unknown; plannerTags?: unknown; jiraWarningDays?: unknown; jiraCriticalDays?: unknown };
    const name = cleanName(body.name);
    if (!name) return Response.json({ error: "Le nom du marché est requis." }, { status: 400 });
    const jiraWarningDays = Math.min(364, cleanDays(body.jiraWarningDays, 10));
    const jiraCriticalDays = Math.min(365, Math.max(jiraWarningDays + 1, cleanDays(body.jiraCriticalDays, 20)));

    const db = getDb();
    const [positionResult] = await db.select({ value: max(marketDefinitions.position) }).from(marketDefinitions);
    const [existing] = await db.select().from(marketDefinitions).where(eq(marketDefinitions.name, name)).limit(1);
    if (existing) {
      if (existing.isActive) return Response.json({ error: "Un marché porte déjà ce nom." }, { status: 409 });
      const [restored] = await db.update(marketDefinitions).set({
        shortCode: cleanShort(body.shortCode, name),
        tone: cleanTone(body.tone),
        colorHex: cleanHex(body.colorHex),
        plannerTags: JSON.stringify(cleanPlannerTags(body.plannerTags)),
        jiraWarningDays,
        jiraCriticalDays,
        position: Number(positionResult?.value ?? -1) + 1,
        isActive: true,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      }).where(eq(marketDefinitions.id, existing.id)).returning();
      return Response.json({ market: serializeMarket(restored) }, { status: 201 });
    }
    const [market] = await db.insert(marketDefinitions).values({
      id: `market-${crypto.randomUUID()}`,
      name,
      shortCode: cleanShort(body.shortCode, name),
      tone: cleanTone(body.tone),
      colorHex: cleanHex(body.colorHex),
      plannerTags: JSON.stringify(cleanPlannerTags(body.plannerTags)),
      jiraWarningDays,
      jiraCriticalDays,
      position: Number(positionResult?.value ?? -1) + 1,
    }).returning();
    return Response.json({ market: serializeMarket(market) }, { status: 201 });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const denied = await requireEditor();
    if (denied) return denied;
    const body = await request.json() as { id?: unknown; name?: unknown; shortCode?: unknown; tone?: unknown; colorHex?: unknown; plannerTags?: unknown; jiraWarningDays?: unknown; jiraCriticalDays?: unknown };
    const id = typeof body.id === "string" ? body.id.trim() : "";
    const name = cleanName(body.name);
    if (!id || !name) return Response.json({ error: "Identifiant et nom du marché requis." }, { status: 400 });
    const jiraWarningDays = Math.min(364, cleanDays(body.jiraWarningDays, 10));
    const jiraCriticalDays = Math.min(365, Math.max(jiraWarningDays + 1, cleanDays(body.jiraCriticalDays, 20)));

    const db = getDb();
    const [market] = await db.update(marketDefinitions).set({
      name,
      shortCode: cleanShort(body.shortCode, name),
      tone: cleanTone(body.tone),
      colorHex: cleanHex(body.colorHex),
      plannerTags: JSON.stringify(cleanPlannerTags(body.plannerTags)),
      jiraWarningDays,
      jiraCriticalDays,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    }).where(and(eq(marketDefinitions.id, id), eq(marketDefinitions.isActive, true))).returning();
    if (!market) return Response.json({ error: "Marché introuvable." }, { status: 404 });
    return Response.json({ market: serializeMarket(market) });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const denied = await requireEditor();
    if (denied) return denied;
    const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
    if (!id) return Response.json({ error: "Identifiant du marché requis." }, { status: 400 });

    const db = getDb();
    const activeMarkets = await db.select({ id: marketDefinitions.id }).from(marketDefinitions).where(eq(marketDefinitions.isActive, true));
    if (activeMarkets.length <= 1) return Response.json({ error: "Il faut conserver au moins un marché actif." }, { status: 409 });

    const [market] = await db.update(marketDefinitions).set({ isActive: false, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(and(eq(marketDefinitions.id, id), eq(marketDefinitions.isActive, true))).returning();
    if (!market) return Response.json({ error: "Marché introuvable." }, { status: 404 });
    return Response.json({ removedId: market.id });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}
