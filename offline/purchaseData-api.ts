import { inspectPURCHASES, purchaseDataSummary, type PURCHASESRow } from "../lib/purchaseData";
import { PURCHASES_MAX_BYTES } from "../lib/purchaseData-import";
import type { WorkspaceStore } from "./workspace-store";

// One record keeps rows and metadata atomic, including shared-folder conflict resolution.
const key = "purchaseData-source";
type Snapshot = { rows: PURCHASESRow[]; updatedAt: string; metadata: Record<string, unknown> };
export async function localPURCHASES(request: Request, store: WorkspaceStore) {
  if (request.method === "GET") {
    const saved = store.readPreference(key);
    const snapshot: Snapshot = saved ? JSON.parse(saved) : { rows: [], updatedAt: "", metadata: { count: 0, ...purchaseDataSummary([]) } };
    return Response.json(new URL(request.url).searchParams.get("summary") === "1" ? { metadata: snapshot.metadata } : snapshot);
  }
  if (request.method !== "POST") return Response.json({ error: "Méthode non prise en charge." }, { status: 405 });
  let text = "", filename = "Collage texte", sheet = "";
  if (request.headers.get("Content-Type")?.includes("multipart/form-data")) {
    const form = await request.formData(), file = form.get("file");
    if (!(file instanceof File)) throw Error("Fichier texte absent.");
    if (file.size > PURCHASES_MAX_BYTES) return Response.json({ error: "Extraction trop volumineuse : maximum 32 Mio." }, { status: 413 });
    text = await file.text(); filename = String(form.get("filename") || file.name).slice(0, 250); sheet = String(form.get("sheet") || "").slice(0, 150);
  } else {
    const body = await request.json() as { text?: unknown; filename?: unknown; sheet?: unknown };
    if (typeof body.text !== "string") throw Error("Extraction texte absente.");
    text = body.text; filename = String(body.filename || filename).slice(0, 250); sheet = String(body.sheet || "").slice(0, 150);
  }
  if (new TextEncoder().encode(text).length > PURCHASES_MAX_BYTES) return Response.json({ error: "Extraction trop volumineuse : maximum 32 Mio." }, { status: 413 });
  const parsed = inspectPURCHASES(text);
  if (parsed.rejected) return Response.json({ error: `${parsed.rejected} ligne(s) invalide(s). Le registre précédent est conservé.`, issues: parsed.issues }, { status: 422 });
  const updatedAt = new Date().toISOString();
  const metadata = { ...purchaseDataSummary(parsed.rows), updatedAt, count: parsed.rows.length, sourceCount: parsed.sourceCount, duplicates: parsed.duplicates, rejected: 0, filename, sheet };
  store.writePreference(key, JSON.stringify({ rows: parsed.rows, updatedAt, metadata }));
  return Response.json({ ...metadata, mode: "replace" });
}
