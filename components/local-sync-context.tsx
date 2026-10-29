"use client";
import { createContext, useContext } from "react";

export type LocalSyncIndicator = {
  status: "ready" | "syncing" | "waiting" | "error" | "conflict";
  folder: string;
  message: string;
  conflicts: number;
};
export const LocalSyncContext = createContext<LocalSyncIndicator | null>(null);
export const useLocalSync = () => useContext(LocalSyncContext);
