import { and, asc, eq, or, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { globalUserMarkets, globalUsers, jiraMarketAssignments, marketDefinitions } from "../../../db/schema";
import { isGlobalRole, roleMailMode, roleUsesAutomaticJira, type GlobalRole } from "../../../lib/global-directory";
import { getEditorUser } from "../../simple-auth";

type UserPayload = { id?: unknown; name?: unknown; email?: unknown; usercode?: unknown; plannerAlias?: unknown; role?: unknown; marketId?: unknown; marketIds?: unknown };

async function requireEditor() {
  const editor = await getEditorUser();
  return editor ? null : Response.json({ error: "Connecte-toi pour gérer l’annuaire GLOBAL." }, { status: 401 });
}

function cleanText(value: unknown, maxLength = 100) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maxLength) : "";
}

function cleanEmail(value: unknown) {
  const email = typeof value === "string" ? value.trim().toLocaleLowerCase("fr-FR").slice(0, 180) : "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function cleanRole(value: unknown): GlobalRole {
  return typeof value === "string" && isGlobalRole(value) ? value : "autre";
}

function cleanUserCode(value: unknown) {
  const usercode = typeof value === "string" ? value.trim().toUpperCase() : "";
  return /^[A-Z]\d{7}$/.test(usercode) ? usercode : "";
}

function cleanMarketIds(marketId: unknown, legacyMarketIds: unknown) {
  const requested = typeof marketId === "string" && marketId.trim()
    ? [marketId.trim()]
    : Array.isArray(legacyMarketIds) ? legacyMarketIds.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).slice(0, 1).map((item) => item.trim()) : [];
  return Array.from(new Set(requested)).slice(0, 1);
}

async function validateMarkets(marketIds: string[]) {
  if (!marketIds.length) return [];
  const db = getDb();
  const rows = await db.select({ id: marketDefinitions.id }).from(marketDefinitions).where(eq(marketDefinitions.isActive, true));
  const active = new Set(rows.map((row) => row.id));
  return marketIds.filter((id) => active.has(id));
}

async function ensureSingleTariffManager(role: GlobalRole, currentId = "") {
  if (role !== "manager-tarif") return null;
  const db = getDb();
  const [manager] = await db.select({ id: globalUsers.id }).from(globalUsers)
    .where(and(eq(globalUsers.role, "manager-tarif"), eq(globalUsers.isActive, true))).limit(1);
  return manager && manager.id !== currentId ? Response.json({ error: "Un manager Tarif est déjà renseigné." }, { status: 409 }) : null;
}

async function syncLinks(userId: string, oldUserCode: string, usercode: string, role: GlobalRole, marketIds: string[]) {
  const db = getDb();
  await db.delete(globalUserMarkets).where(eq(globalUserMarkets.userId, userId));
  if (marketIds.length) {
    await db.insert(globalUserMarkets).values(marketIds.map((marketId) => ({ id: crypto.randomUUID(), userId, marketId }))).onConflictDoNothing();
  }
  await db.delete(jiraMarketAssignments).where(oldUserCode === usercode
    ? eq(jiraMarketAssignments.assignee, usercode)
    : or(eq(jiraMarketAssignments.assignee, oldUserCode), eq(jiraMarketAssignments.assignee, usercode)));
  if (roleUsesAutomaticJira(role) && marketIds.length) {
    await db.insert(jiraMarketAssignments).values(marketIds.map((marketId) => ({ id: crypto.randomUUID(), marketId, assignee: usercode }))).onConflictDoNothing();
  }
}

async function serializeDirectory() {
  const db = getDb();
  const [users, links] = await Promise.all([
    db.select().from(globalUsers).where(eq(globalUsers.isActive, true)).orderBy(asc(globalUsers.name)),
    db.select().from(globalUserMarkets).orderBy(asc(globalUserMarkets.marketId)),
  ]);
  return users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    usercode: user.usercode,
    plannerAlias: user.plannerAlias,
    role: user.role,
    marketIds: links.filter((link) => link.userId === user.id).map((link) => link.marketId),
  }));
}

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Erreur inattendue";
  if (/unique|constraint/i.test(message)) return "Cette adresse e-mail existe déjà dans l’annuaire.";
  if (/no such table|global_users|global_user_markets/i.test(message)) return "L’annuaire GLOBAL n’est pas encore disponible.";
  return message;
}

