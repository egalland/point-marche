"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode, type FormEvent } from "react";
import { appFetch, configureHostedDrafts, hasUnsavedSessionDrafts } from "@/lib/app-transport";
import { setAccessIdentity, setAccessView, setClientPermissions } from "@/lib/access-client";
import { canView, permissionCatalog, normalizeUserCode, roleNames, ROOT_ADMIN, validUserCode, allowedViews, effectivePerson, hasPermission, defaultPolicy, type AccessPerson, type AccessRole, type AccessView, type AccessPolicy, type Permission, type AuditEvent } from "@/lib/access-control";
type AccessContextValue = { person: AccessPerson; effective: AccessPerson; policy: AccessPolicy; can: (permission: Permission) => boolean; viewMode: AccessView; setViewMode: (mode: AccessView) => void; changeUser: () => void };
const anonymous: AccessPerson = { usercode:"", name:"", role:"user" };
const AccessContext = createContext<AccessContextValue>({ person:anonymous, effective:anonymous, policy:defaultPolicy(), can:permission=>hasPermission(anonymous,permission), viewMode:"user", setViewMode:()=>{}, changeUser:()=>{} });
export const useAccess = () => useContext(AccessContext);
export function AccessViewSelector() {
  const {person,viewMode,setViewMode} = useAccess();
  if (person.role === "user") return null;
  return <label className="access-view-select"><span>Vue affichée</span><select aria-label="Vue affichée" value={viewMode} onChange={e=>setViewMode(e.target.value as AccessView)}>{allowedViews(person.role).map(v=><option key={v} value={v}>{v === "reader" ? "Lecteur" : v === "superadmin" ? "Super admin" : "Admin"}</option>)}</select>{viewMode!==person.role && <small>Vue restreinte · rôle réel : {roleNames[person.role]}</small>}</label>;
}
export async function logActivity(action: string, target: string, detail = "") {
  const response = await appFetch("/api/activity", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, target, detail }), keepalive: true });
  if (!response.ok) throw new Error("L’enregistrement de l’activité est interrompu.");
}
export function AccessGate({ children }: { children: ReactNode }) {
  const [person, setPerson] = useState<AccessPerson | null>(null), [usercode, setUserCode] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  const [policy,setPolicy] = useState<AccessPolicy>(defaultPolicy);
  const [viewMode,setMode] = useState<AccessView>("user");
  const connect = useCallback(async (value: string) => {
    const normalized = normalizeUserCode(value);
    if (!validUserCode(normalized)) { setError("Le USERCODE doit contenir une lettre et 7 chiffres."); return; }
    setBusy(true); setError(""); setAccessIdentity(normalized); setAccessView("");
    try {
      const response = await appFetch("/api/access/session", { cache: "no-store" }), payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      await logActivity("Identification", normalized);
      let restoredView: AccessView = payload.person.role;
      try { const savedView = sessionStorage.getItem(`market-pulse:view:${normalized}`) as AccessView; if (allowedViews(payload.person.role).includes(savedView)) restoredView = savedView; } catch {}
      setPerson(payload.person); setPolicy(payload.policy); setMode(restoredView); setAccessView(restoredView); try { localStorage.setItem("market-pulse:usercode", normalized); } catch {}
    } catch (e) { setAccessIdentity(""); setError(e instanceof Error ? e.message : "Identification indisponible."); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { let value = ""; try { value = localStorage.getItem("market-pulse:usercode") || ""; } catch {} setUserCode(value); void (value ? connect(value) : Promise.resolve()).finally(() => setLoading(false)); }, [connect]);
  useEffect(() => {
    if (!person) return;
    const check = async () => {
      try { const response = await appFetch("/api/access/session", { cache: "no-store" }); if (!response.ok) throw Error("Droits indisponibles"); const payload = await response.json(); setPerson(current => JSON.stringify(current) === JSON.stringify(payload.person) ? current : payload.person); setPolicy(payload.policy); setMode(current => { const next = allowedViews(payload.person.role).includes(current) ? current : payload.person.role; setAccessView(next); return next; }); setError(""); }
      catch { setError("Vérification des droits momentanément indisponible. Tes saisies restent dans cette page."); }
    };
    const timer = window.setInterval(() => { void check(); }, 30000);
    window.addEventListener("focus", check); window.addEventListener("access-updated",check); return () => { clearInterval(timer); window.removeEventListener("focus", check); window.removeEventListener("access-updated",check); };
  }, [person?.usercode]);
  const changeUser = () => {
    if (hasUnsavedSessionDrafts()) { setError("Attends la synchronisation des modifications avant de changer d’utilisateur."); return; }
    void logActivity("Changement d’utilisateur", person?.usercode || "").finally(() => { configureHostedDrafts(null); setPerson(null); setAccessIdentity(""); setAccessView(""); try { localStorage.removeItem("market-pulse:usercode"); } catch {} });
  };
  if (loading) return <main className="access-login"><p>Vérification du profil…</p></main>;
  if (!person) return <main className="access-login"><form className="surface" onSubmit={e => { e.preventDefault(); void connect(usercode); }}><span>Market Plus</span><h1>Bienvenue dans le Point marché</h1><p>Renseigne ton USERCODE pour retrouver les rubriques de ton profil.</p><label className="field"><span>USERCODE</span><input autoFocus autoComplete="username" value={usercode} maxLength={8} placeholder="A1234567" onChange={e => setUserCode(e.target.value.toUpperCase())} required pattern="[A-Za-z][0-9]{7}"/></label><button className="primary-button" disabled={busy}>{busy ? "Ouverture…" : "Ouvrir mon espace"}</button>{error && <p role="alert">{error}</p>}<small>Identification déclarative sans mot de passe. Les actions sont journalisées. Le poste est identifié par un code de navigateur.</small></form></main>;
  const effective = effectivePerson(person,viewMode) || person;
  setClientPermissions(Object.fromEntries(permissionCatalog.map(p=>[p.id,hasPermission(effective,p.id,policy)])));
  const setViewMode = (mode: AccessView) => {
    if (!allowedViews(person.role).includes(mode)) return;
    if (hasUnsavedSessionDrafts()) { setError("Attends la synchronisation des modifications avant de changer de vue."); return; }
    void logActivity("Changement de vue",mode).catch(()=>{}); setAccessView(mode); setMode(mode); try { sessionStorage.setItem(`market-pulse:view:${person.usercode}`,mode); } catch {} setError("");
  };
  return <AccessContext.Provider value={{ person, effective, policy, can:permission=>hasPermission(effective,permission,policy), viewMode, setViewMode, changeUser }}><ActivityCapture/>{error && <p className="access-warning" role="alert">{error}</p>}{children}</AccessContext.Provider>;
}
function ActivityCapture() {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const record = (action: string, target: string, detail = "") => { void logActivity(action, target, detail).then(() => setFailed(false)).catch(() => setFailed(true)); };
    const click = (e: MouseEvent) => { const el = (e.target as HTMLElement)?.closest?.("button,a,summary"); if (el) record("Interaction", (el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || el.tagName).trim().slice(0,200), window.location.search); };
    const change = (e: Event) => { const el = e.target as HTMLInputElement; if (!el?.matches?.("input,select,textarea")) return; record("Champ modifié", (el.closest("label")?.querySelector("span")?.textContent || el.getAttribute("aria-label") || el.name || el.type || el.tagName).slice(0,200), window.location.search); };
    const error = (e: ErrorEvent) => record("Erreur JavaScript", e.message, `${e.filename}:${e.lineno}`);
    const rejection = (e: PromiseRejectionEvent) => record("Promesse rejetée", String(e.reason?.message || e.reason).slice(0,300));
    const context = (e: MouseEvent) => record("Menu contextuel", (e.target as HTMLElement)?.getAttribute?.("aria-label") || "Bloc du point");
    document.addEventListener("click", click, true); document.addEventListener("change", change, true); document.addEventListener("contextmenu", context, true); window.addEventListener("error", error); window.addEventListener("unhandledrejection", rejection);
    return () => { document.removeEventListener("click", click, true); document.removeEventListener("change", change, true); document.removeEventListener("contextmenu", context, true); window.removeEventListener("error", error); window.removeEventListener("unhandledrejection", rejection); };
  }, []);
  return failed ? <p className="access-warning" role="alert">Journal d’activité indisponible : certaines interactions ne sont pas enregistrées.</p> : null;
}
export { canView };
