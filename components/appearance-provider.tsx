"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { appearanceStorageKey, normalizeAppearance, resolveAppearance, type AppearanceMode } from "@/lib/appearance";
import { isLocalWorkspace, readLocalPreference, writeLocalPreference } from "@/lib/app-transport";

const AppearanceContext = createContext<{ mode: AppearanceMode; chooseMode: (mode: AppearanceMode) => void } | null>(null);

function applyMode(mode: AppearanceMode) {
  document.documentElement.dataset.appearance = mode;
  document.documentElement.dataset.theme = resolveAppearance(mode, window.matchMedia("(prefers-color-scheme: dark)").matches);
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<AppearanceMode>("system");
  const modeRef = useRef<AppearanceMode>("system");
  const updateMode = useCallback((next: AppearanceMode) => {
    modeRef.current = next;
    setMode(next);
    applyMode(next);
  }, []);

  useEffect(() => {
    let saved: AppearanceMode = "system";
    try { saved = normalizeAppearance(window.localStorage.getItem(appearanceStorageKey)); } catch {}
    if (isLocalWorkspace()) saved = normalizeAppearance(readLocalPreference(appearanceStorageKey));
    updateMode(saved);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => { if (modeRef.current === "system") applyMode("system"); };
    const onStorage = (event: StorageEvent) => {
      if (isLocalWorkspace()) return;
      if (event.key === appearanceStorageKey || event.key === null) updateMode(normalizeAppearance(event.newValue));
    };
    media.addEventListener("change", onSystemChange);
    window.addEventListener("storage", onStorage);
    return () => {
      media.removeEventListener("change", onSystemChange);
      window.removeEventListener("storage", onStorage);
    };
  }, [updateMode]);

  const chooseMode = useCallback((next: AppearanceMode) => {
    updateMode(next);
    try { window.localStorage.setItem(appearanceStorageKey, next); } catch {}
    writeLocalPreference(appearanceStorageKey, next);
  }, [updateMode]);

  return <AppearanceContext.Provider value={{ mode, chooseMode }}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  const context = useContext(AppearanceContext);
  if (!context) throw new Error("AppearanceProvider manquant");
  return context;
}
