"use client";

import { useState } from "react";
import { APP_VERSION } from "@/lib/app-version";
import { isLocalWorkspace, openLocalFiles } from "@/lib/app-transport";
import { AppDialog } from "@/components/app-dialog";
import { AppIcon } from "@/components/app-icon";

export type WorkspaceView = "read" | "edit" | "analyst" | "stats" | "suppliers" | "imports" | "mail" | "settings";
export const workspaceTitles: Record<WorkspaceView, string> = {
  read: "Point marché", edit: "Point marché", analyst: "Point analyste", stats: "Statistiques", suppliers: "Fournisseurs", imports: "Centre d’import", mail: "Mail du marché", settings: "Paramètres",
};

const groups = [
  { label: "Points hebdomadaires", items: [
    { id: "read", icon: "eye", label: "Point marché" },
    { id: "analyst", icon: "user", label: "Point analyste" },
  ] },
  { label: "Données et suivi", items: [
    { id: "stats", icon: "trend", label: "Statistiques" },
    { id: "suppliers", icon: "database", label: "Fournisseurs" },
    { id: "imports", icon: "upload", label: "Centre d’import" },
  ] },
  { label: "Diffusion et réglages", items: [
    { id: "mail", icon: "mail", label: "Mail du marché" },
    { id: "settings", icon: "settings", label: "Paramètres" },
  ] },
] as const;

type Props = {
  view: WorkspaceView;
  userName: string | null;
  onSelect: (view: WorkspaceView) => void;
};

export function WorkspaceNavigation({ view, userName, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const select = (next: WorkspaceView) => { setOpen(false); onSelect(next); };
  const content = <>
    <button type="button" className="workspace-brand" onClick={() => select("read")} aria-label="Market Pulse, ouvrir le point marché"><span className="workspace-brand-mark"><AppIcon name="trend" size={24}/></span><span><strong>Market Pulse</strong><small>Espace GLOBAL · {APP_VERSION}</small></span></button>
    <nav className="workspace-nav" aria-label="Navigation principale">
      {groups.map((group) => <div className="workspace-nav-group" key={group.label}><span>{group.label}</span>{group.items.map((item) => <button key={item.id} type="button" className={view === item.id ? "active" : ""} aria-current={view === item.id ? "page" : undefined} onClick={() => select(item.id)}><AppIcon name={item.icon} size={20}/><span>{item.label}</span>{view === item.id && <i aria-hidden="true"/>}</button>)}</div>)}
    </nav>
    <footer className="workspace-account">
      <div><span className="workspace-avatar"><AppIcon name={userName ? "user" : "eye"}/></span><span><strong>{userName || "Espace partagé"}</strong><small>{userName ? "Modification partagée" : "Points enregistrés"}</small></span></div>
      {isLocalWorkspace() && <button type="button" onClick={() => { setOpen(false); openLocalFiles(); }}><AppIcon name="download" size={16}/>Fichier local</button>}

    </footer>
  </>;
  return <>
    <aside className="workspace-sidebar">{content}</aside>
    <button type="button" className="icon-button workspace-menu-trigger" aria-label="Ouvrir la navigation" aria-expanded={open} aria-controls="workspace-menu-title" onClick={() => setOpen(true)}><AppIcon name="menu" size={22}/></button>
    <AppDialog open={open} onClose={() => setOpen(false)} labelledBy="workspace-menu-title" className="workspace-menu-dialog" backdropClassName="workspace-menu-backdrop"><h2 className="sr-only" id="workspace-menu-title">Navigation de Market Pulse</h2>{content}</AppDialog>
  </>;
}
