import { accessRequest, normalizePolicy, type AccessPerson, type AuditEvent, type AccessStore } from "../lib/access-control";
import type { AppTransport } from "../lib/app-transport";
import type { WorkspaceStore } from "./workspace-store";
export function guardLocalApi(store: WorkspaceStore, next: AppTransport): AppTransport {
  const storage: AccessStore = {
    policy: async () => normalizePolicy(JSON.parse(store.readPreference("access-policy") || "{}")),
    setPolicy: async (value, expected) => {
      const before = normalizePolicy(JSON.parse(store.readPreference("access-policy") || "{}"));
      if (JSON.stringify(before) !== JSON.stringify(expected)) return false;
      store.writePreference("access-policy",JSON.stringify(value)); return true;
    },
    directory: async () => store.read().users,
    roles: async () => Object.entries(store.read().preferences).filter(([k]) => k.startsWith("access-role:")).map(([,v]) => JSON.parse(v) as AccessPerson),
    setRole: async p => store.writePreference(`access-role:${p.usercode}`, JSON.stringify(p)),
    append: async e => store.writePreference(`activity:${e.id}`, JSON.stringify(e)),
    events: async (before, filter) => Object.entries(store.read().preferences).filter(([k]) => k.startsWith("activity:")).map(([,v]) => JSON.parse(v) as AuditEvent).filter(e => (!before || `${e.at}:${e.id}` < before) && JSON.stringify(e).toLowerCase().includes(filter.toLowerCase())).sort((a,b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id)).slice(0,100),
  };
  return (input, init) => {
    if (init?.signal?.aborted) return Promise.reject(new DOMException("Requête annulée", "AbortError"));
    const request = new Request(input instanceof Request ? input : new URL(String(input), "https://local.market-pulse.invalid"), init);
    return accessRequest(request, storage, () => next(input, init));
  };
}
