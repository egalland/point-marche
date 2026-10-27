import { guardedServerRequest } from "../../../lib/access-server";
import { getRuntimeEnv } from "../../../lib/runtime-env";
export const dynamic = "force-dynamic";
async function handle(request: Request) {
  const env = getRuntimeEnv();
  if (!env) return Response.json({ error: "Gestion des accès indisponible." }, { status: 503 });
  return guardedServerRequest(request, env, async () => Response.json({ error: "Action inconnue." }, { status: 404 }));
}
export { handle as GET, handle as POST, handle as PUT, handle as DELETE };
