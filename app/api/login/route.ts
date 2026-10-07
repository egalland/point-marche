import { getEditorUser } from "../../simple-auth";

// Compatibility for older tabs: no password or session cookie is required.
export async function POST() {
  return Response.json({ user: await getEditorUser() }, { headers: { "Cache-Control": "no-store" } });
}
