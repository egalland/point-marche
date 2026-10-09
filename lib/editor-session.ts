import { getRuntimeEnv } from "./runtime-env";

export type EditorUser = {
  displayName: string;
  username: string;
};

export const EDITOR_SESSION_COOKIE = "market_pulse_editor";
const SESSION_DURATION_SECONDS = 12 * 60 * 60;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function configuredUsername() {
  return getRuntimeEnv()?.MARKET_PULSE_USERNAME?.trim() ?? "";
}

function configuredPassword() {
  return getRuntimeEnv()?.MARKET_PULSE_PASSWORD ?? "";
}

function sessionSecret() {
  return getRuntimeEnv()?.MARKET_PULSE_SESSION_SECRET ?? "";
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function signature(value: string) {
  const secret = sessionSecret();
  if (!secret) return "";
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

async function safeEqual(left: string, right: string) {
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  const leftBytes = new Uint8Array(leftHash);
  const rightBytes = new Uint8Array(rightHash);
  let difference = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < Math.max(leftBytes.length, rightBytes.length); index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return difference === 0;
}

export function editorAuthConfigured() {
  return Boolean(configuredUsername() && configuredPassword() && sessionSecret());
}

export async function validateEditorCredentials(username: string, password: string) {
  if (!editorAuthConfigured()) return false;
  const [usernameMatches, passwordMatches] = await Promise.all([
    safeEqual(username.trim(), configuredUsername()),
    safeEqual(password, configuredPassword()),
  ]);
  return usernameMatches && passwordMatches;
}

export async function createEditorSession(username: string) {
  const payload = toBase64Url(encoder.encode(JSON.stringify({
    username,
    expiresAt: Date.now() + SESSION_DURATION_SECONDS * 1000,
  })));
  return `${payload}.${await signature(payload)}`;
}

export async function verifyEditorSessionToken(token: string): Promise<EditorUser | null> {
  if (!editorAuthConfigured()) return null;
  const [payload, suppliedSignature] = token.split(".");
  if (!payload || !suppliedSignature || !await safeEqual(suppliedSignature, await signature(payload))) return null;
  try {
    const parsed = JSON.parse(decoder.decode(fromBase64Url(payload))) as { username?: unknown; expiresAt?: unknown };
    if (typeof parsed.username !== "string" || typeof parsed.expiresAt !== "number") return null;
    if (parsed.expiresAt <= Date.now() || !await safeEqual(parsed.username, configuredUsername())) return null;
    return { displayName: "Compte GLOBAL", username: parsed.username };
  } catch {
    return null;
  }
}

export function editorSessionCookie(value: string) {
  return `${EDITOR_SESSION_COOKIE}=${value}; Path=/; Max-Age=${SESSION_DURATION_SECONDS}; HttpOnly; Secure; SameSite=Strict`;
}

export function clearedEditorSessionCookie() {
  return `${EDITOR_SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}
