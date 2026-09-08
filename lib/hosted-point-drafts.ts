import { pointDraftKey, samePointVersion, type DraftSnapshot, type DraftState, type PointDraft, type PointScope, type PointVersion, type PublishedPoint, type StoredPointDraft } from "./point-persistence";

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;
type Entry = {
  value: PointDraft; basePoint: PointVersion | null; revision: string | null;
  synced: string; loaded: boolean; state: DraftState; publishing: boolean;
  timer?: ReturnType<typeof setTimeout>; flight?: Promise<boolean>; retry: number;
};
const signature = (data: Record<string, unknown>) => JSON.stringify(data);
const idle = (): DraftState => ({ status: "idle", updatedAt: "", message: "" });
const version = (point: PointVersion | null) => point ? { id: point.id, revision: point.revision } : null;

// One queue per point survives view changes. Writes are serialized, while each
// week retains its own server revision and the shared point it was based on.
export class HostedPointDrafts {
  private entries = new Map<string, Entry>();
  private latest = new Map<string, string>();
  private published = new Map<string, PublishedPoint>();
  private listeners = new Set<() => void>();
  private editor: string | null = null;
  private generation = 0;
  constructor(private request: Fetcher, private delay = 1000) {}

  get enabled() { return Boolean(this.editor); }
  configure(editor: string | null) {
    if (editor === this.editor) return;
    this.clear(); this.editor = editor;
  }
  clear() {
    this.generation++;
    for (const entry of this.entries.values()) clearTimeout(entry.timer);
    this.entries.clear(); this.latest.clear(); this.published.clear(); this.emit();
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private emit() { for (const listener of this.listeners) listener(); }
  private setState(entry: Entry, status: DraftState["status"], message = "", updatedAt = entry.state.updatedAt) {
    entry.state = { status, message, updatedAt }; this.emit();
  }
  private entry(scope: PointScope, ownerId: string, date?: string) {
    const key = date ? pointDraftKey(scope, ownerId, date) : this.latest.get(`${scope}:${ownerId}`);
    return key ? this.entries.get(key) : undefined;
  }
  read(scope: PointScope, ownerId: string, date?: string) { return this.entry(scope, ownerId, date)?.value ?? null; }
  state(scope: PointScope, ownerId: string, date: string) { return this.entry(scope, ownerId, date)?.state ?? idle(); }
  pendingCount() { return [...this.entries.values()].filter((entry) => entry.state.status !== "saved" && entry.state.status !== "idle").length; }
  hasUnsaved() { return this.pendingCount() > 0; }

  observe(scope: PointScope, ownerId: string, point: PublishedPoint) {
    const key = pointDraftKey(scope, ownerId, point.data.meetingDate);
    if (key) this.published.set(key, point);
  }
  write(value: PointDraft) {
    if (!this.enabled) return;
    const key = pointDraftKey(value.scope, value.ownerId, value.data.meetingDate);
    if (!key) return;
    let entry = this.entries.get(key);
    if (!entry) {
      const point = this.published.get(key);
      entry = { value, basePoint: version(point ?? null), revision: null, synced: point ? signature(point.data) : "", loaded: false, state: idle(), publishing: false, retry: 0 };
      this.entries.set(key, entry);
    }
    const changed = signature(value.data) !== signature(entry.value.data);
    entry.value = value;
    this.latest.set(`${value.scope}:${value.ownerId}`, key);
    if (entry.state.status === "conflict") return;
    if (entry.synced === signature(value.data)) {
      if (!entry.flight && entry.state.status !== "saved") this.setState(entry, "saved");
      return;
    }
    if (entry.state.status === "error" && !changed) return;
    this.setState(entry, entry.flight ? "saving" : "pending");
    this.schedule(entry);
  }
  private schedule(entry: Entry, delay = this.delay) {
    clearTimeout(entry.timer);
    if (entry.publishing || entry.flight || entry.state.status === "conflict" || !this.enabled) return;
    entry.timer = setTimeout(() => { void this.flush(entry); }, delay);
  }
  private async snapshot(scope: PointScope, ownerId: string, date?: string): Promise<DraftSnapshot> {
    const query = new URLSearchParams({ scope, ownerId, ...(date ? { meetingDate: date } : {}) });
    const response = await this.request(`/api/point-drafts?${query}`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Impossible de reprendre le brouillon. Réessaie.");
    return { draft: body.draft ?? null, point: body.point ?? null };
  }
  private adopt(entry: Entry, snapshot: DraftSnapshot, replace: boolean) {
    const remote = snapshot.draft;
    entry.loaded = true;
    entry.revision = remote?.revision ?? null;
    entry.basePoint = version(remote?.basePoint ?? snapshot.point);
    entry.synced = remote ? signature(remote.data) : snapshot.point ? signature(snapshot.point.data) : "";
    if (replace && (remote || snapshot.point)) entry.value = { ...entry.value, data: (remote ?? snapshot.point)!.data };
    const key = pointDraftKey(entry.value.scope, entry.value.ownerId, entry.value.data.meetingDate)!;
    if (snapshot.point) this.published.set(key, snapshot.point);
    if (remote && !samePointVersion(remote.basePoint, snapshot.point)) this.setState(entry, "conflict", "Le point partagé a changé depuis ce brouillon.", remote.updatedAt);
    else this.setState(entry, signature(entry.value.data) === entry.synced ? "saved" : "pending", "", remote?.updatedAt ?? snapshot.point?.createdAt ?? "");
  }
  async load(scope: PointScope, ownerId: string, date?: string) {
    if (!this.enabled) return null;
    const epoch = this.generation;
    const local = this.entry(scope, ownerId, date);
    const selectedDate = date ?? local?.value.data.meetingDate as string | undefined;
    const snapshot = await this.snapshot(scope, ownerId, selectedDate);
    if (epoch !== this.generation || !this.enabled) return null;
    const value = snapshot.draft ?? (selectedDate && snapshot.point ? { scope, ownerId, data: snapshot.point.data } : null);
    const current = this.entry(scope, ownerId, selectedDate ?? value?.data.meetingDate as string | undefined);
    if (current) {
      if (current.flight || current.publishing || signature(current.value.data) !== current.synced) {
        if (current.loaded && current.revision !== (snapshot.draft?.revision ?? null) && signature(current.value.data) !== signature(value?.data ?? {})) this.setState(current, "conflict", "Une autre copie a été sauvegardée.");
        return current.value;
      }
      this.adopt(current, snapshot, true);
      return current.value;
    }
    if (!value) return null;
    const key = pointDraftKey(scope, ownerId, value.data.meetingDate)!;
    const entry: Entry = { value: { scope, ownerId, data: value.data }, basePoint: null, revision: null, synced: "", loaded: false, state: idle(), publishing: false, retry: 0 };
    this.entries.set(key, entry); this.latest.set(`${scope}:${ownerId}`, key);
    this.adopt(entry, snapshot, true);
    return entry.value;
  }

  private async flush(entry: Entry, target?: PointDraft, keepalive = false): Promise<boolean> {
    clearTimeout(entry.timer);
    if (!this.enabled || entry.state.status === "conflict") return false;
    if (entry.flight) { await entry.flight; return this.flush(entry, target, keepalive); }
    const value = target ?? entry.value;
    if (entry.loaded && signature(value.data) === entry.synced && (entry.revision || !target)) { this.setState(entry, "saved"); return true; }
    const epoch = this.generation;
    const current = () => epoch === this.generation && this.enabled;
    const perform = async () => {
      try {
        if (!entry.loaded) {
          const snapshot = await this.snapshot(value.scope, value.ownerId, value.data.meetingDate as string);
          if (!current()) return false;
          // Never attach a newly fetched version to local edits made from an older point.
          if ((snapshot.draft && signature(snapshot.draft.data) !== signature(value.data)) || !samePointVersion(entry.basePoint, snapshot.point)) {
            if (snapshot.draft && signature(snapshot.draft.data) === signature(value.data) && samePointVersion(snapshot.draft.basePoint, snapshot.point)) { this.adopt(entry, snapshot, false); return true; }
            this.setState(entry, "conflict", "Une autre copie existe en ligne. Compare les copies pour continuer."); return false;
          }
          this.adopt(entry, snapshot, false);
          if (entry.state.status === "conflict") return false;
        }
        if (signature(value.data) === entry.synced && (entry.revision || !target)) return true;
        this.setState(entry, "saving");
        const body = JSON.stringify({ ...value, expectedRevision: entry.revision, basePoint: entry.basePoint });
        const response = await this.request("/api/point-drafts", { method: "PUT", headers: { "content-type": "application/json" }, body, keepalive: keepalive && new TextEncoder().encode(body).length < 60_000 });
        const result = await response.json();
        if (!current()) return false;
        if (response.status === 409) {
          // A response may have been lost after a successful write. Recognize the
          // exact copy already persisted instead of forcing a spurious conflict.
          const snapshot = await this.snapshot(value.scope, value.ownerId, value.data.meetingDate as string);
          if (!current()) return false;
          if (snapshot.draft && signature(snapshot.draft.data) === signature(value.data) && samePointVersion(snapshot.draft.basePoint, snapshot.point)) { this.adopt(entry, snapshot, false); return true; }
          this.setState(entry, "conflict", result.error || "Une autre copie a été enregistrée."); return false;
        }
        if (!response.ok || !result.draft) throw new Error(result.error || "Sauvegarde automatique interrompue.");
        const saved = result.draft as StoredPointDraft;
        entry.revision = saved.revision; entry.basePoint = saved.basePoint; entry.synced = signature(saved.data); entry.retry = 0;
        this.setState(entry, signature(entry.value.data) === entry.synced ? "saved" : "pending", "", saved.updatedAt);
        return true;
      } catch (error) {
        if (current()) { entry.retry++; this.setState(entry, "error", error instanceof Error ? error.message : "Connexion interrompue. Tes saisies restent ici."); }
        return false;
      }
    };
    entry.flight = perform();
    try { return await entry.flight; }
    finally {
      entry.flight = undefined;
      if (current() && entry.state.status === "pending") this.schedule(entry);
      if (current() && entry.state.status === "error" && entry.retry <= 3) this.schedule(entry, Math.min(30_000, 5000 * entry.retry));
    }
  }
  async retry(scope: PointScope, ownerId: string, date: string) {
    const entry = this.entry(scope, ownerId, date);
    if (entry) { entry.retry = 0; return this.flush(entry); }
    return true;
  }
  async flushAll(keepalive = false) {
    await Promise.allSettled([...this.entries.values()].filter((entry) => !entry.publishing && entry.state.status !== "saved" && entry.state.status !== "idle").map((entry) => this.flush(entry, undefined, keepalive)));
    return !this.hasUnsaved();
  }
  async beginPublish(value: PointDraft) {
    this.write(value);
    const entry = this.entry(value.scope, value.ownerId, value.data.meetingDate as string);
    if (!entry) throw new Error("Le brouillon n’est pas disponible.");
    entry.publishing = true; clearTimeout(entry.timer);
    // Publishing requires a draft row even if this copy equals the shared point.
    if (!entry.revision && signature(value.data) === entry.synced) entry.synced = "";
    if (!await this.flush(entry, value) || !entry.revision) {
      entry.publishing = false;
      throw new Error(entry.state.message || "Attends la sauvegarde du brouillon avant d’enregistrer le point.");
    }
    return { expectedPoint: entry.basePoint, draftRevision: entry.revision };
  }
  finishPublish(value: PointDraft, saved?: { point: PublishedPoint; draft?: StoredPointDraft }, conflict = false) {
    const entry = this.entry(value.scope, value.ownerId, value.data.meetingDate as string);
    if (!entry) return;
    entry.publishing = false;
    if (saved?.draft) {
      const wasSubmitted = signature(entry.value.data) === signature(value.data);
      this.adopt(entry, { draft: saved.draft, point: saved.point }, wasSubmitted);
      if (entry.state.status === "pending") this.schedule(entry);
    } else if (conflict) this.setState(entry, "conflict", "Une autre copie a été enregistrée. Tes saisies sont conservées.");
    else if (signature(entry.value.data) !== entry.synced) this.schedule(entry);
  }
  review(scope: PointScope, ownerId: string, date: string) { return this.snapshot(scope, ownerId, date); }
  async resolve(scope: PointScope, ownerId: string, date: string, snapshot: DraftSnapshot, useMine: boolean) {
    const entry = this.entry(scope, ownerId, date);
    if (!entry) throw new Error("Brouillon introuvable.");
    const original = entry.value;
    const remote = snapshot.draft && samePointVersion(snapshot.draft.basePoint, snapshot.point) ? snapshot.draft.data : snapshot.point?.data ?? snapshot.draft?.data;
    if (!useMine && !remote) throw new Error("Aucune copie en ligne disponible.");
    if (!useMine) entry.value = { ...entry.value, data: remote! };
    entry.loaded = true; entry.revision = snapshot.draft?.revision ?? null; entry.basePoint = version(snapshot.point);
    // Even choosing the online copy verifies that it has not changed since review.
    entry.synced = "";
    this.setState(entry, "pending");
    const saved = await this.flush(entry);
    if (!saved) { entry.value = original; this.emit(); throw new Error(entry.state.message || "Impossible de sauvegarder ce choix."); }
    this.emit();
    return entry.value;
  }
}
