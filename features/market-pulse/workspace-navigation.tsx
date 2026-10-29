"use client";
import { useAccess, canView, AccessViewSelector } from "./access-panel";
import { roleNames } from "@/lib/access-control";

import { useEffect, useState } from "react";
import { APP_VERSION } from "@/lib/app-version";
import { isLocalWorkspace, openLocalFiles } from "@/lib/app-transport";
import { AppDialog } from "@/components/app-dialog";
import { AppIcon } from "@/components/app-icon";

export type WorkspaceView = "read" | "edit" | "analyst" | "analyst-activity" | "stats" | "purchaseData" | "suppliers" | "imports" | "mail" | "settings" | "admin" | "superadmin";
export const workspaceTitles: Record<WorkspaceView, string> = {
  read: "Point marché", edit: "Point marché", analyst: "Analystes", "analyst-activity": "Analystes", stats: "Variations fournisseurs", purchaseData: "PURCHASES", suppliers: "Fournisseurs", imports: "Centre d’import", mail: "Mail du marché", settings: "Paramètres", admin: "Administration", superadmin: "Super admin",
};

const groups = [
  { label: "Points hebdomadaires", items: [
    { id: "read", icon: "eye", label: "Point marché" },
    { id: "analyst", icon: "user", label: "Analystes" },
  ] },
  { label: "Données et suivi", items: [
    { id: "stats", icon: "trend", label: "Variations fournisseurs" },
    { id: "purchaseData", icon: "database", label: "PURCHASES" },
    { id: "suppliers", icon: "database", label: "Fournisseurs" },
    { id: "imports", icon: "upload", label: "Centre d’import" },
  ] },
  { label: "Diffusion et réglages", items: [
    { id: "mail", icon: "mail", label: "Mail du marché" },
    { id: "settings", icon: "settings", label: "Paramètres" },
    { id: "admin", icon: "lock", label: "Administration" },
    { id: "superadmin", icon: "settings", label: "Super admin" },
  ] },
] as const;

type Props = {
  view: WorkspaceView;
  userName: string | null;
  onSelect: (view: WorkspaceView) => void;
};

export function WorkspaceNavigation({ view, userName, onSelect }: Props) {
  const { person, effective, policy, changeUser } = useAccess();
  const [open, setOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  useEffect(() => { try { setCompact(localStorage.getItem("market-pulse:compact-menu") === "true"); } catch {} }, []);
  const toggleCompact = () => setCompact(current => { const next = !current; try { localStorage.setItem("market-pulse:compact-menu", String(next)); } catch {} return next; });
  const select = (next: WorkspaceView) => { setOpen(false); onSelect(next); };
  const content = <>
    <button type="button" className="workspace-brand" onClick={() => select("read")} aria-label="Market Pulse, ouvrir le point marché"><span className="workspace-brand-mark"><AppIcon name="trend" size={24}/></span><span><strong>Market Pulse</strong><small>Espace GLOBAL · {APP_VERSION}</small></span></button>
    <button type="button" className="workspace-menu-size" onClick={toggleCompact} aria-expanded={!compact} aria-label={compact ? "Développer le menu avec les textes" : "Réduire le menu aux pictogrammes"} title={compact ? "Afficher les textes" : "Pictogrammes seuls"}><AppIcon name="menu"/><span>{compact ? "Afficher les textes" : "Réduire le menu"}</span></button>
    <nav className="workspace-nav" aria-label="Navigation principale">
      {groups.map((group) => <div className="workspace-nav-group" key={group.label}><span>{group.label}</span>{group.items.filter(item => canView(effective, item.id, policy)).map((item) => <button key={item.id} type="button" className={(view === item.id || (item.id === "analyst" && view === "analyst-activity")) ? "active" : ""} aria-label={item.label} title={item.label} aria-current={(view === item.id || (item.id === "analyst" && view === "analyst-activity")) ? "page" : undefined} onClick={() => select(item.id)}><AppIcon name={item.icon} size={20}/><span>{item.label}</span>{(view === item.id || (item.id === "analyst" && view === "analyst-activity")) && <i aria-hidden="true"/>}</button>)}</div>)}

    </nav>
    <footer className="workspace-account">
      <AccessViewSelector/>
      <div className="access-profile"><button type="button" onClick={changeUser} title="Changer d’utilisateur">Changer d’utilisateur</button></div>
      <a href="/plan-du-site" aria-label="Plan du site" title="Plan du site"><AppIcon name="menu" size={16}/><span>Plan du site</span></a>
      <div><span className="workspace-avatar"><AppIcon name={userName ? "user" : "eye"}/></span><span><strong>{person.name}</strong><small>{person.usercode} · {roleNames[person.role]}</small></span></div>
      {isLocalWorkspace() && <button type="button" aria-label="Fichier local" title="Fichier local" onClick={() => { setOpen(false); openLocalFiles(); }}><AppIcon name="download" size={16}/><span>Fichier local</span></button>}

    </footer>
  </>;
  return <>
    <aside className={`workspace-sidebar ${compact ? "is-compact" : ""}`}>{content}</aside>
    <button type="button" className="icon-button workspace-menu-trigger" aria-label="Ouvrir la navigation" aria-expanded={open} aria-controls="workspace-menu-title" onClick={() => setOpen(true)}><AppIcon name="menu" size={22}/></button>
    <AppDialog open={open} onClose={() => setOpen(false)} labelledBy="workspace-menu-title" className={`workspace-menu-dialog ${compact ? "is-compact" : ""}`} backdropClassName="workspace-menu-backdrop"><h2 className="sr-only" id="workspace-menu-title">Navigation de Market Pulse</h2>{content}</AppDialog>
  </>;
}
