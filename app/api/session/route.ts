import { getEditorUser } from "../../simple-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getEditorUser();
  return Response.json({ user }, { headers: { "Cache-Control": "no-store" } });
}
