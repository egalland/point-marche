import { clearedEditorSessionCookie } from "../../simple-auth";

export async function POST() {
  return Response.json({ ok: true }, {
    headers: { "Cache-Control": "no-store", "Set-Cookie": clearedEditorSessionCookie() },
  });
}
