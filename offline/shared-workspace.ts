import { validateWorkspace, type WorkspaceData } from './workspace-data';
import type { LocalFileHandle } from './file-session';
import type { WorkspaceStore } from './workspace-store';

export type SharedDirectory = { name: string; values(): AsyncIterable<{ name: string; kind: string; getFile(): Promise<File> }>; getFileHandle(name: string, options: { create: boolean }): Promise<LocalFileHandle> };
type Operation = { key: string; parents: string[]; value: unknown; deleted: boolean };
export type SharedEntry = { format: 'market-pulse-shared'; version: 1; id: string; author: string; at: string; operations: Operation[] };
export type SharedChoice = { id: string; author: string; at: string; value: unknown; deleted: boolean };
export type SharedConflict = { key: string; label: string; choices: SharedChoice[] };
export type SharedState = { status: 'ready' | 'syncing' | 'waiting' | 'error' | 'conflict'; message: string; conflicts: SharedConflict[]; lastSync: string };
type PartMap = Map<string, unknown>;
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const prefLocal = (key: string) => /(?:analyst-id|market-id|compact-menu|appearance|theme|view)$/.test(key);
const key = (kind: string, id: string) => `${kind}/${encodeURIComponent(id)}`;
const filePattern = /^point-sync-[a-f0-9-]{36}\.json$/;

/** Points and drafts are conflict units; imported registries are atomic batches. */
export function workspaceParts(data: WorkspaceData): PartMap {
  const result: PartMap = new Map();
  result.set('meta', { id: data.id, name: data.name, createdAt: data.createdAt, ...(data.source ? { source: data.source } : {}) });
  result.set('jira', { jiraTickets: data.jiraTickets, jiraImports: data.jiraImports, jiraUpdatedAt: data.jiraUpdatedAt });
  result.set('planner', { plannerTasks: data.plannerTasks, plannerUpdatedAt: data.plannerUpdatedAt });
  for (const kind of ['markets', 'users', 'points', 'analystPoints', 'drafts'] as const) {
    for (const row of data[kind]) {
      const item = row as unknown as Record<string, unknown>;
      const id = kind === 'drafts' ? `${item.scope}:${item.ownerId}:${String((item.data as Record<string, unknown>).meetingDate).slice(0, 10)}`
        : kind === 'points' || kind === 'analystPoints' ? `${item.marketId ?? item.analystId}:${item.year}:${item.week}` : String(item.id);
      result.set(key(kind, id), row);
    }
  }
  for (const [name, value] of Object.entries(data.preferences)) if (!prefLocal(name)) result.set(key('preferences', name), value);
  return result;
}
function hydrate(parts: PartMap, local: WorkspaceData, at: string): WorkspaceData {
  const result = { ...(parts.get('meta') as object), ...(parts.get('jira') as object), ...(parts.get('planner') as object), updatedAt: at,
    markets: [], users: [], points: [], analystPoints: [], drafts: [], preferences: Object.fromEntries(Object.entries(local.preferences).filter(([name]) => prefLocal(name))) } as unknown as WorkspaceData;
  for (const [name, value] of parts) {
    const slash = name.indexOf('/'); if (slash < 0) continue;
    const kind = name.slice(0, slash);
    if (kind === 'preferences') result.preferences[decodeURIComponent(name.slice(slash + 1))] = value as string;
    else if (['markets', 'users', 'points', 'analystPoints', 'drafts'].includes(kind)) (result[kind as 'markets'] as unknown[]).push(value);
  }
  result.drafts.sort((a, b) => String(a.data.meetingDate).localeCompare(String(b.data.meetingDate)));
  validateWorkspace(result); return result;
}
const label = (name: string) => {
  if (name === 'preferences/purchaseData-source') return 'Import PURCHASES';
  const [kind, id] = name.split('/');
  return `${({ meta: 'Classeur', jira: 'Import Jira', planner: 'Import Planner', points: 'Point marché', analystPoints: 'Point analyste', drafts: 'Brouillon', markets: 'Marché', users: 'Personne', preferences: 'Paramètre' } as Record<string, string>)[kind] ?? kind}${id ? ` · ${decodeURIComponent(id)}` : ''}`;
};
async function digest(value: string) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}
export async function encodeSharedEntry(entry: SharedEntry) {
  return JSON.stringify({ entry, checksum: await digest(JSON.stringify(entry)) });
}
export async function decodeSharedEntry(text: string): Promise<SharedEntry> {
  if (text.length > 200_000_000) throw Error('Journal partagé trop volumineux.');
  const payload = JSON.parse(text, (name, value) => { if (['__proto__', 'prototype', 'constructor'].includes(name)) throw Error('Clé invalide dans le journal.'); return value; });
  const entry = payload?.entry as SharedEntry;
  if (entry?.format !== 'market-pulse-shared' || entry.version !== 1 || !/^[a-f0-9-]{36}$/.test(entry.id) || typeof entry.author !== 'string' || typeof entry.at !== 'string' || !Array.isArray(entry.operations) || entry.operations.length > 100000 || payload.checksum !== await digest(JSON.stringify(entry))) throw Error('Journal incomplet ou contrôle d’intégrité incorrect. Nouvelle tentative au prochain cycle.');
  for (const op of entry.operations) if (!op || typeof op.key !== 'string' || !/^(meta|jira|planner|(?:markets|users|points|analystPoints|drafts|preferences)\/.+)$/.test(op.key) || !Array.isArray(op.parents) || !op.parents.every(p => typeof p === 'string') || typeof op.deleted !== 'boolean') throw Error('Modification partagée invalide.');
  if (new Set(entry.operations.map(op => op.key)).size !== entry.operations.length) throw Error('Modification partagée en double.');
  return entry;
}

