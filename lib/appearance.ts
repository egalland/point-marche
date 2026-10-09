export type AppearanceMode = "light" | "dark" | "system";

export const appearanceStorageKey = "market-pulse:appearance:v1";
export const appearanceOptions = [
  { id: "light", label: "Clair", icon: "sun", detail: "Une lecture nette sur fond blanc." },
  { id: "dark", label: "Sombre", icon: "moon", detail: "Des surfaces ardoise, sans éblouissement." },
  { id: "system", label: "Système", icon: "monitor", detail: "Suit le réglage de cet appareil." },
] as const;

export function normalizeAppearance(value: unknown): AppearanceMode {
  return value === "light" || value === "dark" ? value : "system";
}

export function resolveAppearance(mode: AppearanceMode, prefersDark: boolean) {
  return mode === "system" ? prefersDark ? "dark" : "light" : mode;
}

export const appearanceBootstrapScript = `(()=>{let m="system";try{const v=localStorage.getItem("${appearanceStorageKey}");if(v==="light"||v==="dark")m=v}catch{}const d=document.documentElement;d.dataset.appearance=m;d.dataset.theme=m==="system"?(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):m})()`;
