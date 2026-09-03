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
  return drafts?.read(scope, ownerId, meetingDate) ?? null;
}

export function writeLocalDraft(draft: LocalDraft) {
  drafts?.write(draft);
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
