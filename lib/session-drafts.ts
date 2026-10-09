import { isIsoDate, isoWeekParts } from "./iso-week";

type Draft = { scope: "market" | "analyst"; ownerId: string; data: Record<string, unknown> };

// Hosted drafts live for this tab's session. The portable app uses its file store.
export class SessionDrafts {
  private entries = new Map<string, Draft>();
  private latest = new Map<string, string>();
  private saved = new Map<string, string>();

  private key(scope: Draft["scope"], ownerId: string, meetingDate: unknown) {
    if (typeof meetingDate !== "string" || !isIsoDate(meetingDate)) return null;
    const { year, week } = isoWeekParts(meetingDate);
    return `${scope}:${ownerId}:${year}:${week}`;
  }

  read(scope: Draft["scope"], ownerId: string, meetingDate?: string) {
    const key = meetingDate ? this.key(scope, ownerId, meetingDate) : this.latest.get(`${scope}:${ownerId}`);
    return key ? this.entries.get(key) ?? null : null;
  }

  write(draft: Draft) {
    const key = this.key(draft.scope, draft.ownerId, draft.data.meetingDate);
    if (!key) return;
    this.entries.set(key, draft);
    this.latest.set(`${draft.scope}:${draft.ownerId}`, key);
  }

  markSaved(draft: Draft) {
    const key = this.key(draft.scope, draft.ownerId, draft.data.meetingDate);
    if (key) this.saved.set(key, JSON.stringify(draft.data));
  }

  hasUnsaved() {
    return [...this.entries].some(([key, draft]) => JSON.stringify(draft.data) !== this.saved.get(key));
  }

  clear() {
    this.entries.clear();
    this.latest.clear();
    this.saved.clear();
  }
}
