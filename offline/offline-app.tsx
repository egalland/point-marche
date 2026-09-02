import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { MarketPulseApp } from "../features/market-pulse/market-pulse-app";
import { installLocalTransport } from "../lib/app-transport";
import { createLocalApi } from "./local-api";
import { WorkspaceStore } from "./workspace-store";
import { encodeWorkspace, newWorkspace, type WorkspaceData } from "./workspace-data";
import { downloadWorkspace, fingerprint, readWorkspaceFile, workspaceFilename, writeWorkspaceFile, type FileFingerprint, type LocalFileHandle } from "./file-session";
import { readRecovery, writeRecovery, type RecoveryEntry } from "./recovery-cache";
import { WorkspaceErrorBoundary } from "./workspace-error-boundary";
import { decodeJiraCsv } from "../lib/jira-csv";
import { completeMigrationWithCsv, decodeMigrationCheckpoint, type MigrationCheckpoint } from "./migration-data";

type PickerWindow = Window & {
  showOpenFilePicker?: (options: unknown) => Promise<LocalFileHandle[]>;
  showSaveFilePicker?: (options: unknown) => Promise<LocalFileHandle>;
};
const fileTypes = [{ description: "Classeur Market Pulse", accept: { "application/json": [".json"] } }];
const dateLabel = (value: string) => new Date(value).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
const isCancelled = (error: unknown) => error instanceof DOMException && error.name === "AbortError";

