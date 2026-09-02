import { validateWorkspace, type WorkspaceData } from "./workspace-data";

export type RecoveryEntry = { data: WorkspaceData; filename: string; unsaved: boolean; cachedAt: string };

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("Récupération automatique indisponible. Enregistre régulièrement ton fichier."));
    const request = indexedDB.open("market-pulse-portable-v1", 1);
    const timeout = window.setTimeout(() => reject(new Error("La récupération locale ne répond pas. Tu peux ouvrir ton fichier sauvegardé.")), 6000);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains("recovery")) request.result.createObjectStore("recovery"); };
    request.onsuccess = () => { window.clearTimeout(timeout); resolve(request.result); };
    request.onerror = () => { window.clearTimeout(timeout); reject(new Error("Récupération locale indisponible. Utilise le fichier sauvegardé sur disque.")); };
    request.onblocked = () => { window.clearTimeout(timeout); reject(new Error("Ferme les autres fenêtres de l’outil puis réessaie.")); };
  });
}

export async function readRecovery() {
  const db = await database();
  return new Promise<RecoveryEntry | null>((resolve, reject) => {
    const transaction = db.transaction("recovery", "readonly");
    const request = transaction.objectStore("recovery").get("last-workspace");
    request.onsuccess = () => {
      try {
        const entry = request.result as RecoveryEntry | undefined;
        if (entry) validateWorkspace(entry.data);
        resolve(entry ?? null);
      } catch { reject(new Error("La copie de récupération est incomplète. Ouvre ton dernier fichier sauvegardé.")); }
    };
    request.onerror = () => reject(new Error("Lecture de la copie de récupération impossible."));
    transaction.oncomplete = () => db.close();
    transaction.onabort = () => { db.close(); reject(new Error("Lecture de récupération interrompue.")); };
  });
}

export async function writeRecovery(entry: RecoveryEntry) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("recovery", "readwrite");
    transaction.objectStore("recovery").put(entry, "last-workspace");
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(new Error("Copie de récupération non actualisée. Enregistre ton fichier sur disque.")); };
    transaction.onabort = () => { db.close(); reject(new Error("Copie de récupération interrompue. Enregistre ton fichier sur disque.")); };
  });
}
