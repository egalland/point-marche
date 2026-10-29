export const ROOT_ADMIN = "A0000001";
export type AccessRole = "user" | "admin" | "superadmin" | "sales";
export type AccessView = AccessRole | "reader";
export type AccessPerson = { usercode: string; name: string; role: AccessRole; jobRole?: string; readOnly?: boolean };
export type AuditEvent = { id: string; at: string; usercode: string; device: string; action: string; target: string; status: number; detail: string };
export const roleNames: Record<AccessRole, string> = { user: "Utilisateur", sales: "Vente · lecture seule", admin: "Admin", superadmin: "Super admin" };
export const levelNames = { superadmin: "Super admin", admin: "Admin et Super admin", user: "Tous les utilisateurs" } as const;
export type AccessLevel = keyof typeof levelNames;
export const permissionCatalog = [
  { id: "point.read", group: "Point marché", label: "Consulter les points et leur historique", level: "user" },
  { id: "point.edit", group: "Point marché", label: "Créer, modifier, réinitialiser et organiser les blocs", level: "user" },
  { id: "point.import", group: "Point marché", label: "Importer un point JSON", level: "admin" },
  { id: "point.assets", group: "Point marché", label: "Ajouter des fichiers et pièces jointes", level: "user" },
  { id: "analyst.read", group: "Point analyste", label: "Consulter les points analystes, leurs tickets et l’activité des analystes", level: "admin" },
  { id: "analyst.edit", group: "Point analyste", label: "Créer et modifier le point analyste", level: "admin" },
  { id: "stats.read", group: "Données", label: "Consulter les variations fournisseurs et les PURCHASES", level: "user" },
  { id: "suppliers.read", group: "Données", label: "Consulter les fiches fournisseurs", level: "user" },
  { id: "imports.open", group: "Imports", label: "Ouvrir le Centre d’import", level: "admin" },
  { id: "imports.jira", group: "Imports", label: "Importer et actualiser le registre Jira", level: "admin" },
  { id: "imports.planner", group: "Imports", label: "Importer et actualiser Planner", level: "admin" },
  { id: "imports.purchaseData", group: "Imports", label: "Importer et remplacer les données PURCHASES", level: "admin" },
  { id: "settings.open", group: "Paramètres", label: "Ouvrir les paramètres de l’application", level: "admin" },
  { id: "settings.appearance", group: "Paramètres", label: "Ouvrir les réglages de présentation du point", level: "admin" },
  { id: "markets.manage", group: "Paramètres", label: "Créer et modifier les marchés, tags et seuils", level: "admin" },
  { id: "directory.create", group: "Personnes", label: "Ajouter des personnes dans l’annuaire", level: "admin" },
  { id: "directory.edit", group: "Personnes", label: "Modifier les personnes et leur métier", level: "admin" },
  { id: "directory.delete", group: "Personnes", label: "Retirer une personne de l’annuaire", level: "admin" },
  { id: "exports.open", group: "Diffusion", label: "Ouvrir la page Mail du marché", level: "user" },
  { id: "exports.mail", group: "Diffusion", label: "Copier le mail et préparer le fichier Outlook", level: "user" },
  { id: "exports.html", group: "Diffusion", label: "Télécharger et glisser le point HTML", level: "user" },
  { id: "exports.charts", group: "Diffusion", label: "Exporter les graphiques en PNG et Excel", level: "user" },
  { id: "exports.json", group: "Diffusion", label: "Exporter les points au format JSON", level: "user" },
  { id: "settings.mail", group: "Diffusion", label: "Modifier les destinataires et le texte du mail", level: "admin" },
  { id: "feedback.submit", group: "Bugs et idées", label: "Signaler un bug ou proposer une idée", level: "user" },
  { id: "feedback.read", group: "Bugs et idées", label: "Consulter la boîte de réception et les captures", level: "admin" },
  { id: "feedback.manage", group: "Bugs et idées", label: "Changer le statut des bugs et idées", level: "admin" },
  { id: "feedback.settings", group: "Bugs et idées", label: "Configurer les destinataires de notification", level: "admin" },
  { id: "admin.open", group: "Administration", label: "Ouvrir le panneau Admin", level: "admin" },
  { id: "audit.read", group: "Administration", label: "Consulter le journal complet de l’application", level: "admin" },
] as const;
export type Permission = typeof permissionCatalog[number]["id"];
export type AccessPolicy = Record<Permission, AccessLevel>;
export const defaultPolicy = () => Object.fromEntries(permissionCatalog.map(p => [p.id,p.level])) as AccessPolicy;
export function normalizePolicy(raw: unknown): AccessPolicy {
  const result = defaultPolicy();
  if (raw && typeof raw === "object") for (const p of permissionCatalog) {
    const value = (raw as Record<string, unknown>)[p.id]; if (value === "staff") result[p.id] = "admin"; else if (typeof value === "string" && Object.hasOwn(levelNames, value)) result[p.id] = value as AccessLevel;
  }
  return result;
}
export const validUserCode = (usercode: string) => /^[A-Z]\d{7}$/.test(usercode);
export const normalizeUserCode = (value: unknown) => typeof value === "string" ? value.trim().toUpperCase() : "";
export function resolvePerson(usercode: string, directory: { usercode: string; name: string; role: string; profileInactive?: boolean }[], overrides: {usercode: string; name: string; role: string}[]): AccessPerson {
  const person = directory.find(p => normalizeUserCode(p.usercode) === usercode), override = overrides.find(p => normalizeUserCode(p.usercode) === usercode);
  const legacyJob = override?.role === "analyst" ? "analyste-tarif-referentiel" : override?.role === "manager" ? "manager-tarif" : "";
  if (person?.profileInactive && usercode !== ROOT_ADMIN) return {usercode,name:person.name,role:"user",jobRole:"",readOnly:true};
  const sales = person?.role === "vente" || override?.role === "sales";
  const role: AccessRole = usercode === ROOT_ADMIN ? "superadmin" : sales ? "sales" : override?.role === "superadmin" ? "superadmin" : override?.role === "user" ? "user" : override?.role === "admin" || ["analyst","manager"].includes(override?.role || "") || ["analyste-tarif-referentiel","manager-tarif"].includes(person?.role || "") ? "admin" : "user";
  return { usercode, name: override?.name || person?.name || usercode, role, jobRole: person?.role || legacyJob, ...(role === "sales" ? {readOnly:true} : {}) };
}
export function allowedViews(role: AccessRole): AccessView[] { return role === "superadmin" ? ["superadmin", "admin", "reader"] : role === "admin" ? ["admin", "reader"] : [role]; }
export function effectivePerson(person: AccessPerson, view?: string): AccessPerson | null {
  if (!view) return person;
  if (!allowedViews(person.role).includes(view as AccessView)) return null;
  return view === "reader" ? { ...person, role: "user", jobRole: "", readOnly: true } : { ...person, role: view as AccessRole, ...(view !== person.role ? {jobRole:""} : {}) };
}
const readerPermissions = new Set<Permission>(["point.read", "stats.read", "suppliers.read", "exports.open", "exports.mail", "exports.html", "exports.json", "exports.charts", "feedback.submit"]);
export function hasPermission(person: AccessPerson, permission: Permission, policy: AccessPolicy = defaultPolicy()) {
  if ((person.readOnly || person.role === "sales") && (!readerPermissions.has(permission) || (person.role === "sales" && permission === "feedback.submit"))) return false;
  if (person.role === "superadmin") return true;
  const rank = person.role === "admin" ? 2 : 0;
  return rank >= ({ user:0, admin:2, superadmin:3 }[policy[permission] ?? defaultPolicy()[permission]]);
}
export function canView(person: AccessPerson | AccessRole, view: string, policy = defaultPolicy()) {
  const p = typeof person === "string" ? {usercode:"",name:"",role:person} : person;
  if (view === "superadmin") return p.role === "superadmin";
  const key: Permission = ({read:"point.read",edit:"point.edit",analyst:"analyst.read","analyst-activity":"analyst.read",stats:"stats.read",purchaseData:"stats.read",suppliers:"suppliers.read",imports:"imports.open",mail:"exports.open",settings:"settings.open",admin:"admin.open"} as Record<string,Permission>)[view] || "point.read";
  return hasPermission(p,key,policy);
}
export function requestPermission(path: string, method: string, scope?: unknown): Permission | "superadmin" | null {
  const write = !["GET", "HEAD"].includes(method);
  if (path === "/api/admin/roles" || path === "/api/admin/policy") return "superadmin";
  if (path === "/api/admin/audit") return "audit.read";
  if (/^\/api\/analyst-/.test(path) || (path === "/api/point-drafts" && scope === "analyst")) return write ? "analyst.edit" : "analyst.read";
  if (path === "/api/point-drafts" || path === "/api/points") return write ? "point.edit" : "point.read";
  if (path === "/api/point-assets") return write ? "point.assets" : "point.read";
  if (path === "/api/directory-roles" && write) return "directory.create";
  if (path === "/api/global-users" && write) return method === "POST" ? "directory.create" : method === "DELETE" ? "directory.delete" : "directory.edit";
  if (path === "/api/markets" && write) return "markets.manage";
  if (path === "/api/feedback-settings" && write) return "feedback.settings";
  if (path === "/api/feedback") return method === "POST" ? "feedback.submit" : write ? "feedback.manage" : "feedback.read";
  if (write && (path === "/api/jira-imports" || path === "/api/jira-week")) return "imports.jira";
  if (write && path === "/api/planner-tasks") return "imports.planner";
  if (write && path === "/api/purchaseData") return "imports.purchaseData";
  return null;
}
export function canRequest(person: AccessPerson | AccessRole, path: string, method: string, scope?: unknown, policy = defaultPolicy()) {
  const p = typeof person === "string" ? {usercode:"",name:"",role:person} : person;
  if (p.role === "sales" && !["GET", "HEAD"].includes(method) && path !== "/api/activity") return false;
  if (path.startsWith("/api/admin") && !["/api/admin/policy","/api/admin/roles","/api/admin/audit"].includes(path)) return false;
  const permission = requestPermission(path,method,scope);
  return permission === "superadmin" ? p.role === "superadmin" : permission ? hasPermission(p,permission,policy) : true;
}
export interface AccessStore {
  policy?(): Promise<AccessPolicy>;
  setPolicy?(policy: AccessPolicy, expected: AccessPolicy): Promise<boolean>;
  directory(): Promise<{ usercode: string; name: string; role: string }[]>;
  roles(): Promise<AccessPerson[]>;
  setRole(person: AccessPerson): Promise<void>;
  append(event: AuditEvent): Promise<void>;
  events(before: string, filter: string): Promise<AuditEvent[]>;
}
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const text = (value: unknown, length = 200) => typeof value === "string" ? value.slice(0, length) : "";
/** Used at both the Worker boundary and the portable API boundary. Identity is declared, not verified. */
export async function accessRequest(request: Request, store: AccessStore, next: () => Promise<Response>): Promise<Response> {
  const url = new URL(request.url), path = url.pathname, method = request.method;
  const usercode = normalizeUserCode(request.headers.get("X-Market-USERCODE"));
  if (!validUserCode(usercode)) return json({ error: "Renseigne ton USERCODE pour ouvrir l’application." }, 401);
  let person: AccessPerson;
  let policy: AccessPolicy;
  try { person = resolvePerson(usercode, await store.directory(), await store.roles()); policy = await store.policy?.() ?? defaultPolicy(); }
  catch { return json({ error: "Les droits sont indisponibles. Réessaie dans un instant." }, 503); }
  let body: Record<string, unknown> = {};
  if (request.body !== null && !["GET", "HEAD"].includes(method) && (request.headers.get("Content-Type")?.includes("application/json") || path === "/api/point-drafts")) {
    try { body = await request.clone().json(); if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Objet JSON attendu." }, 400); } catch { return json({ error: "Données JSON invalides." }, 400); }
  }
  const event: AuditEvent = { id: crypto.randomUUID(), at: new Date().toISOString(), usercode, device: text(request.headers.get("X-Market-Device"), 80), action: method, target: path + url.search, status: 200, detail: JSON.stringify({ view: request.headers.get("X-Market-View") || person.role }) };
  // Journal entries contain action context, not complete imports, screenshots or raw typed text.
  if (Object.keys(body).length) event.detail = JSON.stringify({ view: request.headers.get("X-Market-View") || person.role, fields: Object.keys(body).slice(0, 30), id: text(body.id), ownerId: text(body.ownerId), scope: text(body.scope) });
  const record = async (response: Response) => {
    event.status = response.status;
    try { await store.append(event); }
    catch { return json({ error: "Journal d’activité indisponible. L’action a pu être exécutée ; vérifie son résultat avant de réessayer.", actionStatus: response.status }, 503); }
    return response;
  };
  if (path === "/api/access/session") return json({ person, policy });
  const effective = effectivePerson(person, request.headers.get("X-Market-View") || undefined);
  if (!effective || !canRequest(effective, path, method, body.scope ?? url.searchParams.get("scope"), policy)) return record(json({ error: "Ton profil ne permet pas cette action." }, 403));
  if (path === "/api/admin/policy") {
    if (method === "GET") return json({ policy });
    if (method !== "PUT") return json({ error: "Méthode non autorisée." }, 405);
    if (!body.policy || typeof body.policy !== "object" || permissionCatalog.some(p => !Object.hasOwn(levelNames, (body.policy as AccessPolicy)[p.id]))) return json({ error: "Règles d’accès incomplètes ou invalides." }, 400);
    const after = normalizePolicy(body.policy), expected = normalizePolicy(body.expected);
    if (!body.expected || !store.setPolicy || !await store.setPolicy(after, expected)) return record(json({ error: "Les droits ont changé dans une autre session. Recharge les règles avant de réessayer." }, 409));
    event.action = "Règles d’accès modifiées"; event.detail = JSON.stringify({ before:policy, after });
    return record(json({ policy:after }));
  }
  if (path === "/api/admin/roles") {
    if (method === "GET") {
      const directory = await store.directory(), roles = await store.roles();
      const usercodes = new Set([ROOT_ADMIN, ...directory.map(p => normalizeUserCode(p.usercode)), ...roles.map(p => p.usercode)]);
      return json({ people: [...usercodes].filter(validUserCode).map(id => resolvePerson(id, directory, roles)) });
    }
    if (method !== "PUT") return json({ error: "Méthode non autorisée." }, 405);
    const target = normalizeUserCode(body.usercode), role = body.role as AccessRole;
    if (!validUserCode(target) || !Object.hasOwn(roleNames, role) || !text(body.name).trim()) return json({ error: "Nom, USERCODE et rôle valides requis." }, 400);
    if (target === ROOT_ADMIN && role !== "superadmin") return record(json({ error: "Le rôle du Super admin initial est conservé." }, 409));
    const before = resolvePerson(target, await store.directory(), await store.roles());
    if (body.expectedRole !== undefined && body.expectedRole !== before.role) return record(json({ error: "Les droits de cette personne ont changé. Recharge l’annuaire." }, 409));
    const after = { usercode: target, name: text(body.name, 100).trim(), role };
    event.action = "Rôle modifié"; event.target = target; event.detail = JSON.stringify({ before, after });
    await store.setRole(after);
    return record(json({ person: resolvePerson(target, await store.directory(), await store.roles()) }));
  }
  if (path === "/api/admin/audit") {
    if (method !== "GET") return json({ error: "Le journal est en lecture seule." }, 405);
    return json({ events: await store.events(text(url.searchParams.get("before"), 80), text(url.searchParams.get("q"), 100)) });
  }
  if (path === "/api/activity") {
    if (method !== "POST") return json({ error: "Méthode non autorisée." }, 405);
    event.action = text(body.action, 60) || "Interaction"; event.target = text(body.target, 300); event.detail = text(body.detail, 1000);
    return record(json({ ok: true }));
  }
  try { return await record(await next()); }
  catch (error) { event.detail = text(error instanceof Error ? error.message : "Erreur interne", 1000); return record(json({ error: "L’action a échoué." }, 500)); }
}
