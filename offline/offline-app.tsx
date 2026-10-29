import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { MarketPulseApp } from "../features/market-pulse/market-pulse-app";
import { AppDialog } from "../components/app-dialog";
import { LocalSyncContext } from "../components/local-sync-context";
import { AppIcon } from "../components/app-icon";
import { installLocalTransport } from "../lib/app-transport";
import { createLocalApi } from "./local-api";
import { WorkspaceStore } from "./workspace-store";
import { decodeWorkspace, encodeWorkspace, isEmptyStarterWorkspace, newWorkspace, type WorkspaceData } from "./workspace-data";
import { downloadWorkspace, fingerprint, readWorkspaceFile, workspaceFilename, writeWorkspaceFile, type FileFingerprint, type LocalFileHandle } from "./file-session";
import { readRecovery, writeRecovery } from "./recovery-cache";
import { SharedWorkspaceSession, type SharedDirectory, type SharedState } from "./shared-workspace";
import { WorkspaceErrorBoundary } from "./workspace-error-boundary";

type PickerWindow = Window & {
  showDirectoryPicker?: (options: unknown) => Promise<SharedDirectory>;
  showOpenFilePicker?: (options: unknown) => Promise<LocalFileHandle[]>;
  showSaveFilePicker?: (options: unknown) => Promise<LocalFileHandle>;
};
const fileTypes = [{ description: "Classeur Market Pulse", accept: { "application/json": [".json"] } }];
const isCancelled = (error: unknown) => error instanceof DOMException && error.name === "AbortError";

