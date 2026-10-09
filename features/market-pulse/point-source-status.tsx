import { pointTimeLabel } from "@/lib/point-persistence";
import type { PointSourceMode } from "@/lib/point-source-mode";

export type PointSourceFreshness = { jira?: string; planner?: string };
export function PointSourceStatus({ sources = {}, jiraMode, plannerMode = "automatic", corrections = 0, additions = 0 }: { sources?: PointSourceFreshness; jiraMode: PointSourceMode; plannerMode?: PointSourceMode; corrections?: number; additions?: number }) {
  return <div className="point-source-status" aria-label="Sources utilisées dans le point">
    <span><b>Jira</b> {jiraMode === "manual" ? "Saisie manuelle" : sources.jira ? `Import du ${pointTimeLabel(sources.jira)}` : "Date d’import inconnue"}</span>
    <span><b>Planner</b> {plannerMode === "manual" ? "Saisie manuelle" : sources.planner ? `Import du ${pointTimeLabel(sources.planner)}` : "Date d’import inconnue"}</span>
    {corrections > 0 && <span className="has-corrections">{corrections} élément{corrections > 1 ? "s" : ""} corrigé{corrections > 1 ? "s" : ""} dans le point</span>}
    {additions > 0 && <span>{additions} ajout{additions > 1 ? "s" : ""} manuel{additions > 1 ? "s" : ""}</span>}
  </div>;
}
