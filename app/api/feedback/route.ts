import { getRuntimeEnv } from "@/lib/runtime-env";
import { feedbackSummary, parseFeedbackRequest, updateFeedbackStatus, type FeedbackRequest, type FeedbackSummary } from "@/lib/feedback";
import { getEditorUser } from "../../simple-auth";

const metadata = { httpMetadata: { contentType: "application/json" }, customMetadata: { name: "Bugs et idées" } };
export async function GET(request: Request) {
  try {
    if (!await getEditorUser()) return Response.json({ error: "Accès refusé." }, { status: 401 });
    const bucket = getRuntimeEnv()?.FILES;
    if (!bucket) throw new Error();
    const id = new URL(request.url).searchParams.get("id");
    if (id) {
      if (!/^[a-f0-9-]{36}$/i.test(id)) return Response.json({ error: "Identifiant invalide." }, { status: 400 });
      const file = await bucket.get(`feedback/items/${id}.json`);
      return file ? Response.json({ item: await new Response(file.body).json() }, { headers: { "Cache-Control": "no-store" } }) : Response.json({ error: "Demande introuvable." }, { status: 404 });
    }
    const summaries: FeedbackSummary[] = [];
    let cursor: string | undefined;
    do {
      const page = await bucket.list({ prefix: "feedback/summaries/", cursor });
      for (const object of page.objects) {
        const file = await bucket.get(object.key);
        if (file) summaries.push(await new Response(file.body).json() as FeedbackSummary);
      }
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
    return Response.json({ items: summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Impossible de charger la boîte Bugs & idées." }, { status: 503 }); }
}
export async function POST(request: Request) {
  try {
    if (!await getEditorUser()) return Response.json({ error: "Accès refusé." }, { status: 401 });
    const raw = await request.text();
    if (raw.length > 8500000) return Response.json({ error: "Demande trop volumineuse." }, { status: 413 });
    let item;
    try { item = parseFeedbackRequest(JSON.parse(raw)); }
    catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Demande invalide." }, { status: 400 }); }
    const bucket = getRuntimeEnv()?.FILES;
    if (!bucket) throw new Error();
    const existing = await bucket.get(`feedback/items/${item.id}.json`);
    if (existing) {
      const original = await new Response(existing.body).json() as FeedbackRequest;
      const summary = feedbackSummary(original);
      await bucket.put(`feedback/summaries/${item.id}.json`, new TextEncoder().encode(JSON.stringify(summary)), metadata);
      return Response.json({ item: summary });
    }
    await bucket.put(`feedback/items/${item.id}.json`, new TextEncoder().encode(JSON.stringify(item)), metadata);
    const summary = feedbackSummary(item);
    await bucket.put(`feedback/summaries/${item.id}.json`, new TextEncoder().encode(JSON.stringify(summary)), metadata);
    return Response.json({ item: summary }, { status: 201 });
  } catch { return Response.json({ error: "Demande non enregistrée. Le formulaire est conservé ; réessaie." }, { status: 503 }); }
}

export async function PATCH(request: Request) {
  try {
    if (!await getEditorUser()) return Response.json({ error: "Accès refusé." }, { status: 401 });
    const body = await request.json() as { id?: string; status?: unknown; by?: unknown; expectedUpdatedAt?: unknown };
    if (!body.id || !/^[a-f0-9-]{36}$/i.test(body.id)) return Response.json({ error: "Identifiant invalide." }, { status: 400 });
    const bucket = getRuntimeEnv()?.FILES;
    if (!bucket) throw new Error();
    const file = await bucket.get(`feedback/items/${body.id}.json`);
    if (!file) return Response.json({ error: "Demande introuvable." }, { status: 404 });
    const previous = await new Response(file.body).json() as FeedbackRequest;
    let item;
    try { item = updateFeedbackStatus(previous, body.status, body.by, body.expectedUpdatedAt); }
    catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Modification impossible." }, { status: body.expectedUpdatedAt !== previous.updatedAt ? 409 : 400 }); }
    const stored = await bucket.put(`feedback/items/${item.id}.json`, new TextEncoder().encode(JSON.stringify(item)), { ...metadata, ...(file.etag ? { onlyIf: { etagMatches: file.etag } } : {}) });
    if (stored === null) return Response.json({ error: "Cette demande a été modifiée. Recharge le ticket." }, { status: 409 });
    await bucket.put(`feedback/summaries/${item.id}.json`, new TextEncoder().encode(JSON.stringify(feedbackSummary(item))), metadata);
    return Response.json({ item });
  } catch { return Response.json({ error: "Statut non enregistré. Réessaie." }, { status: 503 }); }
}