/** Immutable files plus causal heads retain concurrent versions without a shared overwrite. */
export function materializeShared(entries: SharedEntry[], preferred = new Map<string, unknown>()) {
  const versions = new Map<string, SharedChoice & { key: string; parents: string[] }>();
  for (const entry of entries) entry.operations.forEach((op, index) => versions.set(`${entry.id}:${index}`, { ...op, id: `${entry.id}:${index}`, author: entry.author, at: entry.at }));
  const superseded = new Set<string>();
  for (const op of versions.values()) for (const parent of op.parents) {
    if (!versions.has(parent) || versions.get(parent)!.key !== op.key || parent === op.id) throw Error('Historique partagé incomplet. Attends la disponibilité du dossier réseau.');
    superseded.add(parent);
  }
  const heads = new Map<string, SharedChoice[]>();
  for (const op of versions.values()) if (!superseded.has(op.id)) heads.set(op.key, [...(heads.get(op.key) ?? []), op]);
  const parts: PartMap = new Map(), conflicts: SharedConflict[] = [];
  for (const [name, choices] of heads) {
    choices.sort((a, b) => a.id.localeCompare(b.id));
    const distinct = choices.filter((item, index) => choices.findIndex(other => other.deleted === item.deleted && equal(other.value, item.value)) === index);
    const selected = choices.find(item => !item.deleted && equal(item.value, preferred.get(name))) ?? choices[0];
    if (!selected.deleted) parts.set(name, selected.value);
    if (distinct.length > 1) conflicts.push({ key: name, label: label(name), choices });
  }
  return { parts, heads, conflicts };
}

