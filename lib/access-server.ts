import {directoryUsersAt} from "./directory-store";
import { accessRequest, normalizePolicy, type AccessPerson, type AuditEvent, type AccessStore } from "./access-control";
import type { RuntimeEnv } from "./runtime-env";
export async function guardedServerRequest(request: Request, env: RuntimeEnv, next: () => Promise<Response>) {
  const db = env.DB;
  if (!db) return Response.json({ error: "Gestion des accès indisponible." }, { status: 503 });
  await db.exec("CREATE TABLE IF NOT EXISTS app_access_roles (usercode TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL); CREATE TABLE IF NOT EXISTS app_activity (id TEXT PRIMARY KEY, at TEXT NOT NULL, usercode TEXT NOT NULL, device TEXT NOT NULL, action TEXT NOT NULL, target TEXT NOT NULL, status INTEGER NOT NULL, detail TEXT NOT NULL); CREATE INDEX IF NOT EXISTS app_activity_at ON app_activity(at, id); CREATE TABLE IF NOT EXISTS app_access_policy (id INTEGER PRIMARY KEY, value TEXT NOT NULL);");
  const store: AccessStore = {
    policy: async () => normalizePolicy(JSON.parse((await db.prepare("SELECT value FROM app_access_policy WHERE id = 1").first<{value:string}>())?.value || "{}")),
    setPolicy: async (value, expected) => {
      await db.prepare("INSERT OR IGNORE INTO app_access_policy (id,value) VALUES (1,?)").bind(JSON.stringify(normalizePolicy(null))).run();
      const stored = await db.prepare("SELECT value FROM app_access_policy WHERE id = 1").first<{value:string}>();
      if (!stored || JSON.stringify(normalizePolicy(JSON.parse(stored.value))) !== JSON.stringify(expected)) return false;
      const result = await db.prepare("UPDATE app_access_policy SET value = ? WHERE id = 1 AND value = ?").bind(JSON.stringify(value), stored.value).run<{meta?:{changes?:number};changes?:number}>();
      return (result.meta?.changes ?? result.changes) === 1;
    },
    directory: async () => directoryUsersAt(),
    roles: async () => (await db.prepare("SELECT usercode, name, role FROM app_access_roles").all<AccessPerson>()).results,
    setRole: async p => { await db.prepare("INSERT INTO app_access_roles (usercode,name,role) VALUES (?,?,?) ON CONFLICT(usercode) DO UPDATE SET name=excluded.name,role=excluded.role").bind(p.usercode,p.name,p.role).run(); },
    append: async e => { await db.prepare("INSERT INTO app_activity (id,at,usercode,device,action,target,status,detail) VALUES (?,?,?,?,?,?,?,?)").bind(e.id,e.at,e.usercode,e.device,e.action,e.target,e.status,e.detail).run(); },
    events: async (before, filter) => {
      const q = `%${filter}%`;
      return (await db.prepare("SELECT * FROM app_activity WHERE (? = '' OR at || ':' || id < ?) AND (usercode LIKE ? OR action LIKE ? OR target LIKE ? OR detail LIKE ?) ORDER BY at DESC, id DESC LIMIT 100").bind(before,before,q,q,q,q).all<AuditEvent>()).results;
    },
  };
  return accessRequest(request, store, next);
}
