"use client";
import { useEffect, useState } from "react";
import { buildMailHtml, buildInteractiveHtml } from "./point-exports";
import type { PointData, Market, PointRecord } from "./point-model";
type Result = { data: PointData; market: Market; archive: PointRecord[]; mail: string; html: string; error: string };
export function usePointExports(active: boolean, data: PointData, market: Market, archive: PointRecord[]) {
  const [result, setResult] = useState<Result | null>(null);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    // Yield a frame before generating large exports, and coalesce rapid edits.
    const timer = window.setTimeout(() => {
      try {
        const mail = buildMailHtml(data, market, archive);
        const html = buildInteractiveHtml(data, market, archive);
        if (!cancelled) setResult({ data, market, archive, mail, html, error: "" });
      } catch {
        if (!cancelled) setResult({ data, market, archive, mail: "", html: "", error: "La préparation des exports a échoué. Vérifie les données du point puis réessaie." });
      }
    }, 120);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [active, data, market, archive]);
  const current = result?.data === data && result?.market === market && result?.archive === archive;
  return { mailHtml: current ? result.mail : "", interactiveHtml: current ? result.html : "", error: current ? result.error : "", preparing: active && !current };
}
