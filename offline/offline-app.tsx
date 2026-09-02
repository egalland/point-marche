import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { MarketPulseApp } from "../features/market-pulse/market-pulse-app";
import { AppDialog } from "../components/app-dialog";
import { AppIcon } from "../components/app-icon";
import { installLocalTransport } from "../lib/app-transport";
import { createLocalApi } from "./local-api";
import { WorkspaceStore } from "./workspace-store";
import { decodeWorkspace, encodeWorkspace, isEmptyStarterWorkspace, newWorkspace, type WorkspaceData } from "./workspace-data";
import { downloadWorkspace, fingerprint, readWorkspaceFile, workspaceFilename, writeWorkspaceFile, type FileFingerprint, type LocalFileHandle } from "./file-session";
import { readRecovery, writeRecovery } from "./recovery-cache";
import { WorkspaceErrorBoundary } from "./workspace-error-boundary";
import { decodeJiraCsv } from "../lib/jira-csv";
import { completeMigrationInWorkspace, decodeMigrationCheckpoint, openMigrationWorkspace, type MigrationCheckpoint } from "./migration-data";

type PickerWindow = Window & {
  showOpenFilePicker?: (options: unknown) => Promise<LocalFileHandle[]>;
  showSaveFilePicker?: (options: unknown) => Promise<LocalFileHandle>;
};
const fileTypes = [{ description: "Classeur Market Pulse", accept: { "application/json": [".json"] } }];
const isCancelled = (error: unknown) => error instanceof DOMException && error.name === "AbortError";

