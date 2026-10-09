import { getEditorUser } from "../../simple-auth";
import { ownerExists, readDraft, saveDraft } from "../../../db/point-store";
import { isIsoDate } from "../../../lib/iso-week";
import { pointVersion } from "../../../lib/point-persistence";

const noStore = { "Cache-Control": "no-store" };
export async function GET(request: Request) {
  try {
    const editor = await getEditorUser();
    if (!editor) return Response.json({ error: "Connecte-toi pour reprendre les brouillons." }, { status: 401, headers: noStore });
    const params = new URL(request.url).searchParams;
    const scope = params.get("scope"), ownerId = params.get("ownerId"), date = params.get("meetingDate");
    if ((scope !== "market" && scope !== "analyst") || !ownerId || (date !== null && !isIsoDate(date))) return Response.json({ error: "Point invalide." }, { status: 400, headers: noStore });
    return Response.json(await readDraft(editor.username, scope, ownerId, date ?? undefined), { headers: noStore });
  } catch (error) {
    console.error("Draft read failed", error);
    return Response.json({ error: "Brouillons indisponibles. Réessaie sans fermer cette page." }, { status: 503, headers: noStore });
  }
}

export async function PUT(request: Request) {
  try {
    const editor = await getEditorUser();
    if (!editor) return Response.json({ error: "Session expirée. Reconnecte-toi pour sauvegarder le brouillon." }, { status: 401, headers: noStore });
    const body = await request.json();
    const { scope, ownerId, data, expectedRevision } = body ?? {};
    const basePoint = pointVersion(body?.basePoint);
    if ((scope !== "market" && scope !== "analyst") || typeof ownerId !== "string" || !ownerId || !data || Array.isArray(data) || typeof data !== "object" || !isIsoDate(data.meetingDate) || basePoint === undefined || !(expectedRevision === null || (typeof expectedRevision === "string" && expectedRevision))) return Response.json({ error: "Brouillon invalide." }, { status: 400, headers: noStore });
    if (JSON.stringify(data).length > 1_500_000) return Response.json({ error: "Brouillon trop volumineux." }, { status: 413, headers: noStore });
    if (!await ownerExists(scope, ownerId)) return Response.json({ error: "Marché ou analyste introuvable." }, { status: 404, headers: noStore });
    const draft = await saveDraft(editor.username, scope, ownerId, data, expectedRevision, basePoint);
    return draft ? Response.json({ draft }, { headers: noStore }) : Response.json({ error: "Une autre copie a été enregistrée. Compare les copies avant de poursuivre.", conflict: true }, { status: 409, headers: noStore });
  } catch (error) {
    console.error("Draft write failed", error);
    return Response.json({ error: "Sauvegarde automatique interrompue. Tes saisies restent dans cette page." }, { status: 503, headers: noStore });
  }
}
