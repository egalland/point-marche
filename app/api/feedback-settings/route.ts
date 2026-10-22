import { getRuntimeEnv } from "@/lib/runtime-env";
import { validFeedbackRecipients } from "@/lib/feedback";
import { getEditorUser } from "../../simple-auth";

const key = "application-settings/feedback.json";
export async function GET() {
  try {
    const bucket = getRuntimeEnv()?.FILES;
    if (!bucket) throw new Error();
    const file = await bucket.get(key);
    const settings = file ? await new Response(file.body).json() as { email?: unknown } : {};
    return Response.json({ email: typeof settings.email === "string" ? settings.email : "" }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Impossible de charger l’adresse de contact." }, { status: 503 }); }
}
export async function PUT(request: Request) {
  try {
    if (!await getEditorUser()) return Response.json({ error: "Accès refusé." }, { status: 401 });
    const body = await request.json() as { email?: unknown };
    const email = typeof body.email === "string" ? body.email.trim() : "";
    if (typeof body.email !== "string" || (email && !validFeedbackRecipients(email))) return Response.json({ error: "Adresse mail invalide." }, { status: 400 });
    const bucket = getRuntimeEnv()?.FILES;
    if (!bucket) throw new Error();
    await bucket.put(key, new TextEncoder().encode(JSON.stringify({ email })), { httpMetadata: { contentType: "application/json" }, customMetadata: { name: "Contact bugs et idées" } });
    return Response.json({ email });
  } catch { return Response.json({ error: "Adresse non enregistrée. Réessaie." }, { status: 503 }); }
}