export function OfflineApp() {
  const [store] = useState(() => new WorkspaceStore());
  const [active, setActive] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [recoveryWarning, setRecoveryWarning] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [filename, setFilename] = useState("");
  const [generation, setGeneration] = useState(0);
  const [tick, setTick] = useState(0);
  const [downloadRevision, setDownloadRevision] = useState<number | null>(null);
  const [migration, setMigration] = useState<MigrationCheckpoint | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const csvInput = useRef<HTMLInputElement>(null);
  const handle = useRef<LocalFileHandle | null>(null);
  const expectedFile = useRef<FileFingerprint | undefined>(undefined);
  const recoveryQueue = useRef<Promise<void>>(Promise.resolve());
  const fileBusy = useRef(false);
  const recoveryWritable = useRef(true);
  const migrationRef = useRef<MigrationCheckpoint | null>(null);
  const seed = useRef<WorkspaceData | null>(null);
  const saveCurrent = useRef<(saveAs?: boolean) => Promise<boolean>>(async () => false);

  const finishMigration = (csv: string) => {
    const checkpoint = migrationRef.current;
    if (!checkpoint) throw new Error("La copie de reprise Jira est absente de cette application.");
    const { data } = completeMigrationInWorkspace(checkpoint, store.read(), csv);
    store.update(() => data);
  };
  const activate = (data: WorkspaceData, name: string, unsaved: boolean, nextHandle: LocalFileHandle | null = null, expected?: FileFingerprint) => {
    store.replace(data);
    installLocalTransport(createLocalApi(store), {
      read: store.readDraft, write: store.writeDraft,
      pending: (key, value) => store.setPendingForm(key, value),
      readPreference: store.readPreference, writePreference: store.writePreference,
      openFiles: () => setFilesOpen(true), saveFile: (saveAs) => saveCurrent.current(saveAs),
      migrationRequired: () => Boolean(store.read().source?.pendingJira), completeMigration: finishMigration,
    });
    handle.current = nextHandle;
    expectedFile.current = expected;
    setFilename(name || workspaceFilename(data.name));
    setGeneration((value) => value + 1); setActive(true); setDownloadRevision(null);
    if (unsaved) store.markUnsaved();
  };

  useEffect(() => store.subscribe(() => setTick((value) => value + 1)), [store]);
  useEffect(() => {
    let mounted = true;
    const loadInitial = async () => {
      const recoveryTask = readRecovery().catch((error) => { if (mounted) { recoveryWritable.current = false; setRecoveryWarning(error.message); } return null; });
      const seedTask = async () => {
        const checkpointText = document.getElementById("market-pulse-migration")?.textContent;
        const workspaceText = document.getElementById("market-pulse-workspace")?.textContent;
        if (checkpointText) {
          const checkpoint = await decodeMigrationCheckpoint(checkpointText);
          if (mounted) { migrationRef.current = checkpoint; setMigration(checkpoint); }
          return openMigrationWorkspace(checkpoint);
        }
        return workspaceText ? decodeWorkspace(workspaceText) : null;
      };
      const [recovery, embedded] = await Promise.all([recoveryTask, seedTask().catch((error) => { if (mounted) { setError(error.message); setFilesOpen(true); } return null; })]);
      if (!mounted) return;
      seed.current = embedded;
      if (recovery && (!embedded || !isEmptyStarterWorkspace(recovery.data))) activate(recovery.data, recovery.filename, recovery.unsaved);
      else activate(embedded ?? newWorkspace(), "", false);
      if (store.read().source?.pendingJira) setMessage("Tes points sont ouverts. Pour compléter l’historique Jira, sélectionne le CSV d’origine dans le Centre d’import.");
    };
    void loadInitial().catch((error) => {
      if (!mounted) return;
      setError(error instanceof Error ? error.message : "Ouverture des données impossible.");
      activate(newWorkspace(), "", false); setFilesOpen(true);
    });
    return () => { mounted = false; };
    // The embedded file is read once; later file switches reinstall the local bridge.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!active || !recoveryWritable.current) return;
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
  useEffect(() => {
    if (!message || filesOpen) return;
    const timer = window.setTimeout(() => setMessage(""), 12000);
    return () => window.clearTimeout(timer);
  }, [message, filesOpen]);

  const canReplace = () => !store.isDirty() || window.confirm("Le fichier contient des modifications non enregistrées sur disque. Continuer sans les enregistrer ?");
  const fail = (error: unknown, fallback: string) => { setError(error instanceof Error ? error.message : fallback); setFilesOpen(true); };
  const loadFile = async (file: File, nextHandle: LocalFileHandle | null = null) => {
    setBusy(true); fileBusy.current = true; setError("");
    try {
      const data = await readWorkspaceFile(file);
      recoveryWritable.current = true;
      activate(data, file.name, false, nextHandle, nextHandle ? fingerprint(file) : undefined);
      setFilesOpen(false); setMessage("Fichier ouvert.");
    } catch (error) { fail(error, "Ouverture impossible. Le fichier précédent reste intact."); }
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
    } catch (error) {
      if (!isCancelled(error)) fail(new Error("L’ouverture directe a été refusée. Utilise « Choisir un fichier » ci-dessous."), "Ouverture impossible.");
    } finally { fileBusy.current = false; }
  };
  const inputChanged = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = "";
    if (file) void loadFile(file);
  };
  const migrateFromCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file || !migration || fileBusy.current) return;
    setBusy(true); fileBusy.current = true; setError(""); setMessage("");
    try {
      if (file.size > 200_000_000) throw new Error("Le CSV dépasse 200 Mo.");
      finishMigration(decodeJiraCsv(await file.arrayBuffer()).text);
      setGeneration((value) => value + 1);
      setMessage("Historique Jira complet et vérifié. Enregistre le fichier pour le conserver sur ton PC.");
    } catch (error) { fail(error, "La reprise a échoué. Choisis le CSV d’origine."); }
    finally { setBusy(false); fileBusy.current = false; }
  };
  const save = async (saveAs = false, forceDownload = false): Promise<boolean> => {
    if (!active || fileBusy.current) return false;
    setError(""); setMessage("");
    if (store.hasPendingForms()) { fail(new Error("Valide ou ferme la fiche personne et enregistre les modifications des marchés avant de sauvegarder le fichier."), "Fiche en cours."); return false; }
    const picker = (window as PickerWindow).showSaveFilePicker;
    fileBusy.current = true; setBusy(true);
    try {
      let destination = saveAs ? null : handle.current;
      if (!forceDownload && !destination && picker && window.isSecureContext) destination = await picker.call(window, { suggestedName: filename || workspaceFilename(store.read().name), types: fileTypes });
      const snapshot = store.snapshot(); const revision = store.version();
      if (forceDownload || !destination) {
        downloadWorkspace(await encodeWorkspace(snapshot), filename || workspaceFilename(snapshot.name));
        setDownloadRevision(revision); setFilesOpen(true);
        setMessage("Copie générée. Vérifie le téléchargement, puis confirme son enregistrement.");
        return false;
      }
      const expected = destination === handle.current ? expectedFile.current : undefined;
      const saved = await writeWorkspaceFile(destination, snapshot, expected);
      recoveryWritable.current = true;
      handle.current = destination; expectedFile.current = saved; setFilename(destination.name);
      store.markSaved(revision); setDownloadRevision(null);
      setMessage(`Fichier enregistré à ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}.`);
      return true;
    } catch (error) {
      if (!isCancelled(error)) fail(error, "Enregistrement impossible. Le fichier reste ouvert.");
      return false;
    } finally { setBusy(false); fileBusy.current = false; }
  };
  saveCurrent.current = save;

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (!active || !(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key !== "s" && key !== "o") return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (key === "s") void save(event.shiftKey); else void open();
    };
    window.addEventListener("keydown", shortcut, true);
    return () => window.removeEventListener("keydown", shortcut, true);
  });

  const pending = store.read().source?.pendingJira;
  return <>
    <input ref={input} className="sr-only" type="file" accept=".json,application/json" onChange={inputChanged} aria-label="Ouvrir un fichier Market Pulse"/>
    <input ref={csvInput} className="sr-only" type="file" accept=".csv,text/csv,text/plain" onChange={(event) => void migrateFromCsv(event)} aria-label="Choisir le CSV Jira de reprise"/>
    {active ? <WorkspaceErrorBoundary key={generation} onRetry={() => setGeneration((value) => value + 1)} onFiles={() => setFilesOpen(true)}><MarketPulseApp/></WorkspaceErrorBoundary> : <p className="local-startup" role="status">Ouverture de tes points…</p>}
    {message && !filesOpen && <div className="toast local-file-notice" role="status"><span>{message}</span><button type="button" onClick={() => setMessage("")} aria-label="Fermer la notification">×</button></div>}
    <AppDialog open={filesOpen} onClose={() => { if (!busy) setFilesOpen(false); }} busy={busy} labelledBy="local-file-title" className="local-file-dialog">
      <div className="dialog-heading"><span className="login-emblem"><AppIcon name="download" size={22}/></span><div><span>Market Pulse</span><h2 id="local-file-title">Fichier local</h2><p>Ouvrir et enregistrer tes données sur ce PC.</p></div></div>
      <div className="local-file-status"><strong>{filename}</strong><span>{busy ? "Traitement du fichier…" : store.isDirty() ? "Modifications à enregistrer" : handle.current ? "Fichier à jour" : "Copie ouverte dans l’application"}</span></div>
      <div className="local-file-actions">
        <button type="button" className="primary-button" onClick={() => void save()} disabled={busy || !active}><AppIcon name="check"/>Enregistrer <kbd>Ctrl+S</kbd></button>
        <button type="button" className="secondary-button" onClick={() => void save(true)} disabled={busy || !active}>Enregistrer sous <kbd>Ctrl+Maj+S</kbd></button>
        <button type="button" className="secondary-button" onClick={() => void open()} disabled={busy}>Ouvrir un fichier <kbd>Ctrl+O</kbd></button>
      </div>
      {(error || message || downloadRevision !== null) && <div className={`import-quality-alert ${error ? "danger" : "ok"}`} role={error ? "alert" : "status"}><span>{error || message}</span>{downloadRevision !== null && <button type="button" className="secondary-button" onClick={() => { store.markSaved(downloadRevision); setDownloadRevision(null); setMessage("Enregistrement de la copie confirmé."); }}>J’ai bien enregistré la copie</button>}</div>}
      {pending && <section className="local-file-migration"><h3>Compléter l’historique Jira</h3><p>Les points sauvegardés, les marchés, les personnes et Planner sont repris. Le registre Jira attend encore {pending.expectedTickets - pending.recoveredTickets} tickets et {pending.expectedParticipants - pending.recoveredParticipants} participations.</p><strong>{pending.csvFilename}</strong><p>Tu peux sélectionner ce fichier dans le Centre d’import habituel ou ici. Le contrôle conserve tes modifications locales.</p><button type="button" className="secondary-button" onClick={() => csvInput.current?.click()} disabled={busy || !migration}>Choisir le CSV Jira de reprise</button></section>}
      <details className="local-file-options"><summary>Autres options</summary><div>
        <button type="button" className="secondary-button" onClick={() => { if (canReplace()) input.current?.click(); }} disabled={busy}>Choisir un fichier</button>
        <button type="button" className="secondary-button" onClick={() => void save(false, true)} disabled={busy || !active}>Télécharger une copie</button>
        {seed.current && <button type="button" className="secondary-button" onClick={() => { if (!busy && canReplace() && seed.current) { activate(seed.current, "", false); setFilesOpen(false); } }} disabled={busy}>Rouvrir la copie du site</button>}
        <button type="button" className="secondary-button" onClick={() => { if (!busy && canReplace()) { activate(newWorkspace(), "", true); setFilesOpen(false); } }} disabled={busy}>Nouveau fichier vide</button>
      </div><p>La session se rouvre automatiquement sur ce navigateur. Pour transférer ton travail, conserve l’application HTML et ton fichier .marketpulse.json.</p></details>
      {recoveryWarning && <p className="local-file-warning" role="status">{recoveryWarning}</p>}
    </AppDialog>
  </>;
}
