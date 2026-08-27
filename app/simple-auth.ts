import { cookies } from "next/headers";
import { EDITOR_SESSION_COOKIE, verifyEditorSessionToken } from "../lib/editor-session";

export { clearedEditorSessionCookie, createEditorSession, editorAuthConfigured, editorSessionCookie, validateEditorCredentials } from "../lib/editor-session";
export type { EditorUser } from "../lib/editor-session";

export async function getEditorUser() {
  const token = (await cookies()).get(EDITOR_SESSION_COOKIE)?.value;
  return token ? verifyEditorSessionToken(token) : null;
}
