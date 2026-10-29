"use client";
import { AppIcon } from "./app-icon";
import { useLocalSync } from "./local-sync-context";

export function LocalFileButton({ onOpen }: { onOpen: () => void }) {
  const sync = useLocalSync();
  const label = sync ? `Synchronisation · ${sync.folder} · ${sync.message}${sync.conflicts ? ` · ${sync.conflicts} conflit(s)` : ""}` : "Fichier local";
  return <>
    <button type="button" className={`workspace-file-trigger${sync ? ` workspace-sync-trigger status-${sync.status}` : ""}`} aria-label={label} title={label} aria-haspopup="dialog" onClick={onOpen}>
      <AppIcon name={sync ? "refresh" : "download"} size={20}/>
      {sync && <i className="workspace-sync-dot" aria-hidden="true"/>}
      <span>{sync ? "Synchronisation" : "Fichier local"}</span>
    </button>
    {sync && <span className="sr-only" role={sync.status === "error" || sync.status === "conflict" ? "alert" : "status"}>{label}</span>}
  </>;
}