export class SharedWorkspaceSession {
  private entries = new Map<string, { entry: SharedEntry; size: number; modified: number }>();
  private base: PartMap = new Map();
  private heads = new Map<string, SharedChoice[]>();
  private knownVersion = -1;
  private knownEntries = -1;
  private flight: Promise<boolean> | null = null;
  private stopped = false;
  private initialized = false;
  private resolutions = new Map<string, { choice: SharedChoice; parents: string[] }>();
  state: SharedState = { status: 'syncing', message: 'Connexion au dossier…', conflicts: [], lastSync: '' };
  constructor(private directory: SharedDirectory, private store: WorkspaceStore, private author: string, private onState: (state: SharedState) => void, private onRemote: () => void, private editing = () => false) {}
  stop() { this.stopped = true; }
  resolve(name: string, choiceId: string) {
    const choice = this.state.conflicts.find(item => item.key === name)?.choices.find(item => item.id === choiceId);
    if (choice) this.resolutions.set(name, { choice, parents: this.state.conflicts.find(item => item.key === name)!.choices.map(item => item.id) });
    return this.sync();
  }
  sync(): Promise<boolean> {
    if (this.stopped) return Promise.resolve(false);
    if (this.flight) return this.flight;
    this.flight = this.cycle().catch(error => { this.report('error', error instanceof Error ? error.message : 'Dossier réseau indisponible. Les saisies restent locales.'); return false; }).finally(() => { this.flight = null; });
    return this.flight;
  }
  private report(status: SharedState['status'], message: string, conflicts = this.state.conflicts) {
    if (this.stopped) return;
    this.state = { ...this.state, status, message, conflicts }; this.onState(this.state);
  }
  private async scan() {
    const present = new Set<string>(); let changed = false;
    for await (const handle of this.directory.values()) {
      if (handle.kind !== 'file' || !filePattern.test(handle.name)) continue;
      present.add(handle.name);
      if (present.size > 10000) throw Error('Le journal atteint 10 000 fichiers. Exporte une copie et crée un nouveau dossier partagé.');
      const cached = this.entries.get(handle.name);
      const file = await handle.getFile();
      if (cached) { if (cached.size !== file.size || cached.modified !== file.lastModified) throw Error('Un fichier du journal a été remplacé. Synchronisation suspendue ; conserve une copie locale.'); continue; }
      const entry = await decodeSharedEntry(await file.text());
      if (handle.name !== `point-sync-${entry.id}.json`) throw Error('Nom de fichier partagé incohérent.');
      this.entries.set(handle.name, { entry, size: file.size, modified: file.lastModified }); changed = true;
    }
    for (const name of this.entries.keys()) if (!present.has(name)) throw Error('Un fichier du journal manque. Vérifie la connexion réseau ; aucune saisie locale n’est supprimée.');
    return changed;
  }
  private async append(operations: Operation[]) {
    if (!operations.length || this.stopped) return;
    const entry: SharedEntry = { format: 'market-pulse-shared', version: 1, id: crypto.randomUUID(), author: this.author, at: new Date().toISOString(), operations };
    const handle = await this.directory.getFileHandle(`point-sync-${entry.id}.json`, { create: true });
    const stream = await handle.createWritable();
    try { await stream.write(await encodeSharedEntry(entry)); await stream.close(); }
    catch (error) { await stream.abort?.().catch(() => undefined); throw error; }
    const written = await handle.getFile();
    const verified = await decodeSharedEntry(await written.text());
    if (!equal(verified, entry)) throw Error('Écriture réseau non confirmée. Les saisies restent locales.');
    this.entries.set(`point-sync-${entry.id}.json`, { entry, size: written.size, modified: written.lastModified });
  }
  private async cycle() {
    const changed = await this.scan(); if (this.stopped) return false;
    if (this.store.hasPendingForms() || this.editing()) { this.report('waiting', 'Saisie en cours : la mise à jour reprendra à la sortie du champ.'); return false; }
    if (this.initialized && !changed && this.knownEntries === this.entries.size && this.knownVersion === this.store.version() && !this.resolutions.size) {
      this.state = { ...this.state, lastSync: new Date().toISOString() };
      this.report(this.state.conflicts.length ? 'conflict' : 'ready', this.state.conflicts.length ? 'Versions concurrentes à départager.' : 'Dossier partagé à jour.'); return !this.state.conflicts.length;
    }
    this.report('syncing', 'Synchronisation du dossier…');
    const revision = this.store.version(), local = this.store.snapshot(), current = workspaceParts(local);
    // Never append behind an incomplete causal history (e.g. delayed network files).
    if (this.entries.size) materializeShared([...this.entries.values()].map(item => item.entry));
    let submitted: Operation[] = [];
    if (!this.initialized && !this.entries.size) { submitted = [...current].map(([key, value]) => ({ key, value, deleted: false, parents: [] })); await this.append(submitted); }
    /* Initial joins use the shared data; subsequent cycles publish only local changes. */
    else if (this.initialized) {
      const operations: Operation[] = [];
      for (const name of new Set([...this.base.keys(), ...current.keys()])) if (!equal(this.base.get(name), current.get(name))) operations.push({ key: name, value: current.get(name) ?? null, deleted: !current.has(name), parents: (this.heads.get(name) ?? []).map(item => item.id) });
      // A resolution acknowledges only the competing versions shown when chosen.
      const resolved = [...this.resolutions];
      for (const [name, { choice, parents }] of resolved) {
        if (operations.some(op => op.key === name)) throw Error('Une saisie locale a changé ce conflit. Termine la saisie avant de choisir une version.');
        operations.push({ key: name, value: choice.value, deleted: choice.deleted, parents });
      }
      submitted = operations;
      await this.append(operations);
      for (const [name] of resolved) this.resolutions.delete(name);
    }
    if (this.stopped) return false;
    const effective = materializeShared([...this.entries.values()].map(item => item.entry), current);
    const merged = hydrate(effective.parts, local, new Date().toISOString());
    // Do not replace data typed while network IO was pending. Reconcile next cycle.
    if (this.store.version() !== revision || this.store.hasPendingForms() || this.editing()) {
      for (const op of submitted) {
        if (op.deleted) this.base.delete(op.key); else this.base.set(op.key, op.value);
        this.heads.set(op.key, (effective.heads.get(op.key) ?? []).filter(item => item.deleted === op.deleted && equal(item.value, op.value)));
      }
      if (submitted.length) this.initialized = true;
      this.report('waiting', 'Nouvelles saisies conservées ; rapprochement au prochain cycle.'); return false;
    }
    const differs = !equal([...current].sort(), [...effective.parts].sort());
    this.base = effective.parts; this.heads = effective.heads; this.initialized = true;
    if (differs) {
      // Receiving audit-only entries must not remount the app and generate another activity cycle.
      const visible = (parts: PartMap) => [...parts].filter(([name]) => !(name.startsWith("preferences/") && decodeURIComponent(name.slice("preferences/".length)).startsWith("activity:"))).sort();
      const refresh = !equal(visible(current), visible(effective.parts));
      this.store.replace(merged); if (refresh) this.onRemote();
    } else this.store.markSaved(revision);
    this.knownEntries = this.entries.size; this.knownVersion = this.store.version(); this.state = { ...this.state, lastSync: new Date().toISOString() };
    this.report(effective.conflicts.length ? 'conflict' : 'ready', effective.conflicts.length ? 'Versions concurrentes conservées. Choisis la version à utiliser.' : 'Dossier partagé à jour.', effective.conflicts);
    return !effective.conflicts.length;
  }
}
