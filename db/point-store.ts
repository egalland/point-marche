import { getRawDb } from "./index";
import { isoWeekParts } from "../lib/iso-week";
import { samePointVersion, type DraftSnapshot, type PointScope, type PointVersion, type StoredPointDraft } from "../lib/point-persistence";

type Row = Record<string, string | number | null>;
const config = (scope: PointScope) => scope === "market"
  ? { table: "weekly_points", owner: "market_id", order: "version DESC" }
  : { table: "analyst_weekly_points", owner: "analyst_id", order: "updated_at DESC" };

export function serializePoint(scope: PointScope, row: Row) {
  const common = { id: String(row.id), revision: String(row.revision), year: Number(row.year), week: Number(row.week), meetingDate: String(row.meeting_date), data: JSON.parse(String(row.payload)) as Record<string, unknown>, createdAt: String(row.created_at) };
  return scope === "market" ? { ...common, marketId: String(row.market_id), pointName: String(row.point_name), themeColor: String(row.theme_color) }
    : { ...common, analystId: String(row.analyst_id), periodFrom: String(row.period_from), periodTo: String(row.period_to), updatedAt: String(row.updated_at) };
}

function serializeDraft(row: Row): StoredPointDraft {
  return { scope: row.scope as PointScope, ownerId: String(row.owner_id), data: JSON.parse(String(row.payload)), revision: String(row.revision), basePoint: row.base_point_id && row.base_point_revision ? { id: String(row.base_point_id), revision: String(row.base_point_revision) } : null, updatedAt: String(row.updated_at) };
}

export async function listPoints(scope: PointScope, ownerId: string) {
  const { table, owner, order } = config(scope);
  const { results } = await getRawDb().prepare(`SELECT * FROM ${table} WHERE ${owner} = ? ORDER BY year DESC, week DESC, ${order} LIMIT 300`).bind(ownerId).all<Row>();
  const seen = new Set<string>();
  return results.filter((row) => { const key = `${row.year}:${row.week}`; if (seen.has(key)) return false; seen.add(key); return true; }).map((row) => serializePoint(scope, row));
}

export async function readDraft(editor: string, scope: PointScope, ownerId: string, date?: string): Promise<DraftSnapshot> {
  const period = date ? isoWeekParts(date) : null;
  const row = await getRawDb().prepare(`SELECT * FROM point_drafts WHERE editor = ? AND scope = ? AND owner_id = ? ${period ? "AND year = ? AND week = ?" : ""} ORDER BY updated_at DESC LIMIT 1`)
    .bind(editor, scope, ownerId, ...(period ? [period.year, period.week] : [])).first<Row>();
  const selected = period ?? (row ? { year: row.year, week: row.week } : null);
  if (!selected) return { draft: null, point: null };
  const { table, owner, order } = config(scope);
  const point = await getRawDb().prepare(`SELECT * FROM ${table} WHERE ${owner} = ? AND year = ? AND week = ? ORDER BY ${order} LIMIT 1`).bind(ownerId, selected.year, selected.week).first<Row>();
  return { draft: row ? serializeDraft(row) : null, point: point ? serializePoint(scope, point) : null };
}

function pointGuard(scope: PointScope, ownerId: string, date: string, expected: PointVersion | null) {
  const { table, owner, order } = config(scope);
  const { year, week } = isoWeekParts(date);
  const query = `FROM ${table} WHERE ${owner} = ? AND year = ? AND week = ? ORDER BY ${order} LIMIT 1`;
  return { sql: `(SELECT id ${query}) IS ? AND (SELECT revision ${query}) IS ?`, values: [ownerId, year, week, expected?.id ?? null, ownerId, year, week, expected?.revision ?? null] };
}

