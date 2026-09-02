import type { LocalDraft } from "../lib/app-transport";
import type { JiraCsvTicket } from "../lib/jira-csv";
import { newWorkspace, validateWorkspace, type WorkspaceData } from "./workspace-data";
import { isIsoDate, isoWeekParts } from "../lib/iso-week";

function draftPeriod(meetingDate: unknown) {
  if (typeof meetingDate !== "string" || !isIsoDate(meetingDate)) return "";
  const period = isoWeekParts(meetingDate);
  return `${period.year}:${period.week}`;
}

export class WorkspaceStore {
  private data: WorkspaceData;
  private listeners = new Set<() => void>();
  private revision = 0;
  private savedRevision = 0;
  private jiraIndex = new Map<string, Map<string, JiraCsvTicket>>();
  private pendingForms = new Set<string>();

  constructor(data = newWorkspace()) {
    validateWorkspace(data);
    this.data = structuredClone(data);
    this.rebuildIndex();
  }

  read() { return this.data; }
  snapshot() { return structuredClone(this.data); }
  version = () => this.revision;
  isDirty() { return this.revision !== this.savedRevision || this.pendingForms.size > 0; }
  hasPendingForms() { return this.pendingForms.size > 0; }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };

  update(change: (current: WorkspaceData) => WorkspaceData) {
    const previousTickets = this.data.jiraTickets;
    const next = change(this.data);
    if (next === this.data) return;
    this.data = { ...next, updatedAt: new Date().toISOString() };
    if (previousTickets !== next.jiraTickets) this.rebuildIndex();
    this.revision += 1;
    this.notify();
  }

  replace(data: WorkspaceData) {
    validateWorkspace(data);
    this.data = structuredClone(data);
    this.revision += 1;
    this.savedRevision = this.revision;
    this.pendingForms.clear();
    this.rebuildIndex();
    this.notify();
  }

  markSaved(revision: number) { this.savedRevision = revision; this.notify(); }
  markUnsaved() { this.savedRevision = -1; this.notify(); }
  setPendingForm(key: string, pending: boolean) {
    const existed = this.pendingForms.has(key);
    if (pending) this.pendingForms.add(key); else this.pendingForms.delete(key);
    if (existed !== pending) this.notify();
  }

  readDraft = (scope: LocalDraft["scope"], ownerId: string, meetingDate?: string) => {
    const period = meetingDate === undefined ? undefined : draftPeriod(meetingDate);
    const draft = this.data.drafts.findLast((item) => item.scope === scope && item.ownerId === ownerId && (period === undefined || draftPeriod(item.data.meetingDate) === period));
    return draft ? structuredClone(draft) : null;
  };
  writeDraft = (draft: LocalDraft) => {
    const period = draftPeriod(draft.data.meetingDate);
    const matches = (item: LocalDraft) => item.scope === draft.scope && item.ownerId === draft.ownerId && draftPeriod(item.data.meetingDate) === period;
    if (JSON.stringify(this.data.drafts.find(matches)?.data) === JSON.stringify(draft.data)) return;
    this.update((current) => ({ ...current, drafts: [...current.drafts.filter((item) => !matches(item)), structuredClone(draft)] }));
  };

  readPreference = (key: string) => this.data.preferences[key];
  writePreference = (key: string, value: string) => {
    if (this.data.preferences[key] === value) return;
    this.update((current) => ({ ...current, preferences: { ...current.preferences, [key]: value } }));
  };

  jiraForPerson(usercode: string) { return Array.from(this.jiraIndex.get(usercode.trim().toUpperCase())?.values() ?? []); }

  private rebuildIndex() {
    this.jiraIndex.clear();
    for (const ticket of this.data.jiraTickets) {
      const people = new Set([ticket.assigneeUserCode, ...ticket.participants.map((participant) => participant.usercode)].filter(Boolean));
      for (const person of people) {
        const key = person.toUpperCase();
        let tickets = this.jiraIndex.get(key);
        if (!tickets) { tickets = new Map(); this.jiraIndex.set(key, tickets); }
        tickets.set(ticket.key, ticket);
      }
    }
  }

  private notify() { this.listeners.forEach((listener) => listener()); }
}