export function OfflineApp() {
  const [store] = useState(() => new WorkspaceStore());
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);
  const [recovery, setRecovery] = useState<RecoveryEntry | null>(null);
  const [recoveryWarning, setRecoveryWarning] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [filename, setFilename] = useState("");
  const [generation, setGeneration] = useState(0);
  const [tick, setTick] = useState(0);
  const [downloadRevision, setDownloadRevision] = useState<number | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [migration, setMigration] = useState<MigrationCheckpoint | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const csvInput = useRef<HTMLInputElement>(null);
  const handle = useRef<LocalFileHandle | null>(null);
  const expectedFile = useRef<FileFingerprint | undefined>(undefined);
  const recoveryQueue = useRef<Promise<void>>(Promise.resolve());
  const fileBusy = useRef(false);

  useEffect(() => store.subscribe(() => setTick((value) => value + 1)), [store]);
  useEffect(() => {
    let mounted = true;
    const recoveryTask = readRecovery().then((entry) => { if (mounted) setRecovery(entry); }).catch((error) => { if (mounted) setRecoveryWarning(error.message); });
    const embedded = document.getElementById("market-pulse-migration")?.textContent;
    const migrationTask = embedded ? decodeMigrationCheckpoint(embedded).then((data) => { if (mounted) setMigration(data); }).catch((error) => { if (mounted) setError(error.message); }) : Promise.resolve();
    Promise.all([recoveryTask, migrationTask]).finally(() => { if (mounted) setReady(true); });
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => {
      const entry = { data: store.snapshot(), filename, unsaved: store.isDirty(), cachedAt: new Date().toISOString() };
      recoveryQueue.current = recoveryQueue.current.catch(() => undefined).then(() => writeRecovery(entry)).catch((error) => setRecoveryWarning(error.message));
    }, 800);
    return () => window.clearTimeout(timer);
  }, [active, filename, store, tick]);
  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => { if (active && (store.isDirty() || fileBusy.current)) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [active, store]);

  const activate = (data: WorkspaceData, name: string, unsaved: boolean, nextHandle: LocalFileHandle | null = null, expected?: FileFingerprint) => {
    store.replace(data);
    installLocalTransport(createLocalApi(store), { read: store.readDraft, write: store.writeDraft, pending: (key, value) => store.setPendingForm(key, value), readPreference: store.readPreference, writePreference: store.writePreference });
    handle.current = nextHandle;
    expectedFile.current = expected;
    setFilename(name); setGeneration((value) => value + 1); setActive(true); setRecovery(null); setDownloadRevision(null);
    if (unsaved) store.markUnsaved();
  };
  const canReplace = () => {
    const unsaved = active ? store.isDirty() : recovery?.unsaved;
    return !unsaved || window.confirm("Le classeur contient des modifications non enregistrées sur disque. Continuer sans les enregistrer ?");
  };

  const loadFile = async (file: File, nextHandle: LocalFileHandle | null = null) => {
    setBusy(true); fileBusy.current = true; setError("");
    try {
      const data = await readWorkspaceFile(file);
      activate(data, file.name, false, nextHandle, nextHandle ? fingerprint(file) : undefined);
      setMessage(`Classeur ouvert : ${data.jiraTickets.length.toLocaleString("fr-FR")} tickets et ${data.plannerTasks.length.toLocaleString("fr-FR")} tâches Planner.`);
    } catch (error) { setError(error instanceof Error ? error.message : "Ouverture impossible. Le classeur précédent reste intact."); }
    finally { setBusy(false); fileBusy.current = false; }
  };
  const open = async () => {
    if (fileBusy.current || !canReplace()) return;
    setError("");
    const picker = (window as PickerWindow).showOpenFilePicker;
    if (!picker || !window.isSecureContext) { input.current?.click(); return; }
    fileBusy.current = true;
    try {
      const [nextHandle] = await picker.call(window, { types: fileTypes, multiple: false });
      if (nextHandle) await loadFile(await nextHandle.getFile(), nextHandle);
    } catch (error) { if (!isCancelled(error)) setError("Le navigateur n’a pas autorisé l’ouverture directe. Utilise « Choisir un fichier »."); }
    finally { fileBusy.current = false; }
  };
  const inputChanged = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void loadFile(file);
  };
  const chooseMigrationCsv = () => { if (!fileBusy.current && canReplace()) csvInput.current?.click(); };
  const migrateFromCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !migration || fileBusy.current) return;
    setBusy(true); fileBusy.current = true; setError(""); setMessage("");
    try {
      if (file.size > 200_000_000) throw new Error("Le CSV dépasse 200 Mo.");
      const csv = decodeJiraCsv(await file.arrayBuffer());
      const { data, report } = completeMigrationWithCsv(migration, csv.text);
      activate(data, workspaceFilename(data.name), true);
      setMessage(`Reprise vérifiée : ${report.tickets.toLocaleString("fr-FR")} tickets et ${report.participants.toLocaleString("fr-FR")} participations. Clique sur « Enregistrer » pour conserver ton classeur complet sur ton PC.`);
    } catch (error) { setError(error instanceof Error ? error.message : "La reprise a échoué. Choisis le CSV d’origine."); }
    finally { setBusy(false); fileBusy.current = false; }
  };
  const save = async (saveAs = false, forceDownload = false) => {
    if (!active || fileBusy.current) return;
    setError(""); setMessage("");
    if (store.hasPendingForms()) { setError("Valide ou ferme la fiche personne et enregistre les modifications des marchés avant de sauvegarder le fichier."); return; }
    const picker = (window as PickerWindow).showSaveFilePicker;
    fileBusy.current = true; setBusy(true);
    try {
      let destination = saveAs ? null : handle.current;
      if (!forceDownload && !destination && picker && window.isSecureContext) {
        destination = await picker.call(window, { suggestedName: filename || workspaceFilename(store.read().name), types: fileTypes });
      }
      const snapshot = store.snapshot();
      const revision = store.version();
      if (forceDownload || !destination) {
        downloadWorkspace(await encodeWorkspace(snapshot), filename || workspaceFilename(snapshot.name));
        setDownloadRevision(revision);
        setMessage("Copie générée. Vérifie le fichier téléchargé, puis confirme sa sauvegarde ci-dessous.");
      } else {
        const expected = destination === handle.current ? expectedFile.current : undefined;
        const saved = await writeWorkspaceFile(destination, snapshot, expected);
        handle.current = destination; expectedFile.current = saved; setFilename(destination.name);
        store.markSaved(revision); setDownloadRevision(null); setMessage(`Fichier enregistré sur ton PC à ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}.`);
      }
    } catch (error) {
      if (!isCancelled(error)) setError(error instanceof Error ? error.message : "Enregistrement impossible. Le classeur reste ouvert.");
    } finally { setBusy(false); fileBusy.current = false; }
  };

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (active && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault(); event.stopImmediatePropagation(); void save(event.shiftKey);
      }
    };
    window.addEventListener("keydown", shortcut, true);
    return () => window.removeEventListener("keydown", shortcut, true);
  });

  const startNew = () => { if (!busy && canReplace()) { activate(newWorkspace(), "", true); setMessage("Nouveau classeur local. Ajoute tes marchés et personnes dans Paramètres."); } };
  return <div className="offline-shell">
    <input ref={input} className="sr-only" type="file" accept=".json,application/json" onChange={inputChanged} aria-label="Ouvrir un classeur Market Pulse"/>
    <input ref={csvInput} className="sr-only" type="file" accept=".csv,text/csv,text/plain" onChange={(event) => void migrateFromCsv(event)} aria-label="Choisir le CSV Jira pour finaliser la reprise"/>
    {active ? <>
      <header className="offline-filebar" aria-label="Fichier local">
        <div className="offline-file-identity"><span className="offline-tag">LOCAL</span><div><strong title={filename || "Classeur sans nom"}>{filename || "Classeur sans nom"}</strong><span className={store.isDirty() ? "offline-unsaved" : "offline-saved"}>{busy ? "Traitement du fichier…" : store.isDirty() ? "Modifications à enregistrer sur disque" : "Fichier à jour"}</span></div></div>
        <div className="offline-file-actions"><button type="button" onClick={open} disabled={busy}>Ouvrir</button><button type="button" className="offline-save" onClick={() => void save()} disabled={busy}>Enregistrer</button><button type="button" onClick={() => void save(true)} disabled={busy}>Enregistrer sous</button><button type="button" onClick={() => setHelpOpen((value) => !value)} aria-expanded={helpOpen}>Aide / options</button></div>
      </header>
      {helpOpen && <section className="offline-help"><h2>Un classeur sur ton PC</h2><p>« Sauvegarder la semaine » ajoute le point à l’historique du classeur. « Enregistrer » conserve tout le classeur et ses brouillons dans ton fichier. Ctrl+S enregistre le fichier ; Ctrl+Maj+S crée une autre copie.</p><p>Les imports et calculs restent locaux. Les liens Jira / Planner et l’envoi des mails nécessitent une connexion. Le fichier n’est pas chiffré : conserve-le dans un emplacement autorisé par GLOBAL. Évite de modifier la même copie sur plusieurs postes.</p><div><button type="button" onClick={() => { if (canReplace()) input.current?.click(); }} disabled={busy}>Choisir un fichier</button><button type="button" onClick={() => void save(false, true)} disabled={busy}>Télécharger une copie</button><button type="button" onClick={startNew} disabled={busy}>Nouveau classeur</button>{migration && <button type="button" onClick={chooseMigrationCsv} disabled={busy}>Reprendre les données du site avec le CSV Jira</button>}</div><small>La copie de récupération du navigateur est une sécurité supplémentaire, pas un remplacement du fichier sauvegardé.</small></section>}
      {(message || error || recoveryWarning || downloadRevision !== null) && <aside className={`offline-notice${error ? " error" : ""}`} role={error ? "alert" : "status"}>{error || message}{recoveryWarning && <small>{recoveryWarning}</small>}{downloadRevision !== null && <button type="button" onClick={() => { store.markSaved(downloadRevision); setDownloadRevision(null); setMessage("Sauvegarde de la copie confirmée."); }}>J’ai bien enregistré la copie</button>}</aside>}
      <div className="offline-app-content" inert={busy || undefined}>
        <WorkspaceErrorBoundary key={generation} onRetry={() => setGeneration((value) => value + 1)}>
          <MarketPulseApp/>
        </WorkspaceErrorBoundary>
      </div>
    </> : <main className="offline-welcome">
      <span className="offline-tag">VERSION LOCALE</span>
      <h1>Market Pulse</h1>
      <p>Ouvre ton fichier de données pour retrouver tes marchés, tes points et tes statistiques. L’outil fonctionne sans serveur.</p>
      {migration && <section className="offline-migration" aria-labelledby="migration-title">
        <h2 id="migration-title">Retrouver mes données du site</h2>
        <p>{migration.base.markets.length} marchés, {migration.base.users.length} personnes, {migration.base.points.length} points marché, {migration.base.analystPoints.length} points analystes et {migration.base.plannerTasks.length.toLocaleString("fr-FR")} tâches Planner sont prêts à reprendre.</p>
        <p>Pour compléter l’historique Jira, sélectionne le fichier déjà importé dans le site :</p>
        <strong className="offline-csv-filename">{migration.csvFilename}</strong>
        <button type="button" className="offline-save" onClick={chooseMigrationCsv} disabled={!ready || busy}>{busy ? "Vérification du CSV…" : "Choisir le CSV Jira de reprise"}</button>
        <p className="offline-migration-detail">Le contrôle attend {migration.expected.tickets.toLocaleString("fr-FR")} tickets et {migration.expected.participants.toLocaleString("fr-FR")} participations. Les données récupérées sont comparées au CSV avant l’ouverture du classeur complet.</p>
      </section>}
      <div className="offline-welcome-actions">
        <button type="button" className="offline-save" onClick={open} disabled={!ready || busy}>{busy ? "Ouverture…" : "Ouvrir mon fichier de données"}</button>
        <button type="button" onClick={startNew} disabled={!ready || busy}>Créer un classeur vide</button>
      </div>
      {recovery && <section className="offline-recovery">
        <div><strong>Une session précédente peut être reprise</strong><p>{recovery.filename || recovery.data.name} · {dateLabel(recovery.cachedAt)}{recovery.unsaved ? " · modifications non enregistrées sur disque" : ""}</p></div>
        <button type="button" onClick={() => { activate(recovery.data, recovery.filename, true); setMessage("Session récupérée. Enregistre une copie pour la conserver sur disque."); }}>Reprendre cette session</button>
      </section>}
      {!ready && <p role="status">Vérification de la copie de récupération…</p>}
      {error && <p role="alert" className="offline-error">{error}</p>}
      {recoveryWarning && <p className="offline-error">{recoveryWarning}</p>}
      <footer>
        <p>Fichier attendu : <strong>.marketpulse.json</strong></p>
        <p>Un fichier pour l’outil, un fichier pour tes données. Rien n’est envoyé en ligne par cette version.</p>
        <button type="button" onClick={() => { if (canReplace()) input.current?.click(); }} disabled={!ready || busy}>Choisir un fichier sans accès direct au disque</button>
      </footer>
    </main>}
  </div>;
}
