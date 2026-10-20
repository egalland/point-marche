"use client";
import { useCallback, useEffect, useState } from "react";
import { workspaceViewFromUrl, workspaceViewUrl } from "@/lib/workspace-route";
import type { WorkspaceView } from "./workspace-navigation";
/** All workspace tabs share one application; URLs restore the current tab without a reload. */
export function useWorkspaceRoute(): [WorkspaceView, (view: WorkspaceView) => void] {
  const [view, setView] = useState<WorkspaceView>("read");
  useEffect(() => {
    const restore = () => setView(workspaceViewFromUrl(window.location.href));
    restore();
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  const navigate = useCallback((next: WorkspaceView) => {
    const url = workspaceViewUrl(window.location.href, next);
    if (url !== window.location.href) window.history.pushState(null, "", url);
    setView(next === "edit" ? "read" : next);
  }, []);
  return [view, navigate];
}
