// Shared editing has no login lifecycle. Keep older clients compatible.
export async function POST() {
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
