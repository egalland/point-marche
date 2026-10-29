"use client";
import { useState } from "react";
import { AppDialog } from "@/components/app-dialog";
import { APP_VERSION } from "@/lib/app-version";
import { findReleases, releaseHistory } from "@/lib/release-history";

export function ChangelogDialog({open,onClose}:{open:boolean;onClose:()=>void}) {
  const [query,setQuery] = useState("");
  const [limit,setLimit] = useState(20);
  const releases = findReleases(query);
  return <AppDialog open={open} onClose={onClose} labelledBy="changelog-title" className="changelog-dialog">
    <header><span className="changelog-eyebrow">Market Plus · {APP_VERSION}</span><h2 id="changelog-title">Historique des versions</h2><p>Les évolutions de l’application depuis la V1.</p></header>
    <label className="field changelog-search"><span>Rechercher une version ou une fonctionnalité</span><input type="search" placeholder="V1, simulations, mobile…" value={query} onChange={event=>{setQuery(event.target.value);setLimit(20);}}/></label>
    <p className="changelog-count" role="status">{releases.length} version{releases.length===1?"":"s"}{query ? " trouvée"+(releases.length===1?"":"s") : ` · V1 à ${APP_VERSION}`}</p>
    <ol className="changelog-list">{releases.slice(0,limit).map(release=><li key={release.version}><article><div className="changelog-meta"><strong>V{release.version}</strong><time dateTime={release.date}>{release.date.split("-").reverse().join("/")}</time>{`V${release.version}`===APP_VERSION&&<span>Actuelle</span>}</div><h3>{release.title}</h3><ul>{release.changes.map(change=><li key={change}>{change}</li>)}</ul></article></li>)}</ol>
    {!releases.length&&<p>Aucune version ne correspond à cette recherche.</p>}
    {limit<releases.length&&<button type="button" className="secondary-button changelog-more" onClick={()=>setLimit(value=>value+20)}>Afficher les versions précédentes ({releases.length-limit})</button>}
    <small className="changelog-footnote">{releaseHistory.length} versions documentées</small>
  </AppDialog>;
}
