export type AppTransport = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
export type LocalDraft = { scope: "market" | "analyst"; ownerId: string; data: Record<string, unknown> };
export type LocalDraftBridge = {
  read: (scope: LocalDraft["scope"], ownerId: string) => LocalDraft | null;
  write: (draft: LocalDraft) => void;
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

export function readLocalDraft(scope: LocalDraft["scope"], ownerId: string) {
  return drafts?.read(scope, ownerId) ?? null;
}

export function writeLocalDraft(draft: LocalDraft) {
  drafts?.write(draft);
}
