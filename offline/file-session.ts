import { decodeWorkspace, encodeWorkspace, type WorkspaceData } from "./workspace-data";

export type LocalFileHandle = {
  name: string;
  getFile: () => Promise<File>;
  createWritable: () => Promise<{ write: (value: Blob | string) => Promise<void>; close: () => Promise<void>; abort?: () => Promise<void> }>;
};
export type FileFingerprint = { size: number; lastModified: number };

export function fingerprint(file: Pick<File, "size" | "lastModified">): FileFingerprint {
  return { size: file.size, lastModified: file.lastModified };
}

export async function readWorkspaceFile(file: File) {
  if (file.size > 200_000_000) throw new Error("Le fichier dépasse 200 Mo.");
  return decodeWorkspace(await file.text());
}

export async function writeWorkspaceFile(handle: LocalFileHandle, data: WorkspaceData, expected?: FileFingerprint) {
  const content = await encodeWorkspace(data);
  const file = await handle.getFile();
  if (expected && (file.size !== expected.size || file.lastModified !== expected.lastModified)) throw new Error("Le fichier a été modifié ailleurs. Utilise « Enregistrer sous » pour conserver les deux copies.");
  const stream = await handle.createWritable();
  try { await stream.write(content); await stream.close(); }
  catch (error) { await stream.abort?.().catch(() => undefined); throw error; }
  const written = await handle.getFile();
  if (written.size !== new TextEncoder().encode(content).length) throw new Error("La taille du fichier sauvegardé est inattendue. Conserve le classeur ouvert et réessaie avec « Enregistrer sous ».");
  return fingerprint(written);
}

export function downloadWorkspace(content: string, name: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "application/json;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url; link.download = name; document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export function workspaceFilename(name: string) {
  const stem = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
  return `${stem || "Mes-points-marche"}.marketpulse.json`;
}
