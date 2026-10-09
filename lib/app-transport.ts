import { SessionDrafts } from "./session-drafts";
import { HostedPointDrafts } from "./hosted-point-drafts";
import type { PublishedPoint, StoredPointDraft } from "./point-persistence";

export type AppTransport = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
export type LocalDraft = { scope: "market" | "analyst"; ownerId: string; data: Record<string, unknown> };
export type LocalDraftBridge = {
  read: (scope: LocalDraft["scope"], ownerId: string, meetingDate?: string) => LocalDraft | null;
  write: (draft: LocalDraft) => void;
  pending?: (key: string, pending: boolean) => void;
  readPreference?: (key: string) => string | undefined;
  writePreference?: (key: string, value: string) => void;
  openFiles?: () => void;
  saveFile?: (saveAs?: boolean) => Promise<boolean>;
};

let transport: AppTransport | null = null;
let drafts: LocalDraftBridge | null = null;
const sessionDrafts = new SessionDrafts();
export const hostedPointDrafts = new HostedPointDrafts((input, init) => fetch(input, init));

export function configureHostedDrafts(editor: string | null) {
  hostedPointDrafts.configure(isLocalWorkspace() ? null : editor);
}

export function installLocalTransport(next: AppTransport, bridge: LocalDraftBridge) {
  transport = next;
  drafts = bridge;
}

export function isLocalWorkspace() {
  return transport !== null;
}

export function appFetch(input: RequestInfo | URL, init?: RequestInit) {
  return transport ? transport(input, init) : fetch(input, init);
}

export function readLocalDraft(scope: LocalDraft["scope"], ownerId: string, meetingDate?: string) {
  return drafts ? drafts.read(scope, ownerId, meetingDate) : hostedPointDrafts.enabled ? hostedPointDrafts.read(scope, ownerId, meetingDate) : sessionDrafts.read(scope, ownerId, meetingDate);
}

export function writeLocalDraft(draft: LocalDraft) {
  if (drafts) drafts.write(draft);
  else if (hostedPointDrafts.enabled) hostedPointDrafts.write(draft);
  else sessionDrafts.write(draft);
}

export function markPointSaved(draft: LocalDraft, point?: PublishedPoint) {
  sessionDrafts.markSaved(draft);
  if (point && hostedPointDrafts.enabled) hostedPointDrafts.observe(draft.scope, draft.ownerId, point);
}
export function hasUnsavedSessionDrafts() { return hostedPointDrafts.enabled ? hostedPointDrafts.hasUnsaved() : sessionDrafts.hasUnsaved(); }
export function clearSessionDrafts() { sessionDrafts.clear(); hostedPointDrafts.configure(null); }
export function loadPointDraft(scope: LocalDraft["scope"], ownerId: string, date?: string) {
  return hostedPointDrafts.enabled ? hostedPointDrafts.load(scope, ownerId, date) : Promise.resolve(readLocalDraft(scope, ownerId, date));
}
export function preparePointSave(draft: LocalDraft) {
  return hostedPointDrafts.enabled ? hostedPointDrafts.beginPublish(draft) : Promise.resolve({});
}
export function finishPointSave(draft: LocalDraft, saved?: { point: PublishedPoint; draft?: StoredPointDraft }, conflict = false) {
  if (hostedPointDrafts.enabled) hostedPointDrafts.finishPublish(draft, saved, conflict);
}

export function markLocalFormPending(key: string, pending: boolean) {
  drafts?.pending?.(key, pending);
}

export function readLocalPreference(key: string) {
  return drafts?.readPreference?.(key);
}

export function writeLocalPreference(key: string, value: string) {
  drafts?.writePreference?.(key, value);
}

export function openLocalFiles() { drafts?.openFiles?.(); }
export function saveLocalFile(saveAs = false) { return drafts?.saveFile?.(saveAs) ?? Promise.resolve(false); }