export function OfflineApp() {
  const [store] = useState(() => new WorkspaceStore());
  const [shared, setShared] = useState<SharedState | null>(null);
  const [sharedName, setSharedName] = useState("");
  const sharedSession = useRef<SharedWorkspaceSession | null>(null);
  const sharedTimer = useRef<number | null>(null);
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
  const input = useRef<HTMLInputElement>(null);
  const handle = useRef<LocalFileHandle | null>(null);
  const expectedFile = useRef<FileFingerprint | undefined>(undefined);
  const recoveryQueue = useRef<Promise<void>>(Promise.resolve());
  const fileBusy = useRef(false);
  const recoveryWritable = useRef(true);
  const seed = useRef<WorkspaceData | null>(null);
  const saveCurrent = useRef<(saveAs?: boolean) => Promise<boolean>>(async () => false);

  const disconnectShared = () => {
    sharedSession.current?.stop(); sharedSession.current = null;
    if (sharedTimer.current !== null) window.clearInterval(sharedTimer.current);
    sharedTimer.current = null; setShared(null); setSharedName("");
  };
  useEffect(() => () => { sharedSession.current?.stop(); if (sharedTimer.current !== null) window.clearInterval(sharedTimer.current); }, []);

  const activate = (data: WorkspaceData, name: string, unsaved: boolean, nextHandle: LocalFileHandle | null = null, expected?: FileFingerprint) => {
    disconnectShared();
    store.replace(data);
    installLocalTransport(createLocalApi(store), {
      read: store.readDraft, write: store.writeDraft,
      pending: (key, value) => store.setPendingForm(key, value),
      readPreference: store.readPreference, writePreference: store.writePreference,
      openFiles: () => setFilesOpen(true), saveFile: (saveAs) => saveCurrent.current(saveAs),
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
        const workspaceText = document.getElementById("market-pulse-workspace")?.textContent;
        return workspaceText ? decodeWorkspace(workspaceText) : null;
      };
      const [recovery, embedded] = await Promise.all([recoveryTask, seedTask().catch((error) => { if (mounted) { setError(error.message); setFilesOpen(true); } return null; })]);
      if (!mounted) return;
      seed.current = embedded;
      if (recovery && (!embedded || !isEmptyStarterWorkspace(recovery.data))) activate(recovery.data, recovery.filename, recovery.unsaved);
      else activate(embedded ?? newWorkspace(), "", false);
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
  const save = async (saveAs = false, forceDownload = false): Promise<boolean> => {
    if (!active || fileBusy.current) return false;
    setError(""); setMessage("");
    if (sharedSession.current && !saveAs && !forceDownload) return sharedSession.current.sync();
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
      disconnectShared();
      handle.current = destination; expectedFile.current = saved; setFilename(destination.name);
      store.markSaved(revision); setDownloadRevision(null);
      setMessage(`Fichier enregistré à ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}.`);
      return true;
    } catch (error) {
      if (!isCancelled(error)) fail(error, "Enregistrement impossible. Le fichier reste ouvert.");
      return false;
    } finally { setBusy(false); fileBusy.current = false; }
  };
  const connectShared = async () => {
    if (fileBusy.current || sharedSession.current || !canReplace()) return;
    const picker = (window as PickerWindow).showDirectoryPicker;
    if (!picker || !window.isSecureContext) { setError("Ce navigateur ne permet pas le partage de dossier. Utilise Chrome ou Edge sur ordinateur et autorise l’accès au dossier ; le fichier local classique reste disponible."); return; }
    setBusy(true); fileBusy.current = true; setError("");
    try {
      const directory = await picker.call(window, { mode: "readwrite", id: "market-pulse-shared" });
      const session = new SharedWorkspaceSession(directory, store, `Session ${crypto.randomUUID().slice(0, 8)}`, setShared, () => setGeneration(value => value + 1), () => !!document.activeElement?.closest('input,textarea,select,[contenteditable="true"]'));
      sharedSession.current = session; setSharedName(directory.name);
      handle.current = null; expectedFile.current = undefined;
      await session.sync();
      sharedTimer.current = window.setInterval(() => { if (!fileBusy.current) void session.sync(); }, 3000);
      setFilesOpen(false);
    } catch (error) { if (!isCancelled(error)) fail(error, "Connexion au dossier impossible. Tes données restent ouvertes."); }
    finally { setBusy(false); fileBusy.current = false; }
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

  return <>
    <input ref={input} className="sr-only" type="file" accept=".json,application/json" onChange={inputChanged} aria-label="Ouvrir un fichier Market Pulse"/>
    <div inert={busy}>
    {active ? <WorkspaceErrorBoundary key={generation} onRetry={() => setGeneration((value) => value + 1)} onFiles={() => setFilesOpen(true)}><LocalSyncContext.Provider value={shared ? { status: shared.status, folder: sharedName, message: shared.message, conflicts: shared.conflicts.length } : null}><MarketPulseApp/></LocalSyncContext.Provider></WorkspaceErrorBoundary> : <p className="local-startup" role="status">Ouverture de tes points…</p>}
    </div>
    {message && !filesOpen && <div className="toast local-file-notice" role="status"><span>{message}</span><button type="button" onClick={() => setMessage("")} aria-label="Fermer la notification">×</button></div>}
    <AppDialog open={filesOpen} onClose={() => { if (!busy) setFilesOpen(false); }} busy={busy} labelledBy="local-file-title" className="local-file-dialog">
      <div className="dialog-heading"><span className="login-emblem"><AppIcon name="download" size={22}/></span><div><span>Market Pulse</span><h2 id="local-file-title">Fichier local</h2><p>Ouvrir un classeur ou rejoindre le même dossier réseau que les autres personnes.</p></div></div>
      <div className="local-file-status"><strong>{shared ? sharedName : filename}</strong><span>{shared ? shared.message : busy ? "Traitement du fichier…" : store.isDirty() ? "Modifications à enregistrer" : handle.current ? "Fichier à jour" : "Copie ouverte dans l’application"}</span></div>
      <div className="local-file-actions">
        <button type="button" className="primary-button" onClick={() => void save()} disabled={busy || !active}><AppIcon name="check"/>Enregistrer <kbd>Ctrl+S</kbd></button>
        <button type="button" className="secondary-button" onClick={() => void save(true)} disabled={busy || !active}>Enregistrer sous <kbd>Ctrl+Maj+S</kbd></button>
        <button type="button" className="secondary-button" onClick={() => void open()} disabled={busy}>Ouvrir un fichier <kbd>Ctrl+O</kbd></button>
      </div>
      <section className="local-share-panel"><h3>Travail à plusieurs</h3><p>Chacun ouvre ce même HTML et rejoint le même dossier partagé. Les changements se synchronisent toutes les 3 secondes après la saisie. Un dossier vide est initialisé avec les données ouvertes ; rejoindre un dossier existant charge ses données.</p>
        {shared ? <><strong>{sharedName}</strong><p>{shared.message}{shared.lastSync ? ` · Dernière vérification : ${new Date(shared.lastSync).toLocaleTimeString("fr-FR")}` : ""}</p><div className="local-file-actions"><button type="button" className="secondary-button" onClick={() => void sharedSession.current?.sync()} disabled={busy}>Réessayer / actualiser</button><button type="button" className="secondary-button" onClick={() => { disconnectShared(); store.markUnsaved(); }} disabled={busy}>Déconnecter le dossier</button></div>
        {shared.conflicts.map(conflict => <article className="local-share-conflict" key={conflict.key}><strong>{conflict.label}</strong><p>Les versions restent conservées dans le journal. Vérifie leur contenu puis choisis celle à utiliser.</p>{conflict.choices.map(choice => <div key={choice.id}><details><summary>{choice.author} · {new Date(choice.at).toLocaleString("fr-FR")}{choice.deleted ? " · suppression" : ""}</summary><pre>{choice.deleted ? "Élément supprimé" : JSON.stringify(choice.value, null, 2)}</pre></details><button type="button" className="secondary-button" onClick={() => void sharedSession.current?.resolve(conflict.key, choice.id)}>Utiliser cette version</button></div>)}</article>)}
        </> : <button type="button" className="secondary-button" onClick={() => void connectShared()} disabled={busy || !active}>Rejoindre / créer un dossier partagé</button>}
        <p>Autorise la lecture et l’écriture dans un dossier dédié. Ne supprime pas les fichiers point-sync : ils conservent l’historique et les versions concurrentes. En cas de réseau indisponible, garde la page ouverte ou télécharge une copie. À la réouverture du HTML, reconnecte le dossier.</p>
      </section>
      {(error || message || downloadRevision !== null) && <div className={`import-quality-alert ${error ? "danger" : "ok"}`} role={error ? "alert" : "status"}><span>{error || message}</span>{downloadRevision !== null && <button type="button" className="secondary-button" onClick={() => { store.markSaved(downloadRevision); setDownloadRevision(null); setMessage("Enregistrement de la copie confirmé."); }}>J’ai bien enregistré la copie</button>}</div>}
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
