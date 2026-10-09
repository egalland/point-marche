import { getRuntimeEnv } from "../../../lib/runtime-env";
import { getEditorUser } from "../../simple-auth";
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
export async function POST(request: Request) {
  try {
    if (!await getEditorUser()) return Response.json({ error: "Connecte-toi pour ajouter une pièce jointe." }, { status: 401, headers });
    const bucket = getRuntimeEnv()?.FILES;
    if (!bucket) return Response.json({ error: "Le stockage des pièces jointes est indisponible." }, { status: 503, headers });
    const form = await request.formData(); const file = form.get("file");
    if (!(file instanceof File) || !file.size || file.size > 10 * 1024 * 1024) return Response.json({ error: "Choisis un fichier non vide de 10 Mo maximum." }, { status: 400, headers });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71 ? "image/png" : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? "image/jpeg" : "application/octet-stream";
    const id = crypto.randomUUID(); const name = file.name.replace(/[\r\n]/g, "").slice(0, 240);
    await bucket.put(`point-assets/${id}`, bytes, { httpMetadata: { contentType: type }, customMetadata: { name } });
    return Response.json({ asset: { id, name, type, size: file.size, url: `/api/point-assets?id=${id}` } }, { status: 201, headers });
  } catch (error) { console.error("Point asset upload failed", error); return Response.json({ error: "Enregistrement du fichier impossible. Réessaie." }, { status: 503, headers }); }
}
export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id") ?? "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) return new Response("Fichier introuvable", { status: 404, headers });
    const bucket = getRuntimeEnv()?.FILES;
    if (!bucket) return new Response("Stockage indisponible", { status: 503, headers });
    const file = await bucket.get(`point-assets/${id}`);
    if (!file) return new Response("Fichier introuvable", { status: 404, headers });
    const type = file.httpMetadata?.contentType ?? "application/octet-stream";
    const inline = type === "image/png" || type === "image/jpeg";
    return new Response(file.body, { headers: { ...headers, "Content-Type": type, "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.customMetadata?.name ?? "piece-jointe")}`, "Content-Security-Policy": "default-src 'none'; sandbox" } });
  } catch (error) { console.error("Point asset read failed", error); return new Response("Lecture impossible", { status: 503, headers }); }
}
