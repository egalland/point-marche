import { NextRequest, NextResponse } from "next/server";
import { EDITOR_SESSION_COOKIE, verifyEditorSessionToken } from "./lib/editor-session";

function requiresEditor(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (request.method === "OPTIONS") return false;
  if (path === "/api/global-users" || path === "/api/planner-tasks") return true;
  return request.method !== "GET" && ["/api/markets", "/api/points", "/api/jira-week"].includes(path);
}

export async function proxy(request: NextRequest) {
  if (!requiresEditor(request)) return NextResponse.next();
  const token = request.cookies.get(EDITOR_SESSION_COOKIE)?.value ?? "";
  if (token && await verifyEditorSessionToken(token)) return NextResponse.next();
  return NextResponse.json({ error: "Connexion GLOBAL requise." }, { status: 401, headers: { "Cache-Control": "no-store" } });
}

export const config = {
  matcher: "/api/:path*",
};
