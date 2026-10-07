import { getRuntimeEnv } from "../lib/runtime-env";
export { clearedEditorSessionCookie, createEditorSession, editorAuthConfigured, editorSessionCookie, validateEditorCredentials } from "../lib/editor-session";
export type { EditorUser } from "../lib/editor-session";

// V48: the owner explicitly enabled shared editing without an application login.
// Reuse the configured account key so existing drafts remain available.
export async function getEditorUser() {
  return { displayName: "Espace partagé", username: getRuntimeEnv()?.MARKET_PULSE_USERNAME?.trim() || "market-pulse-shared" };
}
