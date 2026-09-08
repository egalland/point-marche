import { isIsoDate, isoWeekParts } from "./iso-week";

export type PointScope = "market" | "analyst";
export type PointVersion = { id: string; revision: string };
export type PointDraft = { scope: PointScope; ownerId: string; data: Record<string, unknown> };
export type PublishedPoint = PointVersion & { data: Record<string, unknown>; createdAt: string; updatedAt?: string };
export type StoredPointDraft = PointDraft & { revision: string; basePoint: PointVersion | null; updatedAt: string };
export type DraftSnapshot = { draft: StoredPointDraft | null; point: PublishedPoint | null };
export type DraftState = { status: "idle" | "pending" | "saving" | "saved" | "error" | "conflict"; updatedAt: string; message: string };

export function pointDraftKey(scope: PointScope, ownerId: string, date: unknown) {
  if (!ownerId || typeof date !== "string" || !isIsoDate(date)) return null;
  const { year, week } = isoWeekParts(date);
  return `${scope}:${ownerId}:${year}:${week}`;
}

export function pointVersion(value: unknown): PointVersion | null | undefined {
  if (value === null) return null;
  if (!value || typeof value !== "object") return undefined;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string" && row.id && typeof row.revision === "string" && row.revision
    ? { id: row.id, revision: row.revision } : undefined;
}

export function samePointVersion(left: PointVersion | null, right: PointVersion | null) {
  return left?.id === right?.id && left?.revision === right?.revision;
}

export function pointTimeLabel(value: string) {
  if (!value) return "Date inconnue";
  const date = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  return Number.isFinite(date.getTime()) ? date.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "Date inconnue";
}