export async function saveDraft(editor: string, scope: PointScope, ownerId: string, data: Record<string, unknown>, expectedRevision: string | null, basePoint: PointVersion | null) {
  const date = data.meetingDate as string;
  const { year, week } = isoWeekParts(date);
  const guard = pointGuard(scope, ownerId, date, basePoint);
  const revision = crypto.randomUUID();
  const row = await getRawDb().prepare(`INSERT INTO point_drafts (editor, scope, owner_id, year, week, meeting_date, payload, revision, base_point_id, base_point_revision, updated_at)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${guard.sql}
    AND (? IS NULL OR EXISTS (SELECT 1 FROM point_drafts WHERE editor = ? AND scope = ? AND owner_id = ? AND year = ? AND week = ? AND revision = ?))
    ON CONFLICT (editor, scope, owner_id, year, week) DO UPDATE SET meeting_date = excluded.meeting_date, payload = excluded.payload, revision = excluded.revision, base_point_id = excluded.base_point_id, base_point_revision = excluded.base_point_revision, updated_at = excluded.updated_at
    WHERE point_drafts.revision IS ? RETURNING *`)
    .bind(editor, scope, ownerId, year, week, date, JSON.stringify(data), revision, basePoint?.id ?? null, basePoint?.revision ?? null, new Date().toISOString(),
      ...guard.values, expectedRevision, editor, scope, ownerId, year, week, expectedRevision, expectedRevision).first<Row>();
  return row ? serializeDraft(row) : null;
}

export async function ownerExists(scope: PointScope, ownerId: string) {
  const query = scope === "market" ? "SELECT id FROM market_definitions WHERE id = ?" : "SELECT id FROM global_users WHERE id = ? AND role = 'analyste-tarif-referentiel' AND is_active = 1";
  return Boolean(await getRawDb().prepare(query).bind(ownerId).first());
}

// Both writes run in one D1 transaction. The random revision ties draft advancement
// to this exact successful save, including concurrent first saves of the same week.
export async function publishPoint(editor: string, scope: PointScope, ownerId: string, data: Record<string, unknown>, expectedPoint: PointVersion | null, draftRevision: string, marketName = "Marché") {
  const db = getRawDb();
  const { table, owner } = config(scope);
  const date = data.meetingDate as string;
  const { year, week } = isoWeekParts(date);
  const payload = JSON.stringify(data);
  const id = expectedPoint?.id ?? crypto.randomUUID();
  const revision = crypto.randomUUID(), nextDraftRevision = crypto.randomUUID(), now = new Date().toISOString();
  const guard = pointGuard(scope, ownerId, date, expectedPoint);
  const draftGuard = "EXISTS (SELECT 1 FROM point_drafts WHERE editor = ? AND scope = ? AND owner_id = ? AND year = ? AND week = ? AND revision = ? AND base_point_id IS ? AND base_point_revision IS ?)";
  const draftValues = [editor, scope, ownerId, year, week, draftRevision, expectedPoint?.id ?? null, expectedPoint?.revision ?? null];
  const fields = scope === "market" ? ["meeting_date", "point_name", "theme_color", "payload", "created_at", "revision"] : ["meeting_date", "period_from", "period_to", "payload", "updated_at", "revision"];
  const values = scope === "market" ? [date, marketName, data.themeColor, payload, now, revision] : [date, data.periodFrom, data.periodTo, payload, now, revision];
  const writePoint = expectedPoint
    ? db.prepare(`UPDATE ${table} SET ${fields.map((field) => `${field} = ?`).join(", ")} WHERE id = ? AND ${guard.sql} AND ${draftGuard} RETURNING *`).bind(...values, id, ...guard.values, ...draftValues)
    : db.prepare(`INSERT INTO ${table} (id, ${owner}, year, week, ${scope === "market" ? "version" : "created_at"}, ${fields.join(", ")}) SELECT ?, ?, ?, ?, ?, ${fields.map(() => "?").join(", ")} WHERE ${guard.sql} AND ${draftGuard} ON CONFLICT DO NOTHING RETURNING *`).bind(id, ownerId, year, week, scope === "market" ? 1 : now, ...values, ...guard.values, ...draftValues);
  const advanceDraft = db.prepare(`UPDATE point_drafts SET payload = ?, base_point_id = ?, base_point_revision = ?, revision = ?, updated_at = ?
    WHERE editor = ? AND scope = ? AND owner_id = ? AND year = ? AND week = ? AND revision = ?
    AND EXISTS (SELECT 1 FROM ${table} WHERE id = ? AND revision = ?) RETURNING *`)
    .bind(payload, id, revision, nextDraftRevision, now, editor, scope, ownerId, year, week, draftRevision, id, revision);
  const [pointResult, draftResult] = await db.batch<{ results: Row[] }>([writePoint, advanceDraft]);
  const row = pointResult.results[0], draft = draftResult.results[0];
  if (!row || !draft) return null;
  return { point: serializePoint(scope, row), draft: serializeDraft(draft) };
}

export function draftMatchesPoint(snapshot: DraftSnapshot) {
  return !snapshot.draft || samePointVersion(snapshot.draft.basePoint, snapshot.point);
}
