import type { WorkspaceView } from "../features/market-pulse/workspace-navigation";
const views = new Set<WorkspaceView>(["read", "edit", "analyst", "stats", "suppliers", "imports", "mail", "settings"]);
export function workspaceViewFromUrl(href: string): WorkspaceView {
  const mode = new URL(href).searchParams.get("mode") as WorkspaceView | null;
  return mode && views.has(mode) ? mode === "edit" ? "read" : mode : "read";
}
export function workspaceViewUrl(href: string, view: WorkspaceView) {
  const url = new URL(href);
  const mode = view === "edit" ? "read" : view;
  if (mode === "read") url.searchParams.delete("mode"); else url.searchParams.set("mode", mode);
  if (mode !== "suppliers") url.searchParams.delete("supplier");
  // Anchors belong to their original tab (e.g. an import source or a point block).
  if (workspaceViewFromUrl(href) !== mode) url.hash = "";
  return url.href;
}
