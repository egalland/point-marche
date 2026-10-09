import type { DraftSnapshot } from "./point-persistence";
import { samePointVersion } from "./point-persistence";

export function remotePointData(snapshot: DraftSnapshot) {
  return snapshot.draft && samePointVersion(snapshot.draft.basePoint, snapshot.point) ? snapshot.draft.data : snapshot.point?.data ?? snapshot.draft?.data ?? {};
}

const labels: Record<string, string> = { meetingDate: "Date du point", priority: "Priorité", note: "Synthèse", periodFrom: "Période du", periodTo: "Période au", cycleFrom: "Cycle du", cycleTo: "Cycle au", includeCycle20: "Repère 20 → 20", jiraMode: "Mode Jira", plannerMode: "Mode simulations", themeColor: "Thème", customColor: "Couleur", dossiers: "Dossiers", operations: "Simulations", promotions: "Promotions", tariffs: "Tarifs", jira: "Jira ouverts", jiraResolved: "Jira terminés", title: "Titre", name: "Nom", summary: "Résumé", status: "Statut", state: "État", month: "Mois", period: "Période", action: "Action", comment: "Commentaire", deadline: "Échéance", progress: "Avancement", showProgress: "Afficher l’avancement", owner: "Responsable", assignee: "Attribution", reference: "Référence", universe: "Univers", count: "Nombre", priorityLabel: "Priorité", lastActivity: "Dernière activité", purchases12m: "Achats", purchaseNote: "Promotion achat", salesState: "État vente", preferences: "Présentation", mail: "Mail", to: "À", cc: "Copie", subject: "Objet", intro: "Introduction", fontScale: "Taille", fontScalePercent: "Taille (%)", density: "Densité", moduleOrder: "Ordre des blocs", order: "Ordre des blocs", moduleWidths: "Largeurs", widths: "Largeurs", readModules: "Blocs visibles", mailModules: "Blocs du mail", htmlModules: "Blocs de la page", comparison: "Comparaison", alerts: "Vigilances", overview: "Synthèse", planner: "Planner", cycle20: "Repère 20 → 20", manualJiraCounts: "Totaux manuels Jira", open: "Ouverts", resolved: "Terminés" };
const ignored = new Set(["id", "analystId", "key", "internalId", "sourceId", "carriedFromYear", "carriedFromWeek", "plannerSource", "plannerBase", "plannerOverride", "pointOverride", "importedBase", "sourceFreshness", "steps", "autoTo", "autoCc", "pointName"]);
function describe(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  if (Array.isArray(value)) return value.map((item) => labels[String(item)] ?? String(item)).join(" · ") || "—";
  return String(value);
}
function flatten(value: Record<string, unknown>, prefix = "", path = "", result = new Map<string, { label: string; value: string }>()) {
  for (const [key, item] of Object.entries(value)) {
    if (ignored.has(key)) continue;
    const label = [prefix, labels[key] ?? key].filter(Boolean).join(" · ");
    const itemPath = `${path}/${key}`;
    if (Array.isArray(item) && item.some((row) => row && typeof row === "object")) {
      item.forEach((row, index) => {
        if (!row || typeof row !== "object") return;
        const identity = String(row.id ?? row.key ?? index);
        const title = row.key || row.title || row.name || row.summary || `Élément ${index + 1}`;
        flatten(row, `${label} · ${title}`, `${itemPath}/${identity}`, result);
      });
    } else if (item && typeof item === "object" && !Array.isArray(item)) flatten(item as Record<string, unknown>, label, itemPath, result);
    else result.set(itemPath, { label, value: describe(item) });
  }
  return result;
}
export function pointDifferences(local: Record<string, unknown>, remote: Record<string, unknown>) {
  const mine = flatten(local), theirs = flatten(remote);
  return [...new Set([...mine.keys(), ...theirs.keys()])].flatMap((key) => {
    const left = mine.get(key), right = theirs.get(key);
    return left?.value === right?.value ? [] : [{ key, label: left?.label ?? right!.label, mine: left?.value ?? "Absent", remote: right?.value ?? "Absent" }];
  });
}
