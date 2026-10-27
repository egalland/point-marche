let permissions: Record<string,boolean> | null = null;
export function setClientPermissions(value: Record<string,boolean> | null) { permissions = value; }
export function clientCan(permission: string) { return permissions?.[permission] ?? permissions === null; }
let usercode = "", device = "", view = "";
export function setAccessView(value: string) { view = value; }
export function setAccessIdentity(value: string) { usercode = value; }
export function accessIdentity() { return usercode; }
export function accessHeaders(init?: RequestInit) {
  const headers = new Headers(init?.headers);
  if (view) headers.set("X-Market-View", view);
  if (usercode) headers.set("X-Market-USERCODE", usercode);
  if (!device && typeof window !== "undefined") {
    try { device = localStorage.getItem("market-pulse:device") || `Navigateur-${crypto.randomUUID().slice(0, 8)}`; localStorage.setItem("market-pulse:device", device); }
    catch { device = "Navigateur"; }
  }
  if (device) headers.set("X-Market-Device", device);
  return { ...init, headers };
}
