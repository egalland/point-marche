import { listPoints, ownerExists, publishPoint } from "../../../db/point-store";
import { isIsoDate } from "../../../lib/iso-week";
import { pointVersion } from "../../../lib/point-persistence";
import { getEditorUser } from "../../simple-auth";

const headers = { "Cache-Control": "no-store" };
export async function GET(request: Request) {
  try {
    const marketId = new URL(request.url).searchParams.get("marketId")?.trim();
    if (!marketId) return Response.json({ error: "marketId est requis" }, { status: 400, headers });
    return Response.json({ points: await listPoints("market", marketId) }, { headers });
  } catch (error) {
    console.error("Market points read failed", error);
    return Response.json({ error: "Le registre des points n’est pas disponible. Réessaie dans un instant." }, { status: 503, headers });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getEditorUser();
    if (!user) return Response.json({ error: "Connecte-toi pour enregistrer le point." }, { status: 401, headers });
    const body = await request.json();
    const marketId = typeof body?.marketId === "string" ? body.marketId.trim() : "";
    const data = body?.data;
    if (!marketId || !data || Array.isArray(data) || typeof data !== "object" || !isIsoDate(data.meetingDate)) return Response.json({ error: "Marché, date et contenu du point sont requis." }, { status: 400, headers });
    const expectedPoint = pointVersion(body.expectedPoint);
    if (expectedPoint === undefined || typeof body.draftRevision !== "string" || !body.draftRevision) return Response.json({ error: "Cette page utilise une ancienne sauvegarde. Recharge le site après avoir conservé tes modifications." }, { status: 428, headers });
    const normalized = { ...data, pointName: "Point marché", themeColor: typeof data.themeColor === "string" ? data.themeColor.trim() || "mint" : "mint" };
    if (JSON.stringify(normalized).length > 1_500_000) return Response.json({ error: "Le point est trop volumineux pour être enregistré." }, { status: 413, headers });
    if (!await ownerExists("market", marketId)) return Response.json({ error: "Marché introuvable." }, { status: 404, headers });
    const name = typeof body.marketName === "string" ? body.marketName.trim() || "Marché" : "Marché";
    const saved = await publishPoint(user.username, "market", marketId, normalized, expectedPoint, body.draftRevision, name);
    return saved ? Response.json(saved, { headers }) : Response.json({ error: "Une autre copie a été enregistrée. Tes saisies sont conservées : compare les copies avant de sauvegarder.", conflict: true }, { status: 409, headers });
  } catch (error) {
    console.error("Market point save failed", error);
    return Response.json({ error: "Enregistrement indisponible. Tes saisies restent dans cette page." }, { status: 503, headers });
  }
}
