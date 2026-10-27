"use client";
import { useAccess } from "./access-panel";

import { appFetch as fetch } from "@/lib/app-transport";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { type GlobalDirectoryUser } from "@/lib/global-directory";
import { decodeJiraCsv, parseJiraCsv, type JiraCsvParseResult } from "@/lib/jira-csv";
import type { PlannerTask } from "@/lib/planner-import";
import type { PlannerRegistrySummary } from "@/lib/planner-registry";
import { PURCHASESImportPlaceholder } from "./purchaseData-import-placeholder";
import { ImportSourceRefreshPanel } from "./import-source-location";
import { PlannerImportDialog } from "./planner-import-dialog";

type Market = { id: string; name: string; plannerTags: string[] };
type ImportBatch = {
  id: string;
  filename: string;
  status: string;
  rowCount: number;
  ticketCount: number;
  participantCount: number;
  rejectedCount: number;
  repairedTextCount: number;
  unknownUserCodeCount: number;
  createdAt: string;
  completedAt: string | null;
};

type Props = {
  users: GlobalDirectoryUser[];
  markets: Market[];
  plannerTasks: PlannerTask[];
  plannerRegistry: PlannerRegistrySummary;
  plannerUpdatedAt: string;
  onPlannerImport: (rawText: string) => Promise<{ imported: number; message: string }>;
  onJiraImported: () => Promise<void>;
  onManual?: (source: "jira" | "planner") => void;
};

function formatBytes(value: number) {
  if (value < 1024) return `${value} o`;
  if (value < 1024 * 1024) return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value / 1024)} Ko`;
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value / (1024 * 1024))} Mo`;
}

function dateLabel(value: string | null) {
  if (!value) return "—";
  const date = new Date(value.replace(" ", "T") + (value.includes("Z") ? "" : "Z"));
  return Number.isFinite(date.valueOf()) ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(date) : value;
}

function statusLabel(value: string) {
  return value === "completed" ? "Terminé" : value === "failed" ? "Échec" : "Interrompu";
}