export async function GET() {
  try {
    const denied = await requireEditor();
    if (denied) return denied;
    return Response.json({ users: await serializeDirectory() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const denied = await requireEditor();
    if (denied) return denied;
    const body = await request.json() as UserPayload;
    const name = cleanText(body.name);
    const email = cleanEmail(body.email);
    const usercode = cleanUserCode(body.usercode);
    const plannerAlias = cleanText(body.plannerAlias, 80);
    const role = cleanRole(body.role);
    const marketIds = role === "manager-tarif" ? [] : await validateMarkets(cleanMarketIds(body.marketId, body.marketIds));
    if (!name || !email) return Response.json({ error: "Nom et adresse e-mail sont requis." }, { status: 400 });
    if (roleUsesAutomaticJira(role) && !usercode) return Response.json({ error: "Un USERCODE valide est requis pour l’automatisation Jira." }, { status: 400 });
    if (typeof body.usercode === "string" && body.usercode.trim() && !usercode) return Response.json({ error: "Le USERCODE doit contenir une lettre suivie de 7 chiffres." }, { status: 400 });
    if (role !== "manager-tarif" && roleMailMode(role) === "to" && !marketIds.length) return Response.json({ error: "Sélectionne le marché de cette personne." }, { status: 400 });
    const db = getDb();
    const [knownUserCode] = usercode ? await db.select({ id: globalUsers.id }).from(globalUsers).where(and(eq(globalUsers.usercode, usercode), eq(globalUsers.isActive, true))).limit(1) : [];
    if (knownUserCode) return Response.json({ error: "Ce USERCODE existe déjà dans l’annuaire." }, { status: 409 });
    const [knownEmail] = await db.select().from(globalUsers).where(eq(globalUsers.email, email)).limit(1);
    if (knownEmail?.isActive) return Response.json({ error: "Cette adresse e-mail existe déjà dans l’annuaire." }, { status: 409 });
    const managerConflict = await ensureSingleTariffManager(role, knownEmail?.id ?? "");
    if (managerConflict) return managerConflict;
    const id = knownEmail?.id ?? crypto.randomUUID();
    const [created] = knownEmail
      ? await db.update(globalUsers).set({ name, usercode, plannerAlias, role, isActive: true, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(globalUsers.id, id)).returning()
      : await db.insert(globalUsers).values({ id, name, email, usercode, plannerAlias, role }).returning();
    await syncLinks(id, knownEmail?.usercode ?? usercode, usercode, role, marketIds);
    return Response.json({ user: { ...created, marketIds }, users: await serializeDirectory() }, { status: 201 });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const denied = await requireEditor();
    if (denied) return denied;
    const body = await request.json() as UserPayload;
    const id = cleanText(body.id, 80);
    const name = cleanText(body.name);
    const email = cleanEmail(body.email);
    const usercode = cleanUserCode(body.usercode);
    const plannerAlias = cleanText(body.plannerAlias, 80);
    const role = cleanRole(body.role);
    const marketIds = role === "manager-tarif" ? [] : await validateMarkets(cleanMarketIds(body.marketId, body.marketIds));
    if (!id || !name || !email) return Response.json({ error: "Utilisateur, nom et adresse e-mail sont requis." }, { status: 400 });
    if (roleUsesAutomaticJira(role) && !usercode) return Response.json({ error: "Un USERCODE valide est requis pour l’automatisation Jira." }, { status: 400 });
    if (typeof body.usercode === "string" && body.usercode.trim() && !usercode) return Response.json({ error: "Le USERCODE doit contenir une lettre suivie de 7 chiffres." }, { status: 400 });
    if (role !== "manager-tarif" && roleMailMode(role) === "to" && !marketIds.length) return Response.json({ error: "Sélectionne le marché de cette personne." }, { status: 400 });
    const managerConflict = await ensureSingleTariffManager(role, id);
    if (managerConflict) return managerConflict;
    const db = getDb();
    const [existing] = await db.select().from(globalUsers).where(and(eq(globalUsers.id, id), eq(globalUsers.isActive, true))).limit(1);
    if (!existing) return Response.json({ error: "Utilisateur introuvable." }, { status: 404 });
    const [usercodeConflict] = usercode ? await db.select({ id: globalUsers.id }).from(globalUsers).where(and(eq(globalUsers.usercode, usercode), eq(globalUsers.isActive, true))).limit(1) : [];
    if (usercodeConflict && usercodeConflict.id !== id) return Response.json({ error: "Ce USERCODE existe déjà dans l’annuaire." }, { status: 409 });
    const [updated] = await db.update(globalUsers).set({ name, email, usercode, plannerAlias, role, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(globalUsers.id, id)).returning();
    await syncLinks(id, existing.usercode, usercode, role, marketIds);
    return Response.json({ user: { ...updated, marketIds }, users: await serializeDirectory() });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const denied = await requireEditor();
    if (denied) return denied;
    const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
    if (!id) return Response.json({ error: "Utilisateur requis." }, { status: 400 });
    const db = getDb();
    const [existing] = await db.select().from(globalUsers).where(and(eq(globalUsers.id, id), eq(globalUsers.isActive, true))).limit(1);
    if (!existing) return Response.json({ error: "Utilisateur introuvable." }, { status: 404 });
    await db.delete(globalUserMarkets).where(eq(globalUserMarkets.userId, id));
    await db.delete(jiraMarketAssignments).where(eq(jiraMarketAssignments.assignee, existing.usercode));
    await db.update(globalUsers).set({ isActive: false, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(globalUsers.id, id));
    return Response.json({ removedId: id, users: await serializeDirectory() });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}
