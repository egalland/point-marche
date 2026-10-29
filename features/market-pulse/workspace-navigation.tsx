"use client";
import { useAccess, canView, AccessViewSelector } from "./access-panel";
import { roleNames } from "@/lib/access-control";

import { useEffect, useState, type ReactNode } from "react";
import { APP_VERSION } from "@/lib/app-version";
import { isLocalWorkspace, openLocalFiles } from "@/lib/app-transport";
import { AppDialog } from "@/components/app-dialog";
import { LocalFileButton } from "@/components/local-file-button";
import { ChangelogDialog } from "@/components/changelog-dialog";
import { AppIcon } from "@/components/app-icon";

export type WorkspaceView = "read" | "edit" | "analyst" | "analyst-activity" | "jira" | "stats" | "purchaseData" | "suppliers" | "imports" | "mail" | "settings" | "admin" | "superadmin";
export const workspaceTitles: Record<WorkspaceView, string> = {
  read: "Point marché", edit: "Point marché", analyst: "Analystes", "analyst-activity": "Analystes", jira: "Jira", stats: "Variations fournisseurs", purchaseData: "PURCHASES", suppliers: "Fournisseurs", imports: "Centre d’import", mail: "Mail du marché", settings: "Paramètres", admin: "Administration", superadmin: "Super admin",
};

const groups = [
  { label: "Points hebdomadaires", items: [
    { id: "read", icon: "eye", label: "Point marché" },
    { id: "analyst", icon: "user", label: "Analystes" },
  ] },
  { label: "Données et suivi", items: [
    { id: "jira", icon: "ticket", label: "Jira" },
    { id: "stats", icon: "trend", label: "Variations fournisseurs" },
    { id: "purchaseData", icon: "layers", label: "PURCHASES" },
    { id: "suppliers", icon: "building", label: "Fournisseurs" },
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
  tools?: ReactNode;
  view: WorkspaceView;
  userName: string | null;
  onSelect: (view: WorkspaceView) => void;
};

export function WorkspaceNavigation({ view, userName, onSelect, tools }: Props) {
  const { person, effective, policy, changeUser } = useAccess();
  const [open, setOpen] = useState(false);
  const [changelogOpen,setChangelogOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  useEffect(() => { try { setCompact(localStorage.getItem("market-pulse:compact-menu") === "true"); } catch {} }, []);
  const toggleCompact = () => setCompact(current => { const next = !current; try { localStorage.setItem("market-pulse:compact-menu", String(next)); } catch {} return next; });
  const select = (next: WorkspaceView) => { setOpen(false); onSelect(next); };
  const content = <>
    <button type="button" className="workspace-brand" onClick={() => select("read")} aria-label="Market Plus, ouvrir le point marché"><span className="workspace-brand-mark"><AppIcon name="trend" size={24}/></span><span><strong>Market Plus</strong><small>Espace GLOBAL · {APP_VERSION}</small></span></button>
    <button type="button" className="workspace-menu-size" onClick={toggleCompact} aria-expanded={!compact} aria-label={compact ? "Développer le menu avec les textes" : "Réduire le menu aux pictogrammes"} title={compact ? "Afficher les textes" : "Pictogrammes seuls"}><AppIcon name="menu"/><span>{compact ? "Afficher les textes" : "Réduire le menu"}</span></button>
    <nav className="workspace-nav" aria-label="Navigation principale">
      {groups.filter(group=>group.items.some(item=>canView(effective,item.id,policy))).map((group) => <div className="workspace-nav-group" key={group.label}><span>{group.label}</span>{group.items.filter(item => canView(effective, item.id, policy)).map((item) => <button key={item.id} type="button" className={(view === item.id || (item.id === "analyst" && view === "analyst-activity")) ? "active" : ""} aria-label={item.label} title={item.label} aria-current={(view === item.id || (item.id === "analyst" && view === "analyst-activity")) ? "page" : undefined} onClick={() => select(item.id)}><AppIcon name={item.icon} size={20}/><span>{item.label}</span>{(view === item.id || (item.id === "analyst" && view === "analyst-activity")) && <i aria-hidden="true"/>}</button>)}</div>)}

    </nav>
    <footer className="workspace-account workspace-account-compact">
      <button type="button" className="workspace-preferences-trigger" aria-label="Historique des versions" aria-haspopup="dialog" title="Historique des versions" onClick={()=>{setOpen(false);setChangelogOpen(true);}}><AppIcon name="calendar" size={20}/><span>Historique des versions</span></button>
      <button type="button" className="workspace-preferences-trigger" aria-label="Affichage et compte" aria-haspopup="dialog" title={`${person.name} · Affichage et compte`} onClick={()=>{setOpen(false);setPreferencesOpen(true);}}><AppIcon name="settings" size={20}/><span>Affichage et compte</span></button>
      {isLocalWorkspace() && <LocalFileButton onOpen={()=>{setOpen(false);openLocalFiles();}}/>}
    </footer>
  </>;
  return <>
    <ChangelogDialog open={changelogOpen} onClose={()=>setChangelogOpen(false)}/>
    <aside className={`workspace-sidebar ${compact ? "is-compact" : ""}`}>{content}</aside>
    <button type="button" className="icon-button workspace-menu-trigger" aria-label="Ouvrir la navigation" aria-expanded={open} aria-controls="workspace-menu-title" onClick={() => setOpen(true)}><AppIcon name="menu" size={22}/></button>
    <AppDialog open={preferencesOpen} onClose={()=>setPreferencesOpen(false)} labelledBy="workspace-preferences-title" className="workspace-preferences-dialog"><h2 id="workspace-preferences-title">Affichage et compte</h2><p className="workspace-preferences-version">Market Plus · {APP_VERSION}</p><div className="sidebar-reading-tools">{tools}</div><AccessViewSelector/><div className="workspace-profile-summary"><span className="workspace-avatar"><AppIcon name="user"/></span><div><strong>{person.name}</strong><small>{person.usercode} · {roleNames[person.role]}</small></div></div><div className="workspace-preferences-links">{!isLocalWorkspace() && <a className="secondary-button" href="https://market-plus.emmanuel-galland117.chatgpt.site/documents/Projet_Point_Marche_V122.pdf" download="Projet_Point_Marche_V122.pdf"><AppIcon name="download" size={16}/> Dossier de projet V122 (PDF)</a>}{!isLocalWorkspace() && <a className="secondary-button" href="https://market-plus.emmanuel-galland117.chatgpt.site/documents/Market_Plus_Fiche_Technique_V124.pdf" download="Market_Plus_Fiche_Technique_V124.pdf"><AppIcon name="download" size={16}/> Fiche technique V124 (PDF)</a>}<button type="button" className="secondary-button" onClick={()=>{setPreferencesOpen(false);changeUser();}}>Changer d’utilisateur</button><a className="secondary-button" href="/plan-du-site"><AppIcon name="menu" size={16}/> Plan du site</a></div></AppDialog>
    <AppDialog open={open} onClose={() => setOpen(false)} labelledBy="workspace-menu-title" className={`workspace-menu-dialog ${compact ? "is-compact" : ""}`} backdropClassName="workspace-menu-backdrop"><h2 className="sr-only" id="workspace-menu-title">Navigation de Market Plus</h2>{content}</AppDialog>
  </>;
}