export function ImportCenter({ users, markets, plannerTasks, plannerRegistry, plannerUpdatedAt, onPlannerImport, onJiraImported, onManual }: Props) {
  const { can } = useAccess();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<JiraCsvParseResult | null>(null);
  const [encoding, setEncoding] = useState("");
  const [repairedTextCount, setRepairedTextCount] = useState(0);
  const [loadingFile, setLoadingFile] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [registry, setRegistry] = useState<{ ticketCount: number | null; participantCount: number | null }>({ ticketCount: null, participantCount: null });
  const [historyLoading, setHistoryLoading] = useState(true);
  const knownUserCodes = useMemo(() => new Set(users.map((user) => user.usercode.trim().toUpperCase()).filter(Boolean)), [users]);
  const unknownUserCodes = useMemo(() => {
    if (!preview) return [];
    const all = new Set(preview.tickets.flatMap((ticket) => [ticket.assigneeUserCode, ...ticket.participants.map((participant) => participant.usercode)]).filter(Boolean));
    return Array.from(all).filter((usercode) => !knownUserCodes.has(usercode)).sort();
  }, [knownUserCodes, preview]);

  const loadHistory = useCallback(async () => {
    const response = await fetch("/api/jira-imports", { cache: "no-store" });
    const payload = await response.json() as { batches?: ImportBatch[]; registry?: { ticketCount: number; participantCount: number }; error?: string };
    if (!response.ok) throw new Error(payload.error || "Chargement des imports impossible.");
    setBatches(payload.batches ?? []);
    setRegistry(payload.registry ?? { ticketCount: 0, participantCount: 0 });
  }, []);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void loadHistory().catch((error) => { if (active) setMessage(error instanceof Error ? error.message : "Chargement impossible."); }).finally(() => { if (active) setHistoryLoading(false); });
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [loadHistory]);

  const readFile = async (nextFile: File) => {
    if (importing || loadingFile) return;
    setLoadingFile(true);
    setMessage("");
    setProgress(0);
    try {
      const decoded = decodeJiraCsv(await nextFile.arrayBuffer());
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      const parsed = parseJiraCsv(decoded.text);
      setFile(nextFile);
      setPreview(parsed);
      setEncoding(decoded.encoding);
      setRepairedTextCount(decoded.repairedTextCount + parsed.repairedTextCount);
      setMessage(parsed.missingColumns.length ? `Colonnes manquantes : ${parsed.missingColumns.join(", ")}.` : `${parsed.tickets.length} tickets prêts, dont ${parsed.closedTicketCount} terminé${parsed.closedTicketCount > 1 ? "s" : ""} rattaché${parsed.closedTicketCount > 1 ? "s" : ""} par la dernière modification.${parsed.abandonedTicketCount ? ` ${parsed.abandonedTicketCount} abandonné(s) conservé(s) dans l’import, exclu(s) des points.` : ""}`);
    } catch (error) {
      setFile(nextFile);
      setPreview(null);
      setMessage(error instanceof Error ? error.message : "Lecture du fichier impossible.");
    } finally {
      setLoadingFile(false);
    }
  };

  const importFile = async () => {
    if (!file || !preview?.tickets.length || preview.missingColumns.length || importing) return;
    setImporting(true);
    setProgress(0);
    setMessage("Création de l’import…");
    let importId = "";
    try {
      const startedResponse = await fetch("/api/jira-imports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "start", filename: file.name, rowCount: preview.rows }) });
      const started = await startedResponse.json() as { batch?: ImportBatch; maxChunkSize?: number; error?: string };
      if (!startedResponse.ok || !started.batch) throw new Error(started.error || "Impossible de démarrer l’import.");
      importId = started.batch.id;
      const chunkSize = Math.max(1, Math.min(250, started.maxChunkSize ?? 200));
      for (let index = 0; index < preview.tickets.length; index += chunkSize) {
        const tickets = preview.tickets.slice(index, index + chunkSize);
        const response = await fetch("/api/jira-imports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "chunk", importId, tickets }) });
        const payload = await response.json() as { error?: string };
        if (!response.ok) throw new Error(payload.error || `Échec du lot ${Math.floor(index / chunkSize) + 1}.`);
        setProgress(Math.round(Math.min(preview.tickets.length, index + tickets.length) / preview.tickets.length * 100));
      }
      const finishedResponse = await fetch("/api/jira-imports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "finish", importId, expectedTicketCount: preview.tickets.length, expectedParticipantCount: preview.participantCount, rejectedCount: preview.rejectedRows, repairedTextCount, unknownUserCodeCount: unknownUserCodes.length }) });
      const finished = await finishedResponse.json() as { batch?: ImportBatch; error?: string };
      if (!finishedResponse.ok || !finished.batch) throw new Error(finished.error || "Finalisation impossible.");
      await Promise.all([loadHistory(), onJiraImported()]);
      setMessage(`${preview.tickets.length} tickets enregistrés : ${preview.openTicketCount} non terminés et ${preview.closedTicketCount} terminés.${preview.abandonedTicketCount ? ` ${preview.abandonedTicketCount} abandonné(s) conservé(s) dans l’import, exclu(s) des points.` : ""} Les points sont maintenant alimentés.`);
      setProgress(100);
    } catch (error) {
      if (importId) await fetch("/api/jira-imports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "fail", importId }) }).catch(() => undefined);
      setMessage(error instanceof Error ? error.message : "Import Jira impossible.");
      await loadHistory().catch(() => undefined);
    } finally {
      setImporting(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setPreview(null);
    setEncoding("");
    setRepairedTextCount(0);
    setProgress(0);
    setMessage("");
    if (inputRef.current) inputRef.current.value = "";
  };

  return <main className="import-center-page">
    <section className="import-center-hero">
      <div><span>Sources centralisées</span><h1>Centre d’import</h1><p>Un seul registre alimente les points marché, les points analystes et les statistiques.</p></div>
      <div className="import-registry-kpis"><article><span>Tickets en registre</span><strong>{historyLoading ? "…" : registry.ticketCount ?? "—"}</strong></article><article><span>Liens participants</span><strong>{historyLoading ? "…" : registry.participantCount ?? "—"}</strong></article><article><span>Simulations Planner</span><strong>{plannerTasks.length}</strong></article></div>
    </section>

    <ImportSourceRefreshPanel/>
    <div className="import-manual-heading"><h2>Imports manuels</h2><p>Importer un fichier ou coller les données source par source.</p></div>
    {onManual && <section className="manual-import-fallback"><div><strong>Continuer sans import</strong><p>Prépare le marché actif en saisie manuelle si le fichier est indisponible ou si l’import échoue.</p></div><div><button type="button" className="secondary-button" onClick={() => onManual("jira")}>Saisir Jira manuellement</button><button type="button" className="secondary-button" onClick={() => onManual("planner")}>Saisir les simulations</button></div></section>}
    <nav className="import-source-nav" aria-label="Sources à importer"><a href="#import-jira"><b>01</b><span>Jira<small>Tickets et participants</small></span></a><a href="#import-planner"><b>02</b><span>Planner<small>Simulations tarifaires</small></span></a><a href="#import-purchaseData"><b>03</b><span>PURCHASES<small>Extraction fournisseurs</small></span></a></nav>
    <div className="import-source-grid">
      <fieldset disabled={!can("imports.jira")} className="permission-fieldset"><section id="import-jira" aria-labelledby="import-jira-title" className="surface import-source-card jira-source-card">
        <header><div><span>Source 01 · Jira</span><h2 id="import-jira-title">Tickets et participants</h2><p>Dépose ton export CSV, vérifie les données détectées puis lance l’import.</p></div><b>CSV</b></header>
        <details className="import-file-guide"><summary>Colonnes à conserver dans le CSV</summary><p>Clé, ID, État, Résumé, Création, Personne assignée, Mise à jour et les colonnes Participants à la requête. La date de résolution reste facultative.</p></details>
        <input ref={inputRef} type="file" disabled={loadingFile || importing} accept=".csv,text/csv,text/plain" hidden onChange={(event) => { const nextFile = event.target.files?.[0]; if (nextFile) void readFile(nextFile); }}/>
        {!file ? <button type="button" className="jira-file-drop" disabled={loadingFile || importing} onClick={() => inputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }} onDrop={(event: DragEvent<HTMLButtonElement>) => { event.preventDefault(); const dropped = event.dataTransfer.files?.[0]; if (dropped) void readFile(dropped); }}><span>CSV</span><strong>{loadingFile ? "Lecture du fichier…" : "Déposer le fichier Jira"}</strong><small>ou cliquer pour sélectionner un CSV</small></button> : <div className="jira-file-selected"><div><span>{encoding}</span><strong>{file.name}</strong><small>{formatBytes(file.size)} · {preview?.rows ?? 0} lignes lues</small></div><button type="button" className="secondary-button" disabled={importing || loadingFile} onClick={clearFile}>Changer de fichier</button></div>}
        {!preview && message && <p className="import-feedback" role="alert">{message}</p>}

        {preview && <>
          <div className="jira-file-kpis">
            <article><span>Non terminés</span><strong>{preview.openTicketCount}</strong></article>
            <article className="resolved"><span>Terminés</span><strong>{preview.closedTicketCount}</strong></article>
            <article><span>Participations</span><strong>{preview.participantCount}</strong></article>
            <article className={unknownUserCodes.length ? "warning" : ""}><span>USERCODE inconnus</span><strong>{unknownUserCodes.length}</strong></article>
            <article className={preview.rejectedRows || preview.invalidDateRows ? "danger" : ""}><span>Lignes à vérifier</span><strong>{preview.rejectedRows + preview.invalidDateRows}</strong></article>
          </div>
          {preview.missingColumns.length ? <div className="import-quality-alert danger"><strong>Import bloqué</strong><span>Colonnes manquantes : {preview.missingColumns.join(", ")}.</span></div> : !preview.closedTicketCount ? <div className="import-quality-alert warning"><strong>Aucun ticket terminé dans le fichier</strong><span>Le fichier contient uniquement des tickets non terminés. Pour alimenter les terminés hebdomadaires, ajoute aussi les tickets terminés au périmètre de ton export Jira.</span></div> : <div className={`import-quality-alert ${preview.invalidDateRows ? "warning" : "ok"}`}><strong>{preview.invalidDateRows ? `${preview.invalidDateRows} date(s) illisible(s)` : "Structure complète reconnue"}</strong><span>{preview.closedTicketCount} ticket{preview.closedTicketCount > 1 ? "s" : ""} terminé{preview.closedTicketCount > 1 ? "s" : ""} exploitable{preview.closedTicketCount > 1 ? "s" : ""} via la dernière modification. {repairedTextCount ? `${repairedTextCount} séquence(s) d’accents réparée(s). ` : ""}{preview.duplicateKeys ? `${preview.duplicateKeys} doublon(s) fusionné(s).` : "Aucun doublon détecté."}</span></div>}
          {unknownUserCodes.length > 0 && <div className="unknown-usercode-list"><span>À rapprocher dans l’annuaire</span><div>{unknownUserCodes.slice(0, 12).map((usercode) => <b key={usercode}>{usercode}</b>)}{unknownUserCodes.length > 12 && <b>+{unknownUserCodes.length - 12}</b>}</div></div>}
          {preview.tickets.length > 0 && <div className="jira-csv-preview"><table><thead><tr><th>Ticket</th><th>État</th><th>Résumé</th><th>Assigné</th><th>Participants</th><th>Catégorie</th><th>Sous-catégorie</th><th>Mise à jour</th></tr></thead><tbody>{preview.tickets.slice(0, 25).map((ticket) => <tr key={ticket.key}><td><a href={ticket.link} target="_blank" rel="noreferrer">{ticket.key}</a></td><td>{ticket.status}</td><td>{ticket.summary}</td><td>{ticket.assigneeUserCode || "—"}</td><td>{ticket.participants.map((participant) => participant.usercode).join(" · ") || "—"}</td><td>{ticket.category || "—"}</td><td>{ticket.subcategory || "—"}</td><td>{ticket.updatedAt ? ticket.updatedAt.slice(0, 16).replace("T", " ") : "—"}</td></tr>)}</tbody></table>{preview.tickets.length > 25 && <small>Prévisualisation limitée à 25 lignes · {preview.tickets.length - 25} autres tickets seront importés.</small>}</div>}
          <div className="jira-import-progress"><div><span style={{ width: `${progress}%` }}/></div><footer><span role="status">{message}</span><button type="button" className="primary-button" disabled={importing || !preview.tickets.length || Boolean(preview.missingColumns.length)} onClick={() => { void importFile(); }}>{importing ? `Import ${progress}%` : `Importer ${preview.tickets.length} tickets`}</button></footer></div>
        </>}
      </section>

      </fieldset><fieldset disabled={!can("imports.planner")} className="permission-fieldset"><section id="import-planner" aria-labelledby="import-planner-title" className="surface import-source-card planner-source-card">
        <header><div><span>Source 02 · Planner</span><h2 id="import-planner-title">Simulations tarifaires</h2><p>Colle ton tableau Planner, vérifie les simulations détectées puis confirme l’import.</p></div><b>TABLEAU COPIÉ</b></header>
        <div className="planner-source-status"><article><span>Tâches enregistrées</span><strong>{plannerTasks.length}</strong></article><article><span>Variations exploitables</span><strong>{plannerRegistry.usableVariations}</strong></article><article><span>Dernière source</span><strong>{plannerUpdatedAt ? dateLabel(plannerUpdatedAt) : "Jamais"}</strong></article></div>
        <div className="planner-source-action"><div><strong>Import Planner actuel</strong><span>Prévisualisation des tags, analystes et variations avant enregistrement.</span></div><PlannerImportDialog markets={markets} onImport={onPlannerImport}/></div>
      </section>
      </fieldset><fieldset disabled={!can("imports.purchaseData")} className="permission-fieldset"><PURCHASESImportPlaceholder/></fieldset>
    </div>

    <section className="surface import-history">
      <header><div><span>Historique</span><h2>Derniers imports Jira</h2><p>Retrouve les fichiers importés, leur date et le résultat de leur traitement.</p></div></header>
      {historyLoading ? <div className="import-history-empty">Chargement de l’historique…</div> : batches.length ? <div className="import-history-list">{batches.map((batch) => <article key={batch.id} className={`is-${batch.status}`}><span>{batch.status === "completed" ? "✓" : "!"}</span><div><strong>{batch.filename || "Export Jira"}</strong><small>{dateLabel(batch.completedAt ?? batch.createdAt)} · {batch.rowCount} lignes</small></div><div><b>{batch.ticketCount}</b><small>tickets</small></div><div><b>{batch.participantCount}</b><small>participants</small></div><div><b>{batch.unknownUserCodeCount}</b><small>USERCODE inconnus</small></div><em>{statusLabel(batch.status)}</em></article>)}</div> : <div className="import-history-empty">Aucun import Jira centralisé pour le moment.</div>}
    </section>
  </main>;
}
