import { getRuntimeEnv } from "../lib/runtime-env";

// V48: the owner explicitly enabled shared editing without an application login.
// Reuse the configured account key so existing drafts remain available.
export async function getEditorUser() {
  return { displayName: "Espace partagé", username: getRuntimeEnv()?.MARKET_PULSE_USERNAME?.trim() || "market-pulse-shared" };
}
