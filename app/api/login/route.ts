import { createEditorSession, editorAuthConfigured, editorSessionCookie, validateEditorCredentials } from "../../simple-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!editorAuthConfigured()) {
    return Response.json({ error: "La connexion d’édition n’est pas encore configurée." }, { status: 503 });
  }
  const body = await request.json().catch(() => ({})) as { username?: unknown; password?: unknown };
  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!await validateEditorCredentials(username, password)) {
    return Response.json({ error: "Compte ou mot de passe incorrect." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const token = await createEditorSession(username.trim());
  return Response.json({ user: { displayName: "Compte GLOBAL", username: username.trim() } }, {
    headers: { "Cache-Control": "no-store", "Set-Cookie": editorSessionCookie(token) },
  });
}
