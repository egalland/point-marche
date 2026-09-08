import { listPoints, ownerExists, publishPoint } from "../../../db/point-store";
import { isIsoDate } from "../../../lib/iso-week";
import { pointVersion } from "../../../lib/point-persistence";
import { getEditorUser } from "../../simple-auth";

const headers = { "Cache-Control": "no-store" };
export async function GET(request: Request) {
  try {
    if (!await getEditorUser()) return Response.json({ error: "Connecte-toi pour consulter les points analystes." }, { status: 401, headers });
    const analystId = new URL(request.url).searchParams.get("analystId")?.trim() ?? "";
    if (!analystId) return Response.json({ error: "analystId est requis" }, { status: 400, headers });
    return Response.json({ points: await listPoints("analyst", analystId) }, { headers });
  } catch (error) {
    console.error("Analyst points read failed", error);
    return Response.json({ error: "Le registre des points analystes n’est pas disponible. Réessaie dans un instant." }, { status: 503, headers });
  }
}

export async function POST(request: Request) {
  try {
    const editor = await getEditorUser();
    if (!editor) return Response.json({ error: "Connecte-toi pour enregistrer le point analyste." }, { status: 401, headers });
    const body = await request.json();
    const analystId = typeof body?.analystId === "string" ? body.analystId.trim() : "";
    const data = body?.data;
    if (!analystId || !data || Array.isArray(data) || typeof data !== "object" || !isIsoDate(data.meetingDate) || !isIsoDate(data.periodFrom) || !isIsoDate(data.periodTo) || data.periodFrom > data.periodTo) return Response.json({ error: "Analyste, semaine et contenu sont requis." }, { status: 400, headers });
    const expectedPoint = pointVersion(body.expectedPoint);
    if (expectedPoint === undefined || typeof body.draftRevision !== "string" || !body.draftRevision) return Response.json({ error: "Cette page utilise une ancienne sauvegarde. Recharge le site après avoir conservé tes modifications." }, { status: 428, headers });
    if (JSON.stringify(data).length > 1_500_000) return Response.json({ error: "Le point analyste est trop volumineux." }, { status: 413, headers });
    if (!await ownerExists("analyst", analystId)) return Response.json({ error: "Analyste actif introuvable dans l’annuaire GLOBAL." }, { status: 404, headers });
    const saved = await publishPoint(editor.username, "analyst", analystId, data, expectedPoint, body.draftRevision);
    return saved ? Response.json(saved, { headers }) : Response.json({ error: "Une autre copie a été enregistrée. Tes saisies sont conservées : compare les copies avant de sauvegarder.", conflict: true }, { status: 409, headers });
  } catch (error) {
    console.error("Analyst point save failed", error);
    return Response.json({ error: "Enregistrement indisponible. Tes saisies restent dans cette page." }, { status: 503, headers });
  }
}
